import { describe, expect, it, vi } from 'vitest';
import { copy } from '../src/copy.js';
import { normalizeJevResponse } from '../src/services/jev-service.js';
import { WeatherServiceError } from '../src/services/weather-service.js';
import { createApp } from '../src/ui/app.js';
import { jevResponse, normalizedScenario } from './fixtures.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup({
  scenario = 'cold-rain',
  load,
  readCache = () => null,
  requestDecision,
  drawChart = vi.fn(() => true),
  key = ''
} = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  let storedKey = key;
  const keyStore = {
    get: () => storedKey,
    set: (value) => { storedKey = value; },
    clear: () => { storedKey = ''; }
  };
  const weatherService = { load: load ?? vi.fn(async () => normalizedScenario(scenario)), readCache };
  const jevService = { requestDecision: requestDecision ?? vi.fn(async () => normalizeJevResponse(jevResponse())) };
  const app = createApp(root, { weatherService, jevService, keyStore, drawChart });
  const $ = (selector) => root.querySelector(selector);
  return { root, app, $, weatherService, jevService, keyStore, drawChart };
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
    const garments = [...root.querySelectorAll('.garment-list li')].map((li) => li.textContent.trim());
    expect(garments).toHaveLength(10);
    expect(garments).toContain('Waterproof shoes (water shoes)');
    expect(root.querySelectorAll('.chips .chip')).toHaveLength(3);
    expect($('.chips').textContent).toContain('Rain likely after lunch');
    // 07:00–18:00: the window plus one hour either side, same data as the chart.
    expect(root.querySelectorAll('.hourly-table tbody tr')).toHaveLength(12);
    expect(drawChart.mock.calls[0][1]).toHaveLength(12);
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

  it('opens an accessible key dialog from "Use AI decision"', async () => {
    const { app, $, jevService } = setup();
    await app.start();
    $('#ai-button').click();

    const dialog = $('#key-dialog');
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBe('key-dialog-title');
    const input = $('#openrouter-key');
    expect(input.type).toBe('password');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect($('label[for="openrouter-key"]')).not.toBeNull();
    expect(document.activeElement).toBe(input);
    expect(jevService.requestDecision).not.toHaveBeenCalled();
  });

  it('"Skip AI" leaves the rules recommendation untouched', async () => {
    const { app, $, jevService, keyStore } = setup();
    await app.start();
    $('#ai-button').click();
    $('#openrouter-key').value = 'sk-or-partial';
    $('[data-dialog-action="skip"]').click();

    expect($('#key-dialog').open).toBe(false);
    expect($('#openrouter-key').value).toBe('');
    expect(keyStore.get()).toBe('');
    expect($('.outfit-name').textContent).toBe('Cold & rainy');
    expect($('.source-line').textContent).toBe(copy.sourceRules);
    expect(jevService.requestDecision).not.toHaveBeenCalled();
  });

  it('Escape closes the dialog without saving a partial key', async () => {
    const { app, $, keyStore } = setup();
    await app.start();
    $('#ai-button').click();
    $('#openrouter-key').value = 'sk-or-partial';
    $('#key-dialog').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect($('#key-dialog').open).toBe(false);
    expect(keyStore.get()).toBe('');
    expect($('#openrouter-key').value).toBe('');
  });

  it('entering a key runs Jev and applies an accepted catalog choice', async () => {
    const { app, $, jevService, keyStore } = setup();
    await app.start();
    $('#ai-button').click();
    $('#openrouter-key').value = '  sk-or-test  ';
    $('.key-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    expect($('#openrouter-key').value).toBe('');
    expect(keyStore.get()).toBe('sk-or-test');
    await flush();

    expect(jevService.requestDecision).toHaveBeenCalledTimes(1);
    expect(jevService.requestDecision.mock.calls[0][0].apiKey).toBe('sk-or-test');
    expect($('.source-line').textContent).toBe(copy.sourceAiAccepted);
    expect($('.outfit-name').textContent).toBe('Cold & rainy');
    expect(app.getState().ai.status).toBe('accepted');
    expect($('#decision-details').textContent).toContain('confidence 82%');
    expect($('#announcer').textContent).toContain(copy.sourceAiAccepted);
    expect($('#forget-key-button')).not.toBeNull();
  });

  it('shows a loading label while Jev is thinking', async () => {
    let resolve;
    const requestDecision = vi.fn(() => new Promise((done) => { resolve = done; }));
    const { app, $ } = setup({ key: 'sk-or-test', requestDecision });
    await app.start();
    $('#ai-button').click();

    expect($('#ai-button').disabled).toBe(true);
    expect($('#ai-button').textContent).toBe(copy.checkingOptions);
    expect($('.outfit-name').textContent).toBe('Cold & rainy');

    resolve(normalizeJevResponse(jevResponse()));
    await flush();
    expect($('#ai-button').disabled).toBe(false);
  });

  it('keeps the rules outfit and shows a calm status when Jev is rejected', async () => {
    const requestDecision = vi.fn(async () =>
      normalizeJevResponse(jevResponse({ choice: 'sunny-hot', confidence: 0.9, noul: 0.9 }))
    );
    const { app, $ } = setup({ key: 'sk-or-test', requestDecision });
    await app.start();
    $('#ai-button').click();
    await flush();

    expect(app.getState().ai.status).toBe('rejected');
    expect($('.outfit-name').textContent).toBe('Cold & rainy');
    expect($('.source-line').textContent).toBe(copy.sourceAiRejected);
    expect($('.ai-status').textContent).toBe(copy.aiRejectedStatus);
  });

  it('rejects an AI outfit ID that is not in the catalog', async () => {
    const requestDecision = vi.fn(async () => normalizeJevResponse(jevResponse({ choice: 'snowsuit', confidence: 0.99 })));
    const { app, $ } = setup({ key: 'sk-or-test', requestDecision });
    await app.start();
    $('#ai-button').click();
    await flush();
    expect(app.getState().recommendation.outfitId).toBe('cold-rain');
    expect($('.outfit-name').textContent).toBe('Cold & rainy');
  });

  it('shows a generic message when the AI request fails', async () => {
    const requestDecision = vi.fn(async () => { throw new Error('HTTP 401 sk-or-test'); });
    const { app, $, root } = setup({ key: 'sk-or-test', requestDecision });
    await app.start();
    $('#ai-button').click();
    await flush();

    expect($('.ai-status').textContent).toBe(copy.aiFailed);
    expect($('.outfit-name').textContent).toBe('Cold & rainy');
    expect(root.textContent).not.toContain('sk-or-test');
    expect($('#ai-button').disabled).toBe(false);
    expect($('#forget-key-button')).not.toBeNull();
  });

  it('forget key clears it and returns to weather rules', async () => {
    const { app, $, keyStore } = setup({ key: 'sk-or-test' });
    await app.start();
    $('#ai-button').click();
    await flush();
    $('#forget-key-button').click();

    expect(keyStore.get()).toBe('');
    expect($('.source-line').textContent).toBe(copy.sourceRules);
    expect($('#forget-key-button')).toBeNull();
  });

  it('a weather failure shows retry content and never calls Jev', async () => {
    const load = vi.fn(async () => { throw new WeatherServiceError('network'); });
    const { app, $, jevService } = setup({ load, key: 'sk-or-test' });
    await app.start();

    expect($('.error-card [role="alert"], .error-card').textContent).toContain(copy.weatherError);
    expect($('#error-retry')).not.toBeNull();
    expect($('#ai-button').disabled).toBe(true);
    $('#ai-button').click();
    await flush();
    expect(jevService.requestDecision).not.toHaveBeenCalled();

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
    expect(root.querySelectorAll('.hourly-table tbody tr')).toHaveLength(12);
  });

  it('uses the real canvas renderer safely when no 2D context exists', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const app = createApp(root, {
      weatherService: { load: async () => normalizedScenario('mild-dry'), readCache: () => null },
      keyStore: { get: () => '', set() {}, clear() {} }
    });
    await app.start();
    expect(root.querySelector('#chart-unavailable').hidden).toBe(false);
    expect(root.querySelector('.hourly-table')).not.toBeNull();
  });
});
