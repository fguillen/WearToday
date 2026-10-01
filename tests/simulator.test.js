import { describe, expect, it, vi } from 'vitest';
import { localDateHour } from '../src/domain/forecast.js';
import { DEFAULTS, deriveDaySummary, recommendOutfit } from '../src/domain/recommendation.js';
import {
  createSimClock,
  createSimWeatherService,
  readSimConfig,
  simSearch,
  usesSimulatedWeather
} from '../src/dev/simulator.js';
import { createApp } from '../src/ui/app.js';
import { SCENARIOS, buildRawForecast, normalizedScenario } from './fixtures.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('weather scenarios', () => {
  // Keeps the simulator honest when the thresholds move.
  const EXPECTED = {
    'sunny-hot': 'sunny-hot',
    'warm-dry': 'warm-dry',
    'mild-dry': 'mild-dry',
    'fresh-dry': 'fresh-dry',
    'cold-dry': 'cold-dry',
    'cold-rain': 'cold-rain',
    'hot-rain': 'hot-rain',
    'super-rain': 'super-rain',
    'super-cold': 'super-cold',
    snow: 'super-cold',
    storm: 'hot-rain',
    fog: 'fresh-dry',
    drizzle: 'cold-rain',
    windy: 'mild-dry'
  };

  it('covers every scenario', () => {
    expect(Object.keys(SCENARIOS).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))('%s dresses in %s over the whole day', (scenario, outfitId) => {
    const summary = deriveDaySummary(normalizedScenario(scenario));
    expect(recommendOutfit(summary, DEFAULTS).outfitId).toBe(outfitId);
  });

  it('rains on the snow day and counts drizzle by its amount', () => {
    expect(deriveDaySummary(normalizedScenario('snow')).rainLikely).toBe(true);
    const drizzle = deriveDaySummary(normalizedScenario('drizzle'));
    expect(drizzle.rainLikely).toBe(true);
    expect(drizzle.maxRainProbability).toBeLessThan(DEFAULTS.rainProbabilityThreshold);
  });

  it('shows a windy reason on the windy day', () => {
    expect(deriveDaySummary(normalizedScenario('windy')).reasons.join(' ')).toMatch(/wind/i);
  });

  it('reports the current block for the requested hour', () => {
    const raw = buildRawForecast({ currentHour: 15, perHour: (hour) => ({ temperature: hour }) });
    expect(raw.current.time).toBe('2026-09-25T15:00');
    expect(raw.current.temperature_2m).toBe(15);
  });
});

describe('readSimConfig', () => {
  it('parses scenario, time and state', () => {
    expect(readSimConfig('?fixture=storm&now=15:30&state=stale')).toEqual({ fixture: 'storm', now: '15:30', state: 'stale' });
  });

  it('falls back on unknown or malformed values', () => {
    expect(readSimConfig('?fixture=nope&now=25:00&state=weird')).toEqual({ fixture: null, now: null, state: 'ready' });
    expect(readSimConfig('')).toEqual({ fixture: null, now: null, state: 'ready' });
  });

  it('round-trips through the URL', () => {
    const config = { fixture: 'fog', now: '07:30', state: 'offline' };
    expect(readSimConfig(simSearch(config))).toEqual(config);
    expect(simSearch({ fixture: null, now: null, state: 'ready' })).toBe('');
  });

  it('only simulates the weather for a scenario or a failure state', () => {
    expect(usesSimulatedWeather({ fixture: null, now: '10:00', state: 'ready' })).toBe(false);
    expect(usesSimulatedWeather({ fixture: 'fog', now: null, state: 'ready' })).toBe(true);
    expect(usesSimulatedWeather({ fixture: null, now: null, state: 'offline' })).toBe(true);
  });
});

describe('createSimClock', () => {
  it.each([
    ['summer', '2026-07-01T05:12:40Z'],
    ['winter', '2026-01-15T21:47:00Z']
  ])('freezes today at the given Berlin time in %s', (_, real) => {
    const realNow = new Date(real);
    const now = createSimClock('14:30', realNow);
    const clock = localDateHour(now(), 'Europe/Berlin');
    expect(clock).toEqual({ date: localDateHour(realNow).date, hour: 14 });
    expect(now().getUTCMinutes()).toBe(30);
    expect(now().getTime()).toBe(now().getTime());
  });
});

describe('createSimWeatherService', () => {
  const now = createSimClock('15:00', new Date('2026-09-25T08:00:00Z'));

  function mount(config) {
    const root = document.createElement('div');
    document.body.append(root);
    const app = createApp(root, { weatherService: createSimWeatherService(config, now), drawChart: vi.fn(() => true), now });
    return { app, root };
  }

  it('serves the scenario for the simulated day and hour', async () => {
    vi.useFakeTimers();
    const service = createSimWeatherService({ fixture: 'storm', now: '15:00', state: 'ready' }, now);
    const pending = service.load();
    await vi.advanceTimersByTimeAsync(300);
    const data = await pending;
    expect(data.day.date).toBe('2026-09-25');
    expect(data.current.time).toBe('2026-09-25T15:00');
    expect(data.current.weatherCode).toBe(95);
  });

  it('stays loading until aborted', async () => {
    const service = createSimWeatherService({ fixture: 'fog', now: null, state: 'loading' }, now);
    const controller = new AbortController();
    const pending = service.load({ signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'aborted' });
  });

  it('keeps stale data on screen when the refresh fails', async () => {
    vi.useFakeTimers();
    const { app } = mount({ fixture: 'snow', now: '15:00', state: 'stale' });
    const started = app.start();
    expect(app.getState().weather).toMatchObject({ status: 'loading', isStale: true });
    await vi.advanceTimersByTimeAsync(300);
    await started;
    expect(app.getState().weather).toMatchObject({ status: 'error', isStale: true });
    expect(app.getState().recommendation.outfitId).toBe('super-cold');
    app.destroy();
  });

  it('shows the error state when offline', async () => {
    vi.useFakeTimers();
    const { app } = mount({ fixture: null, now: null, state: 'offline' });
    const started = app.start();
    await vi.advanceTimersByTimeAsync(300);
    await started;
    expect(app.getState().weather).toMatchObject({ status: 'error', data: null });
    app.destroy();
  });

  it('does not render into the page after the app is destroyed', async () => {
    const { app, root } = mount({ fixture: 'windy', now: null, state: 'ready' });
    app.start();
    app.destroy();
    root.innerHTML = 'replaced';
    await new Promise((resolve) => setTimeout(resolve, 350));
    await flush();
    expect(root.innerHTML).toBe('replaced');
  });
});
