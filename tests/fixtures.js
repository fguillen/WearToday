// Deterministic Open-Meteo-shaped fixtures. Used by unit tests and by the
// development-only `?fixture=<name>` switch in src/main.js.
import { normalizeForecast } from '../src/domain/forecast.js';
import { WeatherServiceError } from '../src/services/weather-service.js';

export const FIXTURE_DATE = '2026-09-25';

const pad = (value) => String(value).padStart(2, '0');
const inWindow = (hour) => hour >= 8 && hour <= 17;

const BASE_HOUR = {
  temperature: 12,
  apparent: 10,
  rainProbability: 0,
  precipitation: 0,
  weatherCode: 2,
  cloudCover: 50,
  wind: 10,
  gust: 18
};

// `perHour(hour)` returns overrides for that local hour.
export function buildRawForecast({ date = FIXTURE_DATE, perHour = () => ({}), omitCurrent = false } = {}) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    ...BASE_HOUR,
    isDay: hour >= 7 && hour <= 19 ? 1 : 0,
    ...perHour(hour)
  }));
  const pick = (key) => hours.map((entry) => entry[key]);
  const now = hours[9];
  const apparent = pick('apparent');
  const temperature = pick('temperature');

  const raw = {
    latitude: 52.52,
    longitude: 13.419998,
    timezone: 'Europe/Berlin',
    timezone_abbreviation: 'GMT+2',
    current: {
      time: `${date}T09:00`,
      interval: 900,
      temperature_2m: now.temperature,
      apparent_temperature: now.apparent,
      precipitation: now.precipitation,
      weather_code: now.weatherCode,
      cloud_cover: now.cloudCover,
      wind_speed_10m: now.wind
    },
    hourly: {
      time: hours.map((_, hour) => `${date}T${pad(hour)}:00`),
      temperature_2m: temperature,
      apparent_temperature: apparent,
      precipitation_probability: pick('rainProbability'),
      precipitation: pick('precipitation'),
      weather_code: pick('weatherCode'),
      cloud_cover: pick('cloudCover'),
      wind_speed_10m: pick('wind'),
      wind_gusts_10m: pick('gust'),
      is_day: pick('isDay')
    },
    daily: {
      time: [date],
      weather_code: [Math.max(...pick('weatherCode'))],
      temperature_2m_max: [Math.max(...temperature)],
      temperature_2m_min: [Math.min(...temperature)],
      apparent_temperature_max: [Math.max(...apparent)],
      apparent_temperature_min: [Math.min(...apparent)],
      precipitation_probability_max: [Math.max(...pick('rainProbability'))],
      precipitation_sum: [Math.round(pick('precipitation').reduce((a, b) => a + b, 0) * 10) / 10],
      sunrise: [`${date}T06:53`],
      sunset: [`${date}T19:05`]
    }
  };
  if (omitCurrent) delete raw.current;
  return raw;
}

export const SCENARIOS = {
  // Hot, clear and dry in the window; a night-time shower must be ignored.
  'sunny-hot': (hour) =>
    inWindow(hour)
      ? { temperature: 24 + (hour - 8) * 0.6, apparent: 23 + (hour - 8) * 0.6, cloudCover: 10, weatherCode: 0, rainProbability: 5 }
      : { temperature: 17, apparent: 16, cloudCover: 30, weatherCode: 1, rainProbability: hour === 22 ? 80 : 0 },
  // Mild, partly cloudy, dry.
  'mild-dry': (hour) =>
    inWindow(hour)
      ? { temperature: 19 + (hour - 8) * 0.3, apparent: 17 + (hour - 8) * 0.3, cloudCover: 60, weatherCode: 2, rainProbability: 10 }
      : { temperature: 14, apparent: 13, cloudCover: 70, weatherCode: 3 },
  // Fresh, overcast, dry, breezy.
  'fresh-dry': (hour) =>
    inWindow(hour)
      ? { temperature: 13 + (hour - 8) * 0.4, apparent: 10 + (hour - 8) * 0.4, cloudCover: 90, weatherCode: 3, rainProbability: 20, wind: 22 }
      : { temperature: 9, apparent: 7, cloudCover: 90, weatherCode: 3 },
  // Cold and dry; the night is even colder but outside the window.
  'cold-dry': (hour) =>
    inWindow(hour)
      ? { temperature: 6 + (hour - 8) * 0.5, apparent: 3 + (hour - 8) * 0.5, cloudCover: 30, weatherCode: 1, rainProbability: 5 }
      : { temperature: 1, apparent: -2, cloudCover: 20, weatherCode: 0 },
  // Cold with rain arriving after lunch.
  'cold-rain': (hour) =>
    inWindow(hour)
      ? {
          temperature: 9 + (hour - 8) * 0.5,
          apparent: 7.4 + (hour - 8) * 0.5,
          cloudCover: 95,
          weatherCode: hour >= 14 ? 61 : 3,
          rainProbability: hour >= 14 ? 70 : 20,
          precipitation: hour >= 14 ? 0.5 : 0,
          wind: 22
        }
      : { temperature: 8, apparent: 6, cloudCover: 95, weatherCode: 3 },
  // Warm but showery.
  'warm-rain': (hour) =>
    inWindow(hour)
      ? {
          temperature: 20 + (hour - 8) * 0.3,
          apparent: 18 + (hour - 8) * 0.3,
          cloudCover: 80,
          weatherCode: hour === 15 ? 80 : 2,
          rainProbability: hour === 15 ? 60 : 25,
          precipitation: hour === 15 ? 0.4 : 0
        }
      : { temperature: 16, apparent: 15, cloudCover: 80, weatherCode: 3 }
};

export function rawScenario(name, options = {}) {
  const perHour = SCENARIOS[name];
  if (!perHour) throw new Error(`Unknown fixture: ${name}`);
  return buildRawForecast({ ...options, perHour });
}

export function normalizedScenario(name, { fetchedAt = '2026-09-25T07:05:00.000Z', ...options } = {}) {
  return normalizeForecast(rawScenario(name, options), { fetchedAt, source: 'fixture' });
}

// Minimal Response stand-in for mocked fetch.
export function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

export function jevResponse({ choice = 'cold-rain', confidence = 0.82, noul = 0.97, score = 2.89, type = 'choice' } = {}) {
  return {
    answers: {
      recommended_outfit: { type, choice, confidence, probabilities: { [choice]: confidence } },
      rain_gear_required: { type: 'noul', noul },
      warmth_level: { type: 'score', score, confidence: 0.95 }
    },
    usage: { input_tokens: 0, output_tokens: 0, cost: 0 }
  };
}

// Dev-only weather service: `?fixture=cold-rain`, or `?fixture=offline` to
// exercise the error state.
export function createFixtureWeatherService(name) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  return {
    readCache: () => null,
    async load() {
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (name === 'offline') throw new WeatherServiceError('network');
      const scenario = SCENARIOS[name] ? name : 'mild-dry';
      return normalizedScenario(scenario, { date: today, fetchedAt: new Date().toISOString() });
    }
  };
}
