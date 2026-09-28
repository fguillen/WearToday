import { describe, expect, it } from 'vitest';
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
  it('has exactly the eight canonical outfits', () => {
    expect(OUTFITS.map((outfit) => outfit.id)).toEqual([
      'sunny-hot', 'mild-dry', 'fresh-dry', 'cold-dry', 'hot-rain', 'cold-rain', 'super-rain', 'super-cold'
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
  it('summarizes the whole tracked day, 07:00–22:00', () => {
    const { summary } = recommendFor('cold-rain');
    expect(summary.window).toEqual({ start: '07:00', end: '22:00', hourCount: 16 });
    expect(summary.minApparentC).toBe(6.9);
    expect(summary.maxApparentC).toBe(14.4);
    expect(summary.rainLikely).toBe(true);
    expect(summary.maxRainProbability).toBe(70);
    expect(summary.precipitationTotalMm).toBe(4.5);
    expect(summary.firstRainHour).toBe(14);
    expect(summary.maxWindKmh).toBe(22);
    expect(summary.sunnyFraction).toBe(0);
  });

  it('only looks at the hours from `fromHour` to the end of the day', () => {
    const summary = deriveDaySummary(normalizedScenario('cold-rain'), DEFAULTS, { fromHour: 15 });
    expect(summary.window).toEqual({ start: '15:00', end: '22:00', hourCount: 8 });
    expect(summary.minApparentC).toBe(10.9);
    expect(summary.precipitationTotalMm).toBe(4);
    expect(summary.firstRainHour).toBe(15);
  });

  it('clamps `fromHour` into the tracked day', () => {
    const forecast = normalizedScenario('cold-rain');
    expect(deriveDaySummary(forecast, DEFAULTS, { fromHour: 3 }).window.start).toBe('07:00');
    expect(deriveDaySummary(forecast, DEFAULTS, { fromHour: 23 }).window).toEqual({ start: '22:00', end: '22:00', hourCount: 1 });
  });

  it('drops the cold morning from the outfit once it has passed', () => {
    const later = deriveDaySummary(normalizedScenario('cold-dry'), DEFAULTS, { fromHour: 20 });
    expect(later.minApparentC).toBe(9);
    expect(recommendOutfit(later, DEFAULTS).outfitId).toBe('fresh-dry');
  });

  it('ignores cold nights and late-night rain outside the tracked day', () => {
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
    // 16 tracked hours; spread the total evenly over them.
    const at = (totalMm, apparent = 14) =>
      recommendOutfit(
        deriveDaySummary(
          normalizeForecast(buildRawForecast({ perHour: () => ({ apparent, rainProbability: 60, precipitation: totalMm / 16 }) }))
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

  it('does not treat a hot but cloudy day as sunny', () => {
    const forecast = normalizeForecast(buildRawForecast({ perHour: () => ({ apparent: 25, cloudCover: 80 }) }));
    expect(recommendOutfit(deriveDaySummary(forecast)).outfitId).toBe('mild-dry');
  });

  it('uses boundaries from DEFAULTS', () => {
    const at = (apparent) =>
      recommendOutfit(deriveDaySummary(normalizeForecast(buildRawForecast({ perHour: () => ({ apparent, cloudCover: 80 }) })))).outfitId;
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
