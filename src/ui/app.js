import { copy, formatters } from '../copy.js';
import { OUTFITS, getOutfitById } from '../data/outfits.js';
import { currentConditions, currentHourIndex, getWeatherMeta, localDateHour, selectWindowHours } from '../domain/forecast.js';
import { DEFAULTS, deriveDaySummary, recommendOutfit } from '../domain/recommendation.js';
import { loadBerlinForecast, readCachedForecast } from '../services/weather-service.js';
import { drawHourlyChart, renderHourlyTable } from './hourly-chart.js';
import { escapeHtml } from './html.js';
import { renderRecommendationCard } from './recommendation-card.js';
import { renderStatusBanner, renderWeatherError } from './status-banner.js';

// How often to check whether the clock moved into a new hour.
const CLOCK_TICK_MS = 60_000;

export function createInitialState() {
  return {
    weather: { status: 'idle', data: null, error: null, isStale: false },
    daySummary: null,
    recommendation: { source: 'rules', outfitId: null, addOns: [], reasons: [] },
    chartAvailable: true
  };
}

function renderShell() {
  return `
    <header class="site-header">
      <div>
        <p class="brand">${escapeHtml(copy.brand)}</p>
        <p class="header-meta" id="header-meta">${escapeHtml(copy.locationLabel)}</p>
      </div>
      <button type="button" id="refresh-button" class="button" data-action="refresh">${escapeHtml(copy.refresh)}</button>
    </header>
    <div id="status-banner"></div>
    <main id="main" class="layout">
      <section id="snapshot" class="card snapshot" aria-labelledby="today-heading"></section>
      <section id="outfit" class="card outfit-card" aria-labelledby="outfit-heading"></section>
      <section id="forecast" class="card forecast-card" aria-labelledby="forecast-heading"></section>
      <section id="tips" class="card tips" aria-labelledby="tips-heading">
        <h2 id="tips-heading">${escapeHtml(copy.tipsHeading)}</h2>
        <p>${escapeHtml(copy.tipsText)}</p>
      </section>
    </main>
    <footer class="site-footer"><p>${escapeHtml(copy.footer)}</p></footer>
    <div id="announcer" class="visually-hidden" aria-live="polite"></div>`;
}

function renderSnapshot(weather, daySummary) {
  if (weather.data) {
    const now = currentConditions(weather.data);
    return `
      <h2 id="today-heading">${escapeHtml(copy.todayHeading(formatters.dayHeading(weather.data.day.date)))}</h2>
      <p class="now-line">${escapeHtml(
        copy.nowLine({
          temperature: formatters.temperature(now.temperatureC),
          feelsLike: formatters.temperature(now.apparentTemperatureC ?? now.temperatureC),
          condition: getWeatherMeta(now.weatherCode).label
        })
      )}</p>
      <p class="muted">${escapeHtml(
        copy.windowNote(
          formatters.hourLabel(DEFAULTS.dayStartHour),
          formatters.hourLabel(DEFAULTS.dayEndHour),
          daySummary?.window.start ?? formatters.hourLabel(DEFAULTS.dayStartHour)
        )
      )}</p>`;
  }
  if (weather.status === 'error') return renderWeatherError(weather);
  return `
    <h2 id="today-heading" class="visually-hidden">${escapeHtml(copy.todayHeading(''))}</h2>
    <p class="loading" role="status">${escapeHtml(copy.loadingForecast)}</p>
    <div class="skeleton skeleton-line" aria-hidden="true"></div>
    <div class="skeleton skeleton-line short" aria-hidden="true"></div>`;
}

