import { describe, expect, it } from 'vitest';
import { DEFAULTS, deriveDaySummary } from '../src/domain/recommendation.js';
import { REJECTION_REASONS, validateAiDecision } from '../src/domain/validators.js';
import { normalizedScenario } from './fixtures.js';

const summaryFor = (name) => deriveDaySummary(normalizedScenario(name), DEFAULTS);

const decision = (overrides = {}) => ({
  requested: true,
  accepted: false,
  type: 'choice',
  outfitId: 'cold-rain',
  confidence: 0.82,
  rainGearProbability: 0.97,
  warmthScore: 2.89,
  source: 'jev',
  ...overrides
});

const validate = (scenario, overrides) =>
  validateAiDecision({ decision: decision(overrides), daySummary: summaryFor(scenario) });

describe('validateAiDecision', () => {
  it('accepts a sensible choice', () => {
    expect(validate('cold-rain')).toEqual({ accepted: true, reason: null });
  });

  it('rejects an outfit ID absent from the catalog', () => {
    expect(validate('cold-rain', { outfitId: 'snowsuit' }).reason).toBe(REJECTION_REASONS.unknownOutfit);
  });

  it('rejects low or missing confidence', () => {
    expect(validate('cold-rain', { confidence: 0.59 }).reason).toBe(REJECTION_REASONS.lowConfidence);
    expect(validate('cold-rain', { confidence: null }).reason).toBe(REJECTION_REASONS.lowConfidence);
    expect(validate('cold-rain', { confidence: 0.6 }).accepted).toBe(true);
  });

  it('rejects a non-choice answer type', () => {
    expect(validate('cold-rain', { type: 'score' }).reason).toBe(REJECTION_REASONS.invalidType);
  });

  it('rejects a dry outfit on a cold rainy day', () => {
    expect(validate('cold-rain', { outfitId: 'cold-dry' }).reason).toBe(REJECTION_REASONS.rainInadequate);
  });

  it('accepts a dry base outfit on a warm rainy day (rain-gear add-on path)', () => {
    expect(validate('warm-rain', { outfitId: 'mild-dry' }).accepted).toBe(true);
  });

  it('rejects an outfit without jacket, hat and scarf when it feels below 9°C', () => {
    expect(validate('cold-dry', { outfitId: 'fresh-dry', rainGearProbability: 0.05 }).reason).toBe(
      REJECTION_REASONS.coldInadequate
    );
    expect(validate('cold-dry', { outfitId: 'cold-dry', rainGearProbability: 0.05 }).accepted).toBe(true);
  });

  it('rejects cold-weather layers on a hot sunny day', () => {
    expect(validate('sunny-hot', { outfitId: 'fresh-dry', rainGearProbability: 0.05 }).reason).toBe(
      REJECTION_REASONS.overLayered
    );
    expect(validate('sunny-hot', { outfitId: 'sunny-hot', rainGearProbability: 0.05 }).accepted).toBe(true);
  });

  it('rejects a rain-gate answer that strongly conflicts with the forecast', () => {
    expect(validate('cold-rain', { rainGearProbability: 0.1 }).reason).toBe(REJECTION_REASONS.rainConflict);
    expect(validate('mild-dry', { outfitId: 'mild-dry', rainGearProbability: 0.95 }).reason).toBe(
      REJECTION_REASONS.rainConflict
    );
  });

  it.each([
    ['null decision', null],
    ['non-object', 'cold-rain'],
    ['missing outfitId', { type: 'choice', confidence: 0.9 }]
  ])('rejects an invalid response shape: %s', (_, value) => {
    expect(validateAiDecision({ decision: value, daySummary: summaryFor('cold-rain') }).reason).toBe(
      REJECTION_REASONS.invalidShape
    );
  });
});
