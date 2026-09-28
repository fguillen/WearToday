// Development-only weather simulator: a scenario, a frozen clock and a service
// state, all read from and written to the URL so every view can be bookmarked,
// e.g. /?fixture=storm&now=15:30 or /?fixture=snow&state=stale.
import { localDateHour } from '../domain/forecast.js';
import { DEFAULTS } from '../domain/recommendation.js';
import { WeatherServiceError } from '../services/weather-service.js';
import { SCENARIOS, normalizedScenario } from './scenarios.js';

export const SIM_STATES = ['ready', 'loading', 'offline', 'stale'];
export const DEFAULT_SCENARIO = 'mild-dry';
const LOAD_DELAY_MS = 300;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

// { fixture: scenario name or null (live weather), now: 'HH:MM' or null (real
// time), state: one of SIM_STATES }. Unknown values fall back to the defaults.
export function readSimConfig(search) {
  const params = new URLSearchParams(search);
  const fixture = params.get('fixture');
  const now = params.get('now');
  const state = params.get('state');
  return {
    fixture: fixture && SCENARIOS[fixture] ? fixture : null,
    now: now && HHMM.test(now) ? now : null,
    state: SIM_STATES.includes(state) ? state : 'ready'
  };
}

export function simSearch({ fixture, now, state }) {
  const params = new URLSearchParams();
  if (fixture) params.set('fixture', fixture);
  if (now) params.set('now', now);
  if (state && state !== 'ready') params.set('state', state);
  const search = params.toString();
  return search ? `?${search}` : '';
}

// Live weather unless a scenario or a failure state is being simulated.
export function usesSimulatedWeather(config) {
  return Boolean(config.fixture) || config.state !== 'ready';
}

// A clock frozen at today's `hhmm` in Berlin. Berlin offsets are whole hours,
// so shifting the real time by the wall-clock difference lands on it exactly.
export function createSimClock(hhmm, realNow = new Date()) {
  const [, hours, minutes] = HHMM.exec(hhmm).map(Number);
  const { hour } = localDateHour(realNow, DEFAULTS.timezone);
  const shiftMinutes = (hours - hour) * 60 + (minutes - realNow.getUTCMinutes());
  const frozen = new Date(realNow.getTime() + shiftMinutes * 60_000);
  frozen.setUTCSeconds(0, 0);
  return () => new Date(frozen);
}

function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new WeatherServiceError('aborted'));
    };
    const timer = ms === Infinity ? 0 : setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}

// Weather service with the same interface as the real one ({ load, readCache }).
export function createSimWeatherService(config, now = () => new Date()) {
  const forecast = ({ ageMinutes = 0 } = {}) => {
    const clock = localDateHour(now(), DEFAULTS.timezone);
    return normalizedScenario(config.fixture ?? DEFAULT_SCENARIO, {
      date: clock.date,
      currentHour: clock.hour,
      fetchedAt: new Date(now().getTime() - ageMinutes * 60_000).toISOString()
    });
  };

  return {
    // `stale`: an old cached forecast stays on screen while the refresh fails.
    readCache: () => (config.state === 'stale' ? { data: forecast({ ageMinutes: 90 }), isFresh: false } : null),
    async load({ signal } = {}) {
      await abortableDelay(config.state === 'loading' ? Infinity : LOAD_DELAY_MS, signal);
      if (config.state === 'offline' || config.state === 'stale') throw new WeatherServiceError('network');
      return forecast();
    }
  };
}
