import { describe, expect, it } from 'vitest';
import { copy } from '../src/copy.js';
import { GARMENTS, OUTFITS, SECTIONS, getOutfitById, groupBySection } from '../src/data/outfits.js';
import { normalizeForecast } from '../src/domain/forecast.js';
import {
  DEFAULTS,
  InsufficientForecastError,
  deriveDaySummary,
  recommendOutfit
} from '../src/domain/recommendation.js';
import { hasIcon } from '../src/ui/icons.js';
import { LAYERS } from '../src/ui/outfit-illustration.js';
import { buildRawForecast, normalizedScenario } from './fixtures.js';

const recommendFor = (name) => {
  const summary = deriveDaySummary(normalizedScenario(name), DEFAULTS);
  return { summary, recommendation: recommendOutfit(summary, DEFAULTS) };
};

describe('outfit catalog', () => {
  it('has exactly the nine canonical outfits', () => {
    expect(OUTFITS.map((outfit) => outfit.id)).toEqual([
      'sunny-hot', 'warm-dry', 'mild-dry', 'fresh-dry', 'cold-dry', 'hot-rain', 'cold-rain', 'super-rain', 'super-cold'
    ]);
  });

  it('lists the cold & rainy garments', () => {
    expect(getOutfitById('cold-rain').garments).toEqual([
      'hat', 'neckWarmer', 'longTee', 'sweater', 'jacket', 'longPants', 'mudOveralls', 'socks', 'waterproofShoes', 'umbrella'
    ]);
  });

  it('only uses garments from the garment catalog', () => {
    for (const outfit of OUTFITS) {
      for (const id of outfit.garments) expect(GARMENTS, `${outfit.id} → ${id}`).toHaveProperty(id);
    }
  });

  it('gives every garment a known section, an icon, and an illustration layer in that section', () => {
    for (const [id, garment] of Object.entries(GARMENTS)) {
      expect(SECTIONS).toContain(garment.section);
      expect(hasIcon(id), `icon for ${id}`).toBe(true);
      expect(LAYERS[garment.section], `layer for ${id}`).toHaveProperty(id);
    }
    const layerIds = Object.values(LAYERS).flatMap((section) => Object.keys(section));
    expect(layerIds.sort()).toEqual(Object.keys(GARMENTS).sort());
  });

  it('groups garments by section, head to toe, in catalog order', () => {
    expect(groupBySection(getOutfitById('super-cold').garments)).toEqual([
      { section: 'head', garments: ['warmHat', 'neckWarmer'] },
      { section: 'middle', garments: ['thermalLayer', 'longTee', 'sweater', 'snowsuit'] },
      { section: 'bottom', garments: ['socks', 'winterBoots'] },
      { section: 'carry', garments: ['gloves'] }
    ]);
  });
});