function renderForecastSection(weather, currentIndex) {
  const heading = `<h2 id="forecast-heading">${escapeHtml(copy.forecastHeading)}</h2>`;
  if (!weather.data) {
    return weather.status === 'error'
      ? heading
      : `${heading}<div class="skeleton skeleton-chart" aria-hidden="true"></div>`;
  }
  const hours = dayHours(weather.data);
  const nowLegend = currentIndex >= 0
    ? `<li><span class="swatch swatch-past" aria-hidden="true"></span>${escapeHtml(copy.legendPast)}</li>
      <li><span class="swatch swatch-now" aria-hidden="true"></span>${escapeHtml(copy.legendNow(formatters.localHourLabel(hours[currentIndex].time)))}</li>`
    : '';
  return `
    ${heading}
    <h3 id="chart-title" class="chart-title">${escapeHtml(copy.chartTitle)}</h3>
    <div class="chart-wrap" id="chart-wrap">
      <canvas id="hourly-chart" role="img" aria-labelledby="chart-title" aria-describedby="chart-alt"></canvas>
    </div>
    <p id="chart-alt" class="visually-hidden">${escapeHtml(copy.chartAlt)}</p>
    <ul class="legend">
      <li><span class="swatch swatch-line" aria-hidden="true"></span>${escapeHtml(copy.legendTemperature)}</li>
      <li><span class="swatch swatch-bar" aria-hidden="true"></span>${escapeHtml(copy.legendRain)}</li>
      ${nowLegend}
    </ul>
    <p class="chart-unavailable muted" id="chart-unavailable" hidden>${escapeHtml(copy.chartUnavailable)}</p>
    <details class="table-details" id="hourly-table-details">
      <summary>${escapeHtml(copy.tableSummary)}</summary>
      ${renderHourlyTable(hours, { currentIndex })}
    </details>`;
}

// The tracked day, past hours included.
function dayHours(forecast) {
  return selectWindowHours(forecast.hours, DEFAULTS.dayStartHour, DEFAULTS.dayEndHour);
}

