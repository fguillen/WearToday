import { copy, formatters } from '../copy.js';
import { OUTFITS, getOutfitById } from '../data/outfits.js';
import { feelsLike, selectWindowHours } from './forecast.js';

// Defaults, not objective child-safety thresholds. A future settings surface
// should let parents adjust them.
export const DEFAULTS = Object.freeze({
  timezone: 'Europe/Berlin',
  kindergartenStartHour: 8,
  kindergartenEndHour: 17,
  hotMinimumApparentC: 22,
  mildMinimumApparentC: 16,
  freshMinimumApparentC: 9,
  sunnyMaximumCloudCover: 35,
  sunnyMinimumFraction: 0.65,
  rainProbabilityThreshold: 50,
  rainAmountThresholdMm: 0.3,
  coldRainMaximumApparentC: 12,
  minimumAiConfidence: 0.6,
  cacheMinutes: 15
});

const BREEZY_KMH = 20;
const WINDY_KMH = 40;
const WARMING_SPREAD_C = 6;

export class InsufficientForecastError extends Error {
  constructor() {
    super('No usable forecast hours in the kindergarten window');
    this.name = 'InsufficientForecastError';
  }
}

const round1 = (value) => Math.round(value * 10) / 10;

export function deriveDaySummary(forecast, defaults = DEFAULTS) {
  const start = defaults.kindergartenStartHour;
  const end = defaults.kindergartenEndHour;
  const windowHours = selectWindowHours(forecast.hours, start, end).filter((hour) => feelsLike(hour) !== null);
  if (windowHours.length === 0) throw new InsufficientForecastError();

  const coldest = windowHours.reduce((min, hour) => (feelsLike(hour) < feelsLike(min) ? hour : min));
  const warmest = windowHours.reduce((max, hour) => (feelsLike(hour) > feelsLike(max) ? hour : max));
  const minApparentC = round1(feelsLike(coldest));
  const maxApparentC = round1(feelsLike(warmest));

  const maxRainProbability = Math.max(0, ...windowHours.map((hour) => hour.precipitationProbabilityPercent ?? 0));
  const precipitationTotalMm = round1(windowHours.reduce((sum, hour) => sum + (hour.precipitationMm ?? 0), 0));
  const rainLikely =
    maxRainProbability >= defaults.rainProbabilityThreshold || precipitationTotalMm >= defaults.rainAmountThresholdMm;

  const sunnyHours = windowHours.filter(
    (hour) => hour.cloudCoverPercent !== null && hour.cloudCoverPercent <= defaults.sunnyMaximumCloudCover
  ).length;
  const sunnyFraction = Math.round((sunnyHours / windowHours.length) * 100) / 100;
  const maxWindKmh = Math.round(Math.max(0, ...windowHours.map((hour) => hour.windKmh ?? 0)));

  const hotAndSunny =
    !rainLikely &&
    minApparentC >= defaults.hotMinimumApparentC &&
    sunnyHours / windowHours.length >= defaults.sunnyMinimumFraction;

  const firstRainHour = windowHours.find(
    (hour) =>
      (hour.precipitationProbabilityPercent ?? 0) >= defaults.rainProbabilityThreshold || (hour.precipitationMm ?? 0) > 0
  );

  const summary = {
    window: {
      start: formatters.hourLabel(start),
      end: formatters.hourLabel(end),
      hourCount: windowHours.length
    },
    minApparentC,
    maxApparentC,
    coldestHour: coldest.hour,
    rainLikely,
    firstRainHour: firstRainHour?.hour ?? null,
    maxRainProbability,
    precipitationTotalMm,
    sunnyFraction,
    hotAndSunny,
    maxWindKmh
  };
  summary.reasons = buildReasons(summary, defaults);
  return summary;
}

function buildReasons(summary, defaults) {
  const reasons = [];

  if (summary.rainLikely) {
    reasons.push(
      summary.maxRainProbability >= defaults.rainProbabilityThreshold
        ? copy.reasonRainLikely(copy.timeOfDay(summary.firstRainHour ?? defaults.kindergartenStartHour), summary.maxRainProbability)
        : copy.reasonRainAmount(summary.precipitationTotalMm)
    );
  }

  reasons.push(copy.reasonFeelsLike(Math.round(summary.minApparentC), copy.timeOfDay(summary.coldestHour)));

  if (summary.maxApparentC - summary.minApparentC >= WARMING_SPREAD_C) {
    reasons.push(copy.reasonWarmsTo(Math.round(summary.maxApparentC)));
  }

  if (summary.maxWindKmh >= WINDY_KMH) reasons.push(copy.reasonWindy(summary.maxWindKmh));
  else if (summary.maxWindKmh >= BREEZY_KMH) reasons.push(copy.reasonBreezy(summary.maxWindKmh));

  if (summary.hotAndSunny) reasons.push(copy.reasonSunny);
  if (!summary.rainLikely) reasons.push(copy.reasonDry);

  return reasons;
}

// Picks the dry base outfit (rules 5–8) ignoring rain.
function chooseDryBase(summary, defaults) {
  if (summary.hotAndSunny) return 'sunny-hot';
  if (summary.minApparentC >= defaults.mildMinimumApparentC) return 'mild-dry';
  if (summary.minApparentC >= defaults.freshMinimumApparentC) return 'fresh-dry';
  return 'cold-dry';
}

export function addOnsForOutfit(outfit, summary) {
  return summary.rainLikely && !outfit.tags.includes('rain') ? ['rain-gear'] : [];
}

export function recommendOutfit(summary, defaults = DEFAULTS, outfits = OUTFITS) {
  const outfitId =
    summary.rainLikely && summary.minApparentC < defaults.coldRainMaximumApparentC
      ? 'cold-rain'
      : chooseDryBase(summary, defaults);
  const outfit = getOutfitById(outfitId, outfits);
  return {
    source: 'rules',
    outfitId,
    addOns: addOnsForOutfit(outfit, summary),
    reasons: summary.reasons.slice(0, 3)
  };
}