describe('deriveDaySummary', () => {
  it('summarizes 07:00 until 22:00 by default', () => {
    const { summary } = recommendFor('cold-rain');
    expect(summary.window).toEqual({ start: '07:00', end: '22:00', hourCount: 15 });
    expect(summary.minApparentC).toBe(6.9);
    expect(summary.maxApparentC).toBe(13.9);
    expect(summary.rainLikely).toBe(true);
    expect(summary.maxRainProbability).toBe(70);
    expect(summary.precipitationTotalMm).toBe(4);
    expect(summary.firstRainHour).toBe(14);
    expect(summary.maxWindKmh).toBe(22);
    expect(summary.sunnyFraction).toBe(0);
  });

  it('only looks at the hours from `fromHour` until 22:00', () => {
    const summary = deriveDaySummary(normalizedScenario('cold-rain'), DEFAULTS, { fromHour: 15 });
    expect(summary.window).toEqual({ start: '15:00', end: '22:00', hourCount: 7 });
    expect(summary.minApparentC).toBe(10.9);
    expect(summary.precipitationTotalMm).toBe(3.5);
    expect(summary.firstRainHour).toBe(15);
  });

  it('clamps `fromHour` into the tracked day, keeping at least the current hour', () => {
    const forecast = normalizedScenario('cold-rain');
    expect(deriveDaySummary(forecast, DEFAULTS, { fromHour: 3 }).window.start).toBe('07:00');
    expect(deriveDaySummary(forecast, DEFAULTS, { fromHour: 22 }).window).toEqual({ start: '22:00', end: '23:00', hourCount: 1 });
    expect(deriveDaySummary(forecast, DEFAULTS, { fromHour: 30 }).window).toEqual({ start: '23:00', end: '24:00', hourCount: 1 });
  });

  it('stops before `toHour`, up to 24:00', () => {
    const forecast = normalizedScenario('cold-rain');
    expect(deriveDaySummary(forecast, DEFAULTS, { fromHour: 8, toHour: 12 }).window).toEqual({ start: '08:00', end: '12:00', hourCount: 4 });
    expect(deriveDaySummary(forecast, DEFAULTS, { toHour: 24 }).window).toEqual({ start: '07:00', end: '24:00', hourCount: 17 });
    expect(deriveDaySummary(forecast, DEFAULTS, { toHour: 30 }).window.end).toBe('24:00');
    expect(deriveDaySummary(forecast, DEFAULTS, { fromHour: 15, toHour: 10 }).window).toEqual({ start: '15:00', end: '16:00', hourCount: 1 });
  });

  it('says dry until the end of the range, or the rest of the day at 24:00', () => {
    const forecast = normalizedScenario('mild-dry');
    expect(deriveDaySummary(forecast, DEFAULTS, { toHour: 18 }).reasons).toContain(copy.reasonDryUntil('18:00'));
    expect(deriveDaySummary(forecast, DEFAULTS).reasons).toContain(copy.reasonDryUntil('22:00'));
    expect(deriveDaySummary(forecast, DEFAULTS, { toHour: 24 }).reasons).toContain(copy.reasonDry);
  });

  it('drops the cold morning from the outfit once it has passed', () => {
    const later = deriveDaySummary(normalizedScenario('cold-dry'), DEFAULTS, { fromHour: 20 });
    expect(later.minApparentC).toBe(9);
    expect(recommendOutfit(later, DEFAULTS).outfitId).toBe('fresh-dry');
  });

  it('ignores cold nights and late-night rain after the default outfit hours', () => {
    expect(recommendFor('cold-dry').summary.minApparentC).toBe(2.5);
    const hot = recommendFor('sunny-hot').summary;
    expect(hot.rainLikely).toBe(false);
    expect(hot.hotAndSunny).toBe(true);
  });

  it('treats a meaningful total amount as rain even with low probabilities', () => {
    const forecast = normalizeForecast(
      buildRawForecast({ perHour: (hour) => ({ apparent: 18, rainProbability: 30, precipitation: hour >= 8 && hour <= 10 ? 0.1 : 0 }) })
    );
    const summary = deriveDaySummary(forecast);
    expect(summary.precipitationTotalMm).toBe(0.3);
    expect(summary.rainLikely).toBe(true);
    expect(summary.reasons[0]).toBe('Showers possible (0.3 mm)');
  });

  it('produces short human reasons', () => {
    const { summary } = recommendFor('cold-rain');
    expect(summary.reasons).toEqual([
      'Rain likely in the afternoon (up to 70%)',
      'Feels like 7°C early in the morning',
      'Warming to 14°C later',
      'Breezy — up to 22 km/h'
    ]);
  });

  it('throws when the tracked day has no usable temperatures', () => {
    const forecast = normalizeForecast(
      buildRawForecast({ perHour: (hour) => (hour >= 7 && hour <= 22 ? { apparent: null, temperature: null } : {}) })
    );
    expect(() => deriveDaySummary(forecast)).toThrow(InsufficientForecastError);
  });
});