export function createApp(root, deps = {}) {
  const weatherService = deps.weatherService ?? { load: loadBerlinForecast, readCache: readCachedForecast };
  const drawChart = deps.drawChart ?? drawHourlyChart;
  const now = deps.now ?? (() => new Date());
  const doc = root.ownerDocument;
  const win = doc.defaultView;

  let state = createInitialState();
  let weatherController = null;
  let renderedForecastData = null;
  let renderedCurrentIndex = -1;
  let clockTimer = 0;
  let focusMemoId = null;
  let resizeFrame = 0;

  root.innerHTML = renderShell();
  const el = {
    headerMeta: root.querySelector('#header-meta'),
    refresh: root.querySelector('#refresh-button'),
    banner: root.querySelector('#status-banner'),
    main: root.querySelector('#main'),
    snapshot: root.querySelector('#snapshot'),
    outfit: root.querySelector('#outfit'),
    forecast: root.querySelector('#forecast'),
    announcer: root.querySelector('#announcer')
  };

  function setState(patch) {
    state = { ...state, ...patch };
    render();
  }

  function announce(message) {
    el.announcer.textContent = message;
  }

  // Re-rendering replaces buttons; keep keyboard focus on the equivalent one.
  function preservingFocus(update) {
    const active = doc.activeElement;
    if (active && active !== doc.body) focusMemoId = root.contains(active) && active.id ? active.id : null;
    update();
    if (!focusMemoId) return;
    const target = doc.getElementById(focusMemoId);
    if (target && !target.disabled) {
      target.focus();
      focusMemoId = null;
    }
  }

  function currentIndex() {
    return state.weather.data ? currentHourIndex(dayHours(state.weather.data), now(), DEFAULTS.timezone) : -1;
  }

  // The outfit looks at the hours from now to the end of the day; a forecast
  // for another day falls back to the whole day.
  function outfitFromHour(forecast) {
    const clock = localDateHour(now(), DEFAULTS.timezone);
    return clock.date === forecast.day.date ? clock.hour : DEFAULTS.dayStartHour;
  }

  function render() {
    const { weather } = state;
    el.headerMeta.textContent = weather.data
      ? `${copy.locationLabel} · ${copy.updatedAt(formatters.clockTime(weather.data.fetchedAt))}`
      : copy.locationLabel;
    el.refresh.textContent = weather.status === 'loading' && weather.data ? copy.refreshing : copy.refresh;
    el.main.setAttribute('aria-busy', String(weather.status === 'loading'));

    preservingFocus(() => {
      el.banner.innerHTML = renderStatusBanner(weather);
      el.snapshot.innerHTML = renderSnapshot(weather, state.daySummary);

      const detailsOpen = el.outfit.querySelector('#decision-details')?.open ?? false;
      el.outfit.innerHTML = renderRecommendationCard({
        outfit: state.recommendation.outfitId ? getOutfitById(state.recommendation.outfitId) : null,
        recommendation: state.recommendation,
        daySummary: state.daySummary,
        weatherStatus: weather.status
      });
      const details = el.outfit.querySelector('#decision-details');
      if (details) details.open = detailsOpen;

      // The chart only changes with new forecast data or a new hour.
      const nowIndex = currentIndex();
      if (weather.data !== renderedForecastData || nowIndex !== renderedCurrentIndex || !weather.data) {
        el.forecast.innerHTML = renderForecastSection(weather, nowIndex);
        renderedForecastData = weather.data;
        renderedCurrentIndex = nowIndex;
        if (weather.data) paintChart();
      }
    });
  }

  function paintChart() {
    const canvas = el.forecast.querySelector('#hourly-chart');
    if (!canvas || !state.weather.data) return;
    let drawn = false;
    try {
      drawn = drawChart(canvas, dayHours(state.weather.data), { currentIndex: renderedCurrentIndex });
    } catch {
      drawn = false;
    }
    state.chartAvailable = drawn;
    // Canvas unavailable: the table becomes the primary view.
    el.forecast.querySelector('#chart-wrap').hidden = !drawn;
    el.forecast.querySelector('#chart-unavailable').hidden = drawn;
    if (!drawn) el.forecast.querySelector('#hourly-table-details').open = true;
  }

  function summarize(data) {
    const daySummary = deriveDaySummary(data, DEFAULTS, { fromHour: outfitFromHour(data) });
    return { daySummary, recommendation: recommendOutfit(daySummary, DEFAULTS, OUTFITS) };
  }

  function applyForecast(data, { status = 'ready', isStale = false } = {}) {
    let outfit;
    try {
      outfit = summarize(data);
    } catch {
      setState({ weather: { ...state.weather, status: 'error', error: copy.weatherError } });
      return false;
    }
    setState({ weather: { status, data, error: null, isStale }, ...outfit });
    return true;
  }

  async function loadWeather({ force = false } = {}) {
    weatherController?.abort();
    const controller = new AbortController();
    weatherController = controller;
    setState({ weather: { ...state.weather, status: 'loading', error: null } });

    try {
      const data = await weatherService.load({ force, signal: controller.signal });
      if (weatherController !== controller) return;
      if (applyForecast(data) && force) announce(copy.announceForecastUpdated(formatters.clockTime(data.fetchedAt)));
    } catch (error) {
      if (weatherController !== controller || error?.code === 'aborted') return;
      setState({
        weather: {
          ...state.weather,
          status: 'error',
          error: error?.userMessage ?? copy.weatherError,
          isStale: Boolean(state.weather.data)
        }
      });
    } finally {
      if (weatherController === controller) weatherController = null;
    }
  }

  function onClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    if (button.dataset.action === 'refresh') loadWeather({ force: true });
  }

  function onResize() {
    if (!state.weather.data) return;
    win.cancelAnimationFrame?.(resizeFrame);
    resizeFrame = (win.requestAnimationFrame ?? ((fn) => setTimeout(fn, 16)))(() => paintChart());
  }

  // A new hour moves the chart marker and drops that hour from the outfit.
  function onClockTick() {
    const { weather } = state;
    if (!weather.data || currentIndex() === renderedCurrentIndex) return;
    try {
      setState(summarize(weather.data));
    } catch {
      setState({ weather: { ...weather, status: 'error', error: copy.weatherError } });
    }
  }

  root.addEventListener('click', onClick);
  win.addEventListener('resize', onResize);

  return {
    start() {
      render();
      clockTimer = setInterval(onClockTick, CLOCK_TICK_MS);
      const cached = weatherService.readCache?.();
      if (cached?.data) {
        applyForecast(cached.data, { status: cached.isFresh ? 'ready' : 'loading', isStale: !cached.isFresh });
        if (cached.isFresh) return Promise.resolve();
      }
      return loadWeather({ force: false });
    },
    refresh: () => loadWeather({ force: true }),
    getState: () => state,
    destroy() {
      weatherController?.abort();
      clearInterval(clockTimer);
      root.removeEventListener('click', onClick);
      win.removeEventListener('resize', onResize);
    }
  };
}
