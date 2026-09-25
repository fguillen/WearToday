import { describe, expect, it, vi } from 'vitest';
import {
  CACHE_KEY,
  WeatherServiceError,
  buildForecastUrl,
  fetchBerlinForecast,
  loadBerlinForecast,
  readCachedForecast,
  writeCachedForecast
} from '../src/services/weather-service.js';
import { jsonResponse, normalizedScenario, rawScenario } from './fixtures.js';

const NOW = new Date('2026-09-25T07:05:00.000Z');
const now = () => NOW;

describe('buildForecastUrl', () => {
  it('builds the Open-Meteo DWD ICON-D2 request with URLSearchParams', () => {
    const url = buildForecastUrl();
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    const params = url.searchParams;
    expect(params.get('latitude')).toBe('52.5200');
    expect(params.get('longitude')).toBe('13.4050');
    expect(params.get('timezone')).toBe('Europe/Berlin');
    expect(params.get('forecast_days')).toBe('1');
    expect(params.get('models')).toBe('dwd_icon_d2');
    expect(params.get('current').split(',')).toContain('apparent_temperature');
    expect(params.get('hourly').split(',')).toEqual([
      'temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation',
      'weather_code', 'cloud_cover', 'wind_speed_10m', 'wind_gusts_10m', 'is_day'
    ]);
    expect(params.get('daily').split(',')).toContain('precipitation_sum');
  });

  it('supports the auto model fallback', () => {
    expect(buildForecastUrl({ model: 'auto' }).searchParams.get('models')).toBe('auto');
  });
});

describe('fetchBerlinForecast', () => {
  it('returns a normalized forecast on success', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(rawScenario('cold-rain')));
    const forecast = await fetchBerlinForecast({ fetchImpl, now });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toContain('models=dwd_icon_d2');
    expect(forecast.source).toBe('dwd_icon_d2');
    expect(forecast.fetchedAt).toBe(NOW.toISOString());
    expect(forecast.hours).toHaveLength(24);
    expect(forecast.hours[8]).toHaveProperty('apparentTemperatureC', 7.4);
  });

  it('retries once with models=auto when DWD is unavailable', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: true, reason: 'model unavailable' }, { status: 400 }))
      .mockResolvedValueOnce(jsonResponse(rawScenario('mild-dry')));

    const forecast = await fetchBerlinForecast({ fetchImpl, now });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1][0])).toContain('models=auto');
    expect(forecast.source).toBe('auto');
  });

  it('throws a typed error when both attempts fail', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, { status: 503 }));
    const error = await fetchBerlinForecast({ fetchImpl, now }).catch((caught) => caught);
    expect(error).toBeInstanceOf(WeatherServiceError);
    expect(error.code).toBe('http');
    expect(error.status).toBe(503);
    expect(error.userMessage).toMatch(/could not load/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('flags a malformed payload', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ hourly: { time: 'nope' } }));
    await expect(fetchBerlinForecast({ fetchImpl, now })).rejects.toMatchObject({ code: 'malformed' });
  });

  it('flags invalid JSON', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } }));
    await expect(fetchBerlinForecast({ fetchImpl, now })).rejects.toMatchObject({ code: 'invalid-json' });
  });

  it('does not retry a network failure', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    await expect(fetchBerlinForecast({ fetchImpl, now })).rejects.toMatchObject({ code: 'network' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('aborts after 8 seconds', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })
    );
    const pending = fetchBerlinForecast({ fetchImpl, now }).catch((caught) => caught);

    await vi.advanceTimersByTimeAsync(7999);
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    const error = await pending;
    expect(error).toBeInstanceOf(WeatherServiceError);
    expect(error.code).toBe('timeout');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reports a caller abort as aborted', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })
    );
    const pending = fetchBerlinForecast({ fetchImpl, now, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'aborted' });
  });
});

describe('forecast cache', () => {
  it('stores and reads a fresh forecast from sessionStorage', () => {
    const forecast = normalizedScenario('cold-rain', { fetchedAt: NOW.toISOString() });
    writeCachedForecast(forecast);
    expect(sessionStorage.getItem(CACHE_KEY)).toContain('"fetchedAt"');

    const cached = readCachedForecast({ now: () => new Date(NOW.getTime() + 5 * 60_000) });
    expect(cached.isFresh).toBe(true);
    expect(cached.data.hours).toHaveLength(24);
  });

  it('marks a cache older than 15 minutes as stale but still returns it', () => {
    writeCachedForecast(normalizedScenario('cold-rain', { fetchedAt: NOW.toISOString() }));
    const cached = readCachedForecast({ now: () => new Date(NOW.getTime() + 16 * 60_000) });
    expect(cached.isFresh).toBe(false);
  });

  it('ignores a cache from another day', () => {
    writeCachedForecast(normalizedScenario('cold-rain', { fetchedAt: NOW.toISOString() }));
    expect(readCachedForecast({ now: () => new Date('2026-09-26T07:00:00.000Z') })).toBeNull();
  });

  it('loadBerlinForecast uses a fresh cache and bypasses it when forced', async () => {
    writeCachedForecast(normalizedScenario('cold-rain', { fetchedAt: NOW.toISOString() }));
    const fetchImpl = vi.fn(async () => jsonResponse(rawScenario('mild-dry')));

    await loadBerlinForecast({ fetchImpl, now });
    expect(fetchImpl).not.toHaveBeenCalled();

    const fresh = await loadBerlinForecast({ force: true, fetchImpl, now });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fresh.hours[8].apparentTemperatureC).toBe(17);
  });
});
