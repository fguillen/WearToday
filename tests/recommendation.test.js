import { describe, expect, it } from 'vitest';
import { OUTFITS, getOutfitById } from '../src/data/outfits.js';
import { normalizeForecast } from '../src/domain/forecast.js';
import {
  DEFAULTS,
  InsufficientForecastError,
  deriveDaySummary,
  recommendOutfit
} from '../src/domain/recommendation.js';
import { buildRawForecast, normalizedScenario } from './fixtures.js';

const recommendFor = (name) => {
  const summary = deriveDaySummary(normalizedScenario(name), DEFAULTS);
  return { summary, recommendation: recommendOutfit(summary, DEFAULTS) };
};

describe('outfit catalog', () => {
  it('has exactly the five canonical outfits', () => {
    expect(OUTFITS.map((outfit) => outfit.id)).toEqual(['sunny-hot', 'mild-dry', 'fresh-dry', 'cold-dry', 'cold-rain']);
  });

  it('lists the cold & rainy garments', () => {
    expect(getOutfitById('cold-rain').garments).toEqual([
      'Long pants', 'Long-sleeve T-shirt', 'Sweater', 'Jacket', 'Scarf', 'Hat', 'Umbrella', 'Socks', 'Waterproof shoes', 'Rain pants'
    ]);
  });
});

describe('deriveDaySummary', () => {
  it('summarizes the kindergarten window only', () => {
    const { summary } = recommendFor('cold-rain');
    expect(summary.window).toEqual({ start: '08:00', end: '17:00', hourCount: 10 });
    expect(summary.minApparentC).toBe(7.4);
    expect(summary.maxApparentC).toBe(11.9);
    expect(summary.rainLikely).toBe(true);
    expect(summary.maxRainProbability).toBe(70);
    expect(summary.precipitationTotalMm).toBe(2);
    expect(summary.firstRainHour).toBe(14);
    expect(summary.maxWindKmh).toBe(22);
    expect(summary.sunnyFraction).toBe(0);
  });

  it('ignores cold nights and night-time rain outside the window', () => {
    expect(recommendFor('cold-dry').summary.minApparentC).toBe(3);
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
      'Rain likely after lunch (up to 70%)',
      'Feels like 7°C at drop-off',
      'Breezy — up to 22 km/h'
    ]);
  });

  it('throws when the window has no usable temperatures', () => {
    const forecast = normalizeForecast(
      buildRawForecast({ perHour: (hour) => (hour >= 8 && hour <= 17 ? { apparent: null, temperature: null } : {}) })
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
    ['cold-rain', 'cold-rain']
  ])('%s weather → %s outfit', (scenario, expected) => {
    const { recommendation } = recommendFor(scenario);
    expect(recommendation.outfitId).toBe(expected);
    expect(recommendation.addOns).toEqual([]);
    expect(recommendation.source).toBe('rules');
  });

  it('keeps a dry base outfit and adds rain gear on a warm rainy day', () => {
    const { summary, recommendation } = recommendFor('warm-rain');
    expect(summary.rainLikely).toBe(true);
    expect(recommendation.outfitId).toBe('mild-dry');
    expect(recommendation.addOns).toEqual(['rain-gear']);
  });

  it('never picks sunny-hot on a hot but rainy day', () => {
    const forecast = normalizeForecast(
      buildRawForecast({ perHour: () => ({ apparent: 25, cloudCover: 10, rainProbability: 60 }) })
    );
    const recommendation = recommendOutfit(deriveDaySummary(forecast));
    expect(recommendation.outfitId).toBe('mild-dry');
    expect(recommendation.addOns).toEqual(['rain-gear']);
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
