import { copy } from '../copy.js';
import { BERLIN, ForecastShapeError, localDateHour, normalizeForecast } from '../domain/forecast.js';
import { DEFAULTS } from '../domain/recommendation.js';

export const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
export const PRIMARY_MODEL = 'dwd_icon_d2';
export const FALLBACK_MODEL = 'auto';
export const WEATHER_TIMEOUT_MS = 8000;
export const CACHE_KEY = 'toddler-outfit-advisor:forecast:v1';

const CURRENT_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m'
];

const HOURLY_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m',
  'wind_gusts_10m',
  'is_day'
];

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'precipitation_probability_max',
  'precipitation_sum',
  'sunrise',
  'sunset'
];

export class WeatherServiceError extends Error {
  constructor(code, { status, cause } = {}) {
    super(`Weather request failed: ${code}${status ? ` (HTTP ${status})` : ''}`, { cause });
    this.name = 'WeatherServiceError';
    this.code = code;
    this.status = status ?? null;
    this.userMessage = code === 'timeout' ? copy.weatherTimeout : copy.weatherError;
  }
}

export function buildForecastUrl({ model = PRIMARY_MODEL } = {}) {
  const endpoint = new URL(FORECAST_ENDPOINT);
  endpoint.search = new URLSearchParams({
    latitude: BERLIN.latitude.toFixed(4),
    longitude: BERLIN.longitude.toFixed(4),
    current: CURRENT_FIELDS.join(','),
    hourly: HOURLY_FIELDS.join(','),
    daily: DAILY_FIELDS.join(','),
    forecast_days: '1',
    timezone: DEFAULTS.timezone,
    models: model
  }).toString();
  return endpoint;
}

async function requestOnce({ model, signal, fetchImpl, timeoutMs, now }) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    let response;
    try {
      response = await fetchImpl(buildForecastUrl({ model }), {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
    } catch (error) {
      if (timedOut) throw new WeatherServiceError('timeout', { cause: error });
      if (signal?.aborted) throw new WeatherServiceError('aborted', { cause: error });
      throw new WeatherServiceError('network', { cause: error });
    }

    if (!response.ok) throw new WeatherServiceError('http', { status: response.status });

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      if (timedOut) throw new WeatherServiceError('timeout', { cause: error });
      throw new WeatherServiceError('invalid-json', { cause: error });
    }

    try {
      return normalizeForecast(payload, { fetchedAt: now().toISOString(), source: model });
    } catch (error) {
      if (error instanceof ForecastShapeError) throw new WeatherServiceError('malformed', { cause: error });
      throw error;
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

// Model availability problems surface as HTTP errors or unusable payloads.
const isAvailabilityIssue = (error) => ['http', 'invalid-json', 'malformed'].includes(error.code);

export async function fetchBerlinForecast({
  signal,
  fetchImpl = globalThis.fetch.bind(globalThis),
  timeoutMs = WEATHER_TIMEOUT_MS,
  now = () => new Date()
} = {}) {
  try {
    return await requestOnce({ model: PRIMARY_MODEL, signal, fetchImpl, timeoutMs, now });
  } catch (error) {
    if (!(error instanceof WeatherServiceError) || !isAvailabilityIssue(error)) throw error;
    return requestOnce({ model: FALLBACK_MODEL, signal, fetchImpl, timeoutMs, now });
  }
}

function safeStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

// Returns the cached forecast for today (fresh or not), or null.
export function readCachedForecast({ storage, now = () => new Date(), maxAgeMinutes = DEFAULTS.cacheMinutes } = {}) {
  const store = safeStorage(storage);
  if (!store) return null;
  try {
    const cached = JSON.parse(store.getItem(CACHE_KEY) ?? 'null');
    if (!cached?.fetchedAt || !Array.isArray(cached.hours) || !cached.day) return null;
    const current = now();
    if (cached.day.date !== localDateHour(current, DEFAULTS.timezone).date) return null;
    const ageMs = current.getTime() - new Date(cached.fetchedAt).getTime();
    return { data: cached, isFresh: ageMs >= 0 && ageMs < maxAgeMinutes * 60_000 };
  } catch {
    return null;
  }
}

export function writeCachedForecast(forecast, { storage } = {}) {
  const store = safeStorage(storage);
  if (!store) return;
  try {
    store.setItem(CACHE_KEY, JSON.stringify(forecast));
  } catch {
    // Storage full or blocked: caching is optional.
  }
}

// Cache-aware entry point used by the app. `force` bypasses the cache.
export async function loadBerlinForecast({ force = false, signal, storage, fetchImpl, now = () => new Date() } = {}) {
  if (!force) {
    const cached = readCachedForecast({ storage, now });
    if (cached?.isFresh) return cached.data;
  }
  const forecast = await fetchBerlinForecast({ signal, fetchImpl, now });
  writeCachedForecast(forecast, { storage });
  return forecast;
}
