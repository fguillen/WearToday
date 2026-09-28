import { describe, expect, it, vi } from 'vitest';
import { copy } from '../src/copy.js';
import { WeatherServiceError } from '../src/services/weather-service.js';
import { createApp } from '../src/ui/app.js';
import { normalizedScenario } from './fixtures.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup({ scenario = 'cold-rain', load, readCache = () => null, drawChart = vi.fn(() => true), now } = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  const weatherService = { load: load ?? vi.fn(async () => normalizedScenario(scenario)), readCache };
  const app = createApp(root, { weatherService, drawChart, now });
  const $ = (selector) => root.querySelector(selector);
  return { root, app, $, weatherService, drawChart };
}

describe('app', () => {
  it('shows an accessible loading indicator initially', () => {
    const { app, $ } = setup({ load: () => new Promise(() => {}) });
    app.start();
    expect($('#snapshot [role="status"]').textContent).toBe(copy.loadingForecast);
    expect($('#main').getAttribute('aria-busy')).toBe('true');
  });

  it('renders location, update time, outfit, garments, reasons and hourly rows', async () => {
    const { app, $, root, drawChart } = setup();
    await app.start();

    expect($('#header-meta').textContent).toBe('Berlin · Updated 09:05');
    expect($('#today-heading').textContent).toBe('Today in Berlin · Friday, 25 September');
    expect($('.outfit-name').textContent).toBe('Cold & rainy');
    expect($('.source-line').textContent).toBe(copy.sourceRules);
    expect($('#decision-details').textContent).toContain(copy.rulesDetail);
    const garments = [...root.querySelectorAll('.garment-list li')].map((li) => li.textContent.trim());
    expect(garments).toHaveLength(10);
    expect(garments).toContain('Waterproof shoes (water shoes)');
    expect(root.querySelectorAll('.chips .chip')).toHaveLength(3);
    expect($('.chips').textContent).toContain('Rain likely in the afternoon');
    // 07:00–22:00: the whole tracked day, same data as the chart.
    expect(root.querySelectorAll('.hourly-table tbody tr')).toHaveLength(16);
    expect(drawChart.mock.calls[0][1]).toHaveLength(16);
    expect($('.snapshot').textContent).not.toMatch(/kindergarten/i);
    expect($('svg[role="img"]').getAttribute('aria-label')).toMatch(/^Illustration: Cold & rainy outfit/);
    expect(root.querySelectorAll('svg [data-layer]').length).toBe(11);
    expect($('#main').getAttribute('aria-busy')).toBe('false');
  });

  it('shows a prominent rain-gear note on a warm rainy day', async () => {
    const { app, $ } = setup({ scenario: 'warm-rain' });
    await app.start();
    expect($('.outfit-name').textContent).toBe('Mild & dry');
    expect($('.add-on').textContent).toContain('Pack rain gear');
  });

  it('refresh triggers a forced fetch and announces completion', async () => {
    const { app, $, weatherService } = setup();
    await app.start();
    $('#refresh-button').click();
    await flush();
    expect(weatherService.load).toHaveBeenCalledTimes(2);
    expect(weatherService.load.mock.calls[1][0].force).toBe(true);
    expect($('#announcer').textContent).toMatch(/^Forecast updated at/);
  });

  it('a weather failure shows retry content', async () => {
    const load = vi.fn(async () => { throw new WeatherServiceError('network'); });
    const { app, $ } = setup({ load });
    await app.start();

    expect($('.error-card [role="alert"], .error-card').textContent).toContain(copy.weatherError);
    expect($('#error-retry')).not.toBeNull();

    $('#error-retry').click();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shows cached data with a last-updated notice when the refresh fails', async () => {
    const cached = normalizedScenario('cold-dry');
    const load = vi.fn(async () => { throw new WeatherServiceError('network'); });
    const { app, $ } = setup({ load, readCache: () => ({ data: cached, isFresh: false }) });
    await app.start();

    expect($('.outfit-name').textContent).toBe('Cold & dry');
    expect($('.banner').textContent).toContain('Last updated at 09:05');
    expect($('#banner-retry')).not.toBeNull();
  });

  it('uses a fresh cache without fetching', async () => {
    const { app, weatherService, $ } = setup({ readCache: () => ({ data: normalizedScenario('fresh-dry'), isFresh: true }) });
    await app.start();
    expect(weatherService.load).not.toHaveBeenCalled();
    expect($('.outfit-name').textContent).toBe('Fresh & dry');
    expect($('.banner')).toBeNull();
  });

  it('keeps the hourly table available when the canvas fails', async () => {
    const drawChart = vi.fn(() => { throw new Error('no canvas'); });
    const { app, $, root } = setup({ drawChart });
    await app.start();

    expect($('#chart-wrap').hidden).toBe(true);
    expect($('#chart-unavailable').hidden).toBe(false);
    expect($('#hourly-table-details').open).toBe(true);
    expect(root.querySelectorAll('.hourly-table tbody tr')).toHaveLength(16);
  });

  it('marks the current hour and keeps past hours visible', async () => {
    // 07:30Z is 09:30 in Berlin on the fixture date.
    const { app, $, root, drawChart } = setup({ now: () => new Date('2026-09-25T07:30:00Z') });
    await app.start();

    expect(drawChart.mock.calls[0][2]).toEqual({ currentIndex: 2 });
    const rows = [...root.querySelectorAll('.hourly-table tbody tr')];
    expect(rows).toHaveLength(16);
    expect(rows[2].getAttribute('aria-current')).toBe('time');
    expect(rows[2].textContent).toContain('09:00');
    expect(rows[2].querySelector('.now-tag').textContent).toBe(copy.nowMarker);
    expect(rows.slice(0, 2).every((row) => row.classList.contains('is-past'))).toBe(true);
    expect(rows.slice(3).some((row) => row.classList.contains('is-past'))).toBe(false);
    expect($('.legend').textContent).toContain(copy.legendNow('09:00'));
    // The outfit only covers the hours still ahead.
    expect($('#decision-details').textContent).toContain('Checked 09:00–22:00 (14 hours).');
    expect($('.snapshot').textContent).toContain('The outfit covers 09:00–22:00.');
  });

  it('does not mark any hour when the forecast is for another day', async () => {
    const { app, $, root, drawChart } = setup({ now: () => new Date('2026-09-26T07:30:00Z') });
    await app.start();

    expect(drawChart.mock.calls[0][2]).toEqual({ currentIndex: -1 });
    expect(root.querySelector('[aria-current="time"]')).toBeNull();
    expect($('.legend').textContent).not.toContain(copy.legendPast);
  });

  it('moves the now marker when the clock enters a new hour', async () => {
    vi.useFakeTimers();
    let clock = new Date('2026-09-25T07:59:00Z');
    const { app, root, drawChart } = setup({
      now: () => clock,
      readCache: () => ({ data: normalizedScenario('mild-dry'), isFresh: true })
    });
    await app.start();
    expect(root.querySelector('[aria-current="time"] th').textContent).toMatch(/^09:00/);

    clock = new Date('2026-09-25T08:01:00Z');
    vi.advanceTimersByTime(60_000);
    expect(root.querySelector('[aria-current="time"] th').textContent).toMatch(/^10:00/);
    expect(drawChart.mock.lastCall[2]).toEqual({ currentIndex: 3 });
    expect(app.getState().daySummary.window.start).toBe('10:00');
    app.destroy();
  });

  it('uses the real canvas renderer safely when no 2D context exists', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const app = createApp(root, {
      weatherService: { load: async () => normalizedScenario('mild-dry'), readCache: () => null }
    });
    await app.start();
    expect(root.querySelector('#chart-unavailable').hidden).toBe(false);
    expect(root.querySelector('.hourly-table')).not.toBeNull();
  });
});
