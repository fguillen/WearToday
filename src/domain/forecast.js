// Converts provider JSON into the app-owned forecast shape and offers small
// helpers over it. Nothing outside this module reads Open-Meteo JSON directly.

export const WEATHER_META = {
  0: { label: 'Clear sky', icon: 'sun' },
  1: { label: 'Mostly clear', icon: 'sun-cloud' },
  2: { label: 'Partly cloudy', icon: 'cloud-sun' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Foggy', icon: 'fog' },
  48: { label: 'Icy fog', icon: 'fog' },
  51: { label: 'Light drizzle', icon: 'drizzle' },
  53: { label: 'Drizzle', icon: 'drizzle' },
  55: { label: 'Heavy drizzle', icon: 'drizzle' },
  61: { label: 'Light rain', icon: 'rain' },
  63: { label: 'Rain', icon: 'rain' },
  65: { label: 'Heavy rain', icon: 'rain' },
  71: { label: 'Light snow', icon: 'snow' },
  73: { label: 'Snow', icon: 'snow' },
  75: { label: 'Heavy snow', icon: 'snow' },
  80: { label: 'Rain showers', icon: 'rain' },
  81: { label: 'Heavy showers', icon: 'rain' },
  82: { label: 'Violent showers', icon: 'rain' },
  95: { label: 'Thunderstorm', icon: 'storm' },
  96: { label: 'Thunderstorm with hail', icon: 'storm' },
  99: { label: 'Severe thunderstorm with hail', icon: 'storm' }
};

export const UNKNOWN_WEATHER = { label: 'Unknown conditions', icon: 'unknown' };

export const BERLIN = { label: 'Berlin', latitude: 52.52, longitude: 13.405 };

const LOCAL_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export class ForecastShapeError extends Error {
  constructor(detail) {
    super(`Malformed forecast payload: ${detail}`);
    this.name = 'ForecastShapeError';
  }
}

export function getWeatherMeta(code) {
  return WEATHER_META[code] ?? UNKNOWN_WEATHER;
}

const toNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const at = (array, index) => (Array.isArray(array) ? toNumber(array[index]) : null);
const stringAt = (array, index) => (Array.isArray(array) && typeof array[index] === 'string' ? array[index] : null);

export function normalizeForecast(raw, { fetchedAt = new Date().toISOString(), source = 'dwd_icon_d2' } = {}) {
  if (!raw || typeof raw !== 'object') throw new ForecastShapeError('not an object');

  const hourly = raw.hourly;
  if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) {
    throw new ForecastShapeError('missing hourly.time');
  }

  const hours = hourly.time.map((time, index) => {
    if (typeof time !== 'string' || !LOCAL_TIME_PATTERN.test(time)) {
      throw new ForecastShapeError(`invalid hourly time at index ${index}`);
    }
    return {
      time,
      hour: Number(time.slice(11, 13)),
      temperatureC: at(hourly.temperature_2m, index),
      apparentTemperatureC: at(hourly.apparent_temperature, index),
      precipitationProbabilityPercent: at(hourly.precipitation_probability, index),
      precipitationMm: at(hourly.precipitation, index),
      weatherCode: at(hourly.weather_code, index),
      cloudCoverPercent: at(hourly.cloud_cover, index),
      windKmh: at(hourly.wind_speed_10m, index),
      windGustKmh: at(hourly.wind_gusts_10m, index),
      isDay: at(hourly.is_day, index)
    };
  });

  if (!hours.some((hour) => hour.apparentTemperatureC !== null || hour.temperatureC !== null)) {
    throw new ForecastShapeError('no temperature values');
  }

  const current = raw.current && typeof raw.current === 'object'
    ? {
        time: typeof raw.current.time === 'string' ? raw.current.time : null,
        temperatureC: toNumber(raw.current.temperature_2m),
        apparentTemperatureC: toNumber(raw.current.apparent_temperature),
        precipitationMm: toNumber(raw.current.precipitation),
        weatherCode: toNumber(raw.current.weather_code),
        cloudCoverPercent: toNumber(raw.current.cloud_cover),
        windKmh: toNumber(raw.current.wind_speed_10m)
      }
    : null;

  const daily = raw.daily ?? {};
  const day = {
    date: stringAt(daily.time, 0) ?? hours[0].time.slice(0, 10),
    lowC: at(daily.temperature_2m_min, 0),
    highC: at(daily.temperature_2m_max, 0),
    apparentLowC: at(daily.apparent_temperature_min, 0),
    apparentHighC: at(daily.apparent_temperature_max, 0),
    precipitationProbabilityMaxPercent: at(daily.precipitation_probability_max, 0),
    precipitationTotalMm: at(daily.precipitation_sum, 0),
    weatherCode: at(daily.weather_code, 0),
    sunrise: stringAt(daily.sunrise, 0),
    sunset: stringAt(daily.sunset, 0)
  };

  return {
    location: { ...BERLIN },
    timezone: typeof raw.timezone === 'string' ? raw.timezone : 'Europe/Berlin',
    fetchedAt,
    source,
    current,
    hours,
    day
  };
}

// Hours are local Berlin time, so filtering by the hour field is enough.
export function selectWindowHours(hours, startHour, endHour) {
  return hours.filter((hour) => hour.hour >= startHour && hour.hour <= endHour);
}

// Wall-clock date and hour in the forecast's timezone, e.g. { date: '2026-09-25', hour: 9 }.
export function localDateHour(date, timeZone = 'Europe/Berlin') {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', timeZone })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

// Index of the hour we are in now, or -1 when `now` falls outside `hours`
// (another day, or before/after the tracked range).
export function currentHourIndex(hours, now, timeZone = 'Europe/Berlin') {
  const { date, hour } = localDateHour(now, timeZone);
  const key = `${date}T${String(hour).padStart(2, '0')}:00`;
  return hours.findIndex((entry) => entry.time === key);
}

export function feelsLike(hour) {
  return hour.apparentTemperatureC ?? hour.temperatureC;
}

// The "now" values for the snapshot; falls back to the matching hour when the
// provider omits the current block.
export function currentConditions(forecast) {
  if (forecast.current && (forecast.current.temperatureC !== null || forecast.current.apparentTemperatureC !== null)) {
    return forecast.current;
  }
  const hour = forecast.hours.find((entry) => entry.time === forecast.current?.time) ?? forecast.hours[0];
  return {
    time: hour.time,
    temperatureC: hour.temperatureC,
    apparentTemperatureC: hour.apparentTemperatureC,
    precipitationMm: hour.precipitationMm,
    weatherCode: hour.weatherCode,
    cloudCoverPercent: hour.cloudCoverPercent,
    windKmh: hour.windKmh
  };
}