describe('recommendOutfit', () => {
  it.each([
    ['sunny-hot', 'sunny-hot'],
    ['warm-dry', 'warm-dry'],
    ['mild-dry', 'mild-dry'],
    ['fresh-dry', 'fresh-dry'],
    ['cold-dry', 'cold-dry'],
    ['hot-rain', 'hot-rain'],
    ['cold-rain', 'cold-rain'],
    ['super-rain', 'super-rain'],
    ['super-cold', 'super-cold']
  ])('%s weather → %s outfit', (scenario, expected) => {
    const { recommendation } = recommendFor(scenario);
    expect(recommendation.outfitId).toBe(expected);
    expect(recommendation.addOns).toEqual([]);
    expect(recommendation.source).toBe('rules');
  });

  it('picks the rain jacket outfit on a warm rainy day', () => {
    const { summary, recommendation } = recommendFor('hot-rain');
    expect(summary.rainLikely).toBe(true);
    expect(recommendation.outfitId).toBe('hot-rain');
    expect(recommendation.addOns).toEqual([]);
  });

  it('never picks sunny-hot on a hot but rainy day', () => {
    const forecast = normalizeForecast(
      buildRawForecast({ perHour: () => ({ apparent: 25, cloudCover: 10, rainProbability: 60 }) })
    );
    expect(recommendOutfit(deriveDaySummary(forecast)).outfitId).toBe('hot-rain');
  });

  it('adds rain gear when a rainy day lands on an outfit that is not waterproof', () => {
    const { summary } = recommendFor('hot-rain');
    const dryOnly = OUTFITS.map((outfit) => (outfit.id === 'hot-rain' ? { ...outfit, tags: ['rain', 'mild'] } : outfit));
    expect(recommendOutfit(summary, DEFAULTS, dryOnly).addOns).toEqual(['rain-gear']);
  });

  it('switches to super-cold below the freezing boundary, even when it rains', () => {
    const at = (apparent, rainProbability = 0) =>
      recommendOutfit(deriveDaySummary(normalizeForecast(buildRawForecast({ perHour: () => ({ apparent, rainProbability }) })))).outfitId;
    expect(at(0)).toBe('cold-dry');
    expect(at(-0.1)).toBe('super-cold');
    expect(at(-2, 90)).toBe('super-cold');
  });

  it('switches to super-rain at the heavy-rain total, whatever the temperature', () => {
    // 15 hours from 07:00 until 22:00; spread the total evenly over them.
    const at = (totalMm, apparent = 14) =>
      recommendOutfit(
        deriveDaySummary(
          normalizeForecast(buildRawForecast({ perHour: () => ({ apparent, rainProbability: 60, precipitation: totalMm / 15 }) }))
        )
      ).outfitId;
    expect(at(4.8)).toBe('hot-rain');
    expect(at(5)).toBe('super-rain');
    expect(at(8, 5)).toBe('super-rain');
  });

  it('splits light rain on the cold-rain boundary', () => {
    const at = (apparent) =>
      recommendOutfit(deriveDaySummary(normalizeForecast(buildRawForecast({ perHour: () => ({ apparent, rainProbability: 60 }) })))).outfitId;
    expect(at(12)).toBe('hot-rain');
    expect(at(11.9)).toBe('cold-rain');
  });

  it('dresses a hot but cloudy day lightly, without the sun hat', () => {
    const forecast = normalizeForecast(buildRawForecast({ perHour: () => ({ apparent: 25, cloudCover: 80 }) }));
    const summary = deriveDaySummary(forecast);
    expect(summary.hotAndSunny).toBe(false);
    expect(recommendOutfit(summary).outfitId).toBe('warm-dry');
  });

  it('dresses a warm overcast afternoon that cools to 20°C in the evening lightly', () => {
    const afternoon = (cloudCover) =>
      normalizeForecast(
        buildRawForecast({ perHour: (hour) => ({ apparent: hour >= 15 ? 23 - (hour - 15) * 0.5 : 24, cloudCover }) })
      );
    const window = { fromHour: 15, toHour: 22 };
    const overcast = deriveDaySummary(afternoon(95), DEFAULTS, window);
    expect(overcast.minApparentC).toBe(20);
    expect(recommendOutfit(overcast).outfitId).toBe('warm-dry');
    expect(recommendOutfit(deriveDaySummary(afternoon(10), DEFAULTS, window)).outfitId).toBe('sunny-hot');
  });

  it('uses boundaries from DEFAULTS', () => {
    const at = (apparent) =>
      recommendOutfit(deriveDaySummary(normalizeForecast(buildRawForecast({ perHour: () => ({ apparent, cloudCover: 80 }) })))).outfitId;
    expect(at(20)).toBe('warm-dry');
    expect(at(19.9)).toBe('mild-dry');
    expect(at(16)).toBe('mild-dry');
    expect(at(15.9)).toBe('fresh-dry');
    expect(at(9)).toBe('fresh-dry');
    expect(at(8.9)).toBe('cold-dry');
  });

  it('limits reasons to three chips', () => {
    const { recommendation } = recommendFor('sunny-hot');
    expect(recommendation.reasons.length).toBeLessThanOrEqual(3);
  });
});
