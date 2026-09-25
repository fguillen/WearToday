import { describe, expect, it } from 'vitest';
import {
  ForecastShapeError,
  UNKNOWN_WEATHER,
  currentConditions,
  getWeatherMeta,
  normalizeForecast,
  selectWindowHours
} from '../src/domain/forecast.js';
import { buildRawForecast, rawScenario } from './fixtures.js';

describe('normalizeForecast', () => {
  it('aligns parallel provider arrays by index', () => {
    const raw = buildRawForecast({
      perHour: (hour) => ({ apparent: hour, rainProbability: hour * 2, wind: hour + 100, weatherCode: hour === 13 ? 61 : 2 })
    });
    const forecast = normalizeForecast(raw, { fetchedAt: '2026-09-25T07:05:00.000Z' });

    expect(forecast.hours).toHaveLength(24);
    const thirteen = forecast.hours[13];
    expect(thirteen).toMatchObject({
      time: '2026-09-25T13:00',
      hour: 13,
      apparentTemperatureC: 13,
      precipitationProbabilityPercent: 26,
      windKmh: 113,
      weatherCode: 61
    });
    expect(forecast.fetchedAt).toBe('2026-09-25T07:05:00.000Z');
    expect(forecast.location.label).toBe('Berlin');
    expect(forecast.timezone).toBe('Europe/Berlin');
    expect(forecast.day).toMatchObject({ date: '2026-09-25', sunrise: '2026-09-25T06:53' });
  });

  it('normalizes the current block', () => {
    const forecast = normalizeForecast(rawScenario('cold-rain'));
    expect(forecast.current).toMatchObject({ time: '2026-09-25T09:00', weatherCode: 3, cloudCoverPercent: 95 });
  });

  it('turns missing optional values into null', () => {
    const raw = buildRawForecast();
    delete raw.hourly.wind_gusts_10m;
    raw.hourly.precipitation_probability[10] = null;
    delete raw.daily;

    const forecast = normalizeForecast(raw);
    expect(forecast.hours[10].precipitationProbabilityPercent).toBeNull();
    expect(forecast.hours[0].windGustKmh).toBeNull();
    expect(forecast.day.date).toBe('2026-09-25');
    expect(forecast.day.highC).toBeNull();
  });

  it('falls back to the hourly value when current is missing', () => {
    const forecast = normalizeForecast(buildRawForecast({ omitCurrent: true }));
    expect(forecast.current).toBeNull();
    expect(currentConditions(forecast).time).toBe('2026-09-25T00:00');
  });

  it.each([
    ['null payload', null],
    ['missing hourly', { current: {} }],
    ['empty hourly.time', { hourly: { time: [] } }],
    ['bad time strings', { hourly: { time: ['yesterday'] } }],
    ['no temperatures', { hourly: { time: ['2026-09-25T08:00'] } }]
  ])('rejects a malformed payload: %s', (_, payload) => {
    expect(() => normalizeForecast(payload)).toThrow(ForecastShapeError);
  });
});

describe('selectWindowHours', () => {
  it('selects only the 08:00–17:00 local hours', () => {
    const forecast = normalizeForecast(buildRawForecast());
    const window = selectWindowHours(forecast.hours, 8, 17);
    expect(window.map((hour) => hour.hour)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });
});

describe('getWeatherMeta', () => {
  it('maps known WMO codes', () => {
    expect(getWeatherMeta(0)).toEqual({ label: 'Clear sky', icon: 'sun' });
    expect(getWeatherMeta(61).icon).toBe('rain');
    expect(getWeatherMeta(95).icon).toBe('storm');
  });

  it('falls back for unknown codes', () => {
    expect(getWeatherMeta(42)).toBe(UNKNOWN_WEATHER);
    expect(getWeatherMeta(null)).toBe(UNKNOWN_WEATHER);
  });
});
