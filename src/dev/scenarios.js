// Deterministic Open-Meteo-shaped weather scenarios. Used by unit tests (via
// tests/fixtures.js) and by the development-only weather simulator.
import { normalizeForecast } from '../domain/forecast.js';

export const FIXTURE_DATE = '2026-09-25';

const pad = (value) => String(value).padStart(2, '0');
const inDay = (hour) => hour >= 7 && hour <= 22;

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

// `perHour(hour)` returns overrides for that local hour. `currentHour` is the
// hour the provider's "current" block reports.
export function buildRawForecast({ date = FIXTURE_DATE, perHour = () => ({}), omitCurrent = false, currentHour = 9 } = {}) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    ...BASE_HOUR,
    isDay: hour >= 7 && hour <= 19 ? 1 : 0,
    ...perHour(hour)
  }));
  const pick = (key) => hours.map((entry) => entry[key]);
  const now = hours[currentHour];
  const apparent = pick('apparent');
  const temperature = pick('temperature');

  const raw = {
    latitude: 52.52,
    longitude: 13.419998,
    timezone: 'Europe/Berlin',
    timezone_abbreviation: 'GMT+2',
    current: {
      time: `${date}T${pad(currentHour)}:00`,
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
  // Hot, clear and dry all day; a late-night shower must be ignored.
  'sunny-hot': (hour) =>
    inDay(hour)
      ? { temperature: 24 + (hour - 8) * 0.6, apparent: 23 + (hour - 8) * 0.6, cloudCover: 10, weatherCode: 0, rainProbability: 5 }
      : { temperature: 17, apparent: 16, cloudCover: 30, weatherCode: 1, rainProbability: hour === 23 ? 80 : 0 },
  // Mild, partly cloudy, dry.
  'mild-dry': (hour) =>
    inDay(hour)
      ? { temperature: 19 + (hour - 8) * 0.3, apparent: 17 + (hour - 8) * 0.3, cloudCover: 60, weatherCode: 2, rainProbability: 10 }
      : { temperature: 14, apparent: 13, cloudCover: 70, weatherCode: 3 },
  // Fresh, overcast, dry, breezy.
  'fresh-dry': (hour) =>
    inDay(hour)
      ? { temperature: 13 + (hour - 8) * 0.4, apparent: 10 + (hour - 8) * 0.4, cloudCover: 90, weatherCode: 3, rainProbability: 20, wind: 22 }
      : { temperature: 9, apparent: 7, cloudCover: 90, weatherCode: 3 },
  // Cold and dry; the night is even colder but after the default outfit hours.
  'cold-dry': (hour) =>
    inDay(hour)
      ? { temperature: 6 + (hour - 8) * 0.5, apparent: 3 + (hour - 8) * 0.5, cloudCover: 30, weatherCode: 1, rainProbability: 5 }
      : { temperature: 1, apparent: -2, cloudCover: 20, weatherCode: 0 },
  // Cold with rain arriving after lunch.
  'cold-rain': (hour) =>
    inDay(hour)
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
  'hot-rain': (hour) =>
    inDay(hour)
      ? {
          temperature: 20 + (hour - 8) * 0.3,
          apparent: 18 + (hour - 8) * 0.3,
          cloudCover: 80,
          weatherCode: hour === 15 ? 80 : 2,
          rainProbability: hour === 15 ? 60 : 25,
          precipitation: hour === 15 ? 0.4 : 0
        }
      : { temperature: 16, apparent: 15, cloudCover: 80, weatherCode: 3 },
  // Mild but pouring from late morning on: 1 mm/h over 8 hours.
  'super-rain': (hour) =>
    inDay(hour)
      ? {
          temperature: 15,
          apparent: 13,
          cloudCover: 100,
          weatherCode: hour >= 10 && hour <= 17 ? 65 : 3,
          rainProbability: hour >= 10 && hour <= 17 ? 90 : 40,
          precipitation: hour >= 10 && hour <= 17 ? 1 : 0,
          wind: 18
        }
      : { temperature: 13, apparent: 11, cloudCover: 100, weatherCode: 3 },
  // Freezing morning that barely climbs above zero.
  'super-cold': (hour) =>
    inDay(hour)
      ? { temperature: 0 + (hour - 8) * 0.4, apparent: -3 + (hour - 8) * 0.4, cloudCover: 40, weatherCode: 1, rainProbability: 5 }
      : { temperature: -4, apparent: -8, cloudCover: 20, weatherCode: 0 },
  // Snowing all day below freezing: snow icons, and freezing beats the rain rules.
  snow: (hour) =>
    inDay(hour)
      ? {
          temperature: -1 + (hour - 8) * 0.2,
          apparent: -5 + (hour - 8) * 0.2,
          cloudCover: 100,
          weatherCode: hour >= 9 && hour <= 16 ? (hour >= 12 ? 73 : 71) : 3,
          rainProbability: hour >= 9 && hour <= 16 ? 85 : 30,
          precipitation: hour >= 9 && hour <= 16 ? 0.4 : 0,
          wind: 15
        }
      : { temperature: -3, apparent: -7, cloudCover: 90, weatherCode: 3 },
  // Warm and sticky with an afternoon thunderstorm and strong gusts.
  storm: (hour) =>
    inDay(hour)
      ? {
          temperature: 23 + (hour - 8) * 0.3,
          apparent: 24 + (hour - 8) * 0.3,
          cloudCover: hour >= 14 && hour <= 17 ? 100 : 50,
          weatherCode: hour >= 15 && hour <= 17 ? 95 : hour === 14 ? 3 : 2,
          rainProbability: hour >= 15 && hour <= 17 ? 80 : 20,
          precipitation: hour >= 15 && hour <= 17 ? 1.2 : 0,
          wind: hour >= 15 && hour <= 17 ? 35 : 12,
          gust: hour >= 15 && hour <= 17 ? 60 : 20
        }
      : { temperature: 19, apparent: 19, cloudCover: 60, weatherCode: 2 },
  // Foggy morning that lifts into a fresh, dry, grey day.
  fog: (hour) =>
    inDay(hour)
      ? {
          temperature: 11 + (hour - 8) * 0.4,
          apparent: 10 + (hour - 8) * 0.4,
          cloudCover: hour <= 10 ? 100 : 75,
          weatherCode: hour <= 9 ? 48 : hour === 10 ? 45 : 3,
          rainProbability: 10,
          wind: 5
        }
      : { temperature: 9, apparent: 8, cloudCover: 100, weatherCode: 45 },
  // Grey drizzle all day: low probabilities, but the total amount counts as rain.
  drizzle: (hour) =>
    inDay(hour)
      ? {
          temperature: 10,
          apparent: 8,
          cloudCover: 100,
          weatherCode: hour % 3 === 0 ? 53 : 51,
          rainProbability: 35,
          precipitation: 0.1,
          wind: 14
        }
      : { temperature: 9, apparent: 7, cloudCover: 100, weatherCode: 3 },
  // Mild and dry but very windy.
  windy: (hour) =>
    inDay(hour)
      ? {
          temperature: 19 + (hour - 8) * 0.2,
          apparent: 17 + (hour - 8) * 0.2,
          cloudCover: 55,
          weatherCode: 2,
          rainProbability: 15,
          wind: hour >= 11 && hour <= 18 ? 45 : 30,
          gust: hour >= 11 && hour <= 18 ? 70 : 45
        }
      : { temperature: 15, apparent: 13, cloudCover: 60, weatherCode: 3, wind: 25 }
};

export function rawScenario(name, options = {}) {
  const perHour = SCENARIOS[name];
  if (!perHour) throw new Error(`Unknown fixture: ${name}`);
  return buildRawForecast({ ...options, perHour });
}

export function normalizedScenario(name, { fetchedAt = '2026-09-25T07:05:00.000Z', ...options } = {}) {
  return normalizeForecast(rawScenario(name, options), { fetchedAt, source: 'fixture' });
}
