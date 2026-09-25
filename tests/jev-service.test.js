import { describe, expect, it, vi } from 'vitest';
import { DEFAULTS, deriveDaySummary } from '../src/domain/recommendation.js';
import {
  JEV_ENDPOINT,
  JEV_MODEL,
  JevServiceError,
  buildJevRequest,
  normalizeJevResponse,
  requestJevDecision
} from '../src/services/jev-service.js';
import { jevResponse, jsonResponse, normalizedScenario } from './fixtures.js';

const API_KEY = 'sk-or-v1-test-secret-key';
const daySummary = deriveDaySummary(normalizedScenario('cold-rain'), DEFAULTS);

describe('buildJevRequest', () => {
  const body = buildJevRequest({ daySummary });

  it('uses the pinned model', () => {
    expect(body.model).toBe(JEV_MODEL);
    expect(body.model).toBe('typesafe/jev-1.13');
  });

  it('sends only the weather summary and catalog', () => {
    expect(body.state.location).toBe('Berlin');
    expect(body.state.assessment_window).toBe('08:00–17:00 Europe/Berlin');
    expect(body.state.weather).toEqual({
      min_apparent_c: 7.4,
      max_apparent_c: 11.9,
      rain_likely: true,
      max_rain_probability_percent: 70,
      precipitation_total_mm: 2,
      sunny_fraction: 0,
      max_wind_kmh: 22
    });
    expect(Object.keys(body.state.available_outfits)).toEqual(['sunny-hot', 'mild-dry', 'fresh-dry', 'cold-dry', 'cold-rain']);
    expect(body.state.available_outfits['sunny-hot']).toMatch(/^Short-sleeve T-shirt, shorts and sandals\./);
    expect(JSON.stringify(body)).not.toMatch(/latitude|hours/);
  });

  it('asks the three typed questions', () => {
    expect(body.questions.recommended_outfit.type).toBe('choice');
    expect(Object.keys(body.questions.recommended_outfit.criteria)).toHaveLength(5);
    expect(body.questions.rain_gear_required.type).toBe('noul');
    expect(body.questions.warmth_level.type).toBe('score');
    expect(body.questions.warmth_level.criteria).toHaveLength(4);
  });
});

describe('requestJevDecision', () => {
  it('posts to the Decisions endpoint with bearer auth and JSON body', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(jevResponse()));
    await requestJevDecision({ apiKey: API_KEY, daySummary, fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(JEV_ENDPOINT);
    expect(url).toBe('https://openrouter.ai/api/alpha/decisions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body).model).toBe('typesafe/jev-1.13');
    expect(init.body).not.toContain(API_KEY);
  });

  it('normalizes a successful response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(jevResponse()));
    await expect(requestJevDecision({ apiKey: API_KEY, daySummary, fetchImpl })).resolves.toEqual({
      requested: true,
      accepted: false,
      type: 'choice',
      outfitId: 'cold-rain',
      confidence: 0.82,
      rainGearProbability: 0.97,
      warmthScore: 2.89,
      source: 'jev'
    });
  });

  it('throws a typed error on HTTP failure without leaking the key or body', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { message: `bad key ${API_KEY}` } }, { status: 401 }));
    const error = await requestJevDecision({ apiKey: API_KEY, daySummary, fetchImpl }).catch((caught) => caught);
    expect(error).toBeInstanceOf(JevServiceError);
    expect(error.code).toBe('unauthorized');
    expect(error.message).not.toContain(API_KEY);
    expect(JSON.stringify(error)).not.toContain(API_KEY);
    expect(String(error.stack)).not.toContain(API_KEY);
  });

  it('maps a server error to http', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, { status: 500 }));
    await expect(requestJevDecision({ apiKey: API_KEY, daySummary, fetchImpl })).rejects.toMatchObject({ code: 'http', status: 500 });
  });

  it('maps a network/CORS failure without attaching the original error', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError(`Failed to fetch with ${API_KEY}`); });
    const error = await requestJevDecision({ apiKey: API_KEY, daySummary, fetchImpl }).catch((caught) => caught);
    expect(error.code).toBe('network');
    expect(error.cause).toBeUndefined();
    expect(error.message).not.toContain(API_KEY);
  });

  it('rejects a malformed response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ answers: {} }));
    await expect(requestJevDecision({ apiKey: API_KEY, daySummary, fetchImpl })).rejects.toMatchObject({ code: 'malformed' });
  });

  it('refuses to call without a key', async () => {
    const fetchImpl = vi.fn();
    await expect(requestJevDecision({ apiKey: '', daySummary, fetchImpl })).rejects.toMatchObject({ code: 'missing-key' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('normalizeJevResponse', () => {
  it('tolerates missing secondary answers', () => {
    const decision = normalizeJevResponse({ answers: { recommended_outfit: { type: 'choice', choice: 'mild-dry', confidence: 0.7 } } });
    expect(decision).toMatchObject({ outfitId: 'mild-dry', rainGearProbability: null, warmthScore: null });
  });

  it('keeps the answer type for validation', () => {
    expect(normalizeJevResponse(jevResponse({ type: 'score' })).type).toBe('score');
  });
});
