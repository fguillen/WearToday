import { copy, formatters } from '../copy.js';
import { OUTFITS, getOutfitById } from '../data/outfits.js';
import { currentConditions, currentHourIndex, getWeatherMeta, localDateHour, selectWindowHours } from '../domain/forecast.js';
import { DEFAULTS, deriveDaySummary, recommendOutfit } from '../domain/recommendation.js';
import { loadBerlinForecast, readCachedForecast } from '../services/weather-service.js';
import { drawHourlyChart, renderHourlyTable } from './hourly-chart.js';
import { escapeHtml } from './html.js';
import { icon, weatherIcon } from './icons.js';
import { renderRecommendationCard } from './recommendation-card.js';
import { renderStatusBanner, renderWeatherError } from './status-banner.js';

// How often to check whether the clock moved into a new hour.
const CLOCK_TICK_MS = 60_000;

export function createInitialState() {
  return {
    weather: { status: 'idle', data: null, error: null, isStale: false },
    daySummary: null,
    recommendation: { source: 'rules', outfitId: null, addOns: [], reasons: [] },
    // The hours the outfit is for, today only. `fromHour: null` follows the clock.
    range: { fromHour: null, toHour: DEFAULTS.dayEndHour },
    chartAvailable: true
  };
}

function renderShell() {
  return `
    <header class="hero">
      <div class="hero-top">
        <p class="app-title">${escapeHtml(copy.brand)}</p>
        <button type="button" id="refresh-button" class="button button-glass" data-action="refresh">${icon('refresh')}<span id="refresh-label">${escapeHtml(copy.refresh)}</span></button>
      </div>
      <section id="snapshot" class="snapshot" aria-labelledby="today-heading"></section>
    </header>
    <div id="status-banner" class="banner-slot"></div>
    <main id="main" class="main-content">
      <section id="outfit" class="outfit-section" aria-labelledby="outfit-heading"></section>
      <section id="forecast" class="forecast-section" aria-labelledby="forecast-heading"></section>
      <section id="tips" class="reassurance-note" aria-labelledby="tips-heading">
        ${icon('heart')}
        <div>
          <h2 id="tips-heading">${escapeHtml(copy.tipsHeading)}</h2>
          <p>${escapeHtml(copy.tipsText)}</p>
        </div>
      </section>
    </main>
    <footer class="site-footer">
      <p>${escapeHtml(copy.footer)}</p>
      <p id="app-version">${escapeHtml(copy.version(__APP_VERSION__))}</p>
    </footer>
    <div id="announcer" class="visually-hidden" aria-live="polite"></div>`;
}

function headerMeta(weather) {
  const meta = weather.data
    ? `${copy.locationLabel} · ${copy.updatedAt(formatters.clockTime(weather.data.fetchedAt))}`
    : copy.locationLabel;
  return `<p class="location" id="header-meta">${escapeHtml(meta)}</p>`;
}

function pill(className, iconName, iconClass, text) {
  return `<li class="${className}">${icon(iconName, iconClass)}${escapeHtml(text)}</li>`;
}

// The alerts and the outfit reasons come from the hours still ahead.
function renderHeroPills(daySummary, recommendation) {
  const alerts = [];
  if (daySummary?.rainLikely && daySummary.maxRainProbability > 0) {
    const when = copy.timeOfDay(daySummary.firstRainHour ?? DEFAULTS.dayStartHour);
    alerts.push(pill('alert-pill', 'umbrellaRain', 'icon-rain', copy.alertRain(daySummary.maxRainProbability, when)));
  }
  if (daySummary) {
    const temp = formatters.temperature(daySummary.maxApparentC);
    alerts.push(pill('alert-pill', 'sun', 'icon-sun', copy.alertWarmest(temp, formatters.hourLabel(daySummary.warmestHour))));
  }

  const reasons = recommendation.reasons
    .slice(0, 3)
    .map((reason) => pill('chip', 'sparkle', 'icon-sun', reason));

  return `
    ${alerts.length ? `<ul class="weather-alerts">${alerts.join('')}</ul>` : ''}
    ${reasons.length ? `<ul class="chips" aria-label="${escapeHtml(copy.reasonsLabel)}">${reasons.join('')}</ul>` : ''}`;
}

function renderSnapshot(weather, daySummary, recommendation) {
  if (weather.data) {
    const now = currentConditions(weather.data);
    const meta = getWeatherMeta(now.weatherCode);
    const temperature = formatters.temperature(now.temperatureC ?? now.apparentTemperatureC);
    const feels = formatters.temperature(now.apparentTemperatureC ?? now.temperatureC);
    return `
      <h2 id="today-heading" class="today-heading">${escapeHtml(copy.todayHeading(formatters.dayHeading(weather.data.day.date)))}</h2>
      <div class="current-weather">
        <p class="temp-main"><span class="visually-hidden">${escapeHtml(copy.temperatureNow(temperature))}</span><span aria-hidden="true">${escapeHtml(temperature)}<span class="deg">°</span></span></p>
        <p class="temp-details">${weatherIcon(meta.icon)}${escapeHtml(copy.feelsLine(feels, meta.label))}</p>
        ${headerMeta(weather)}
        ${renderHeroPills(daySummary, recommendation)}
      </div>`;
  }
  if (weather.status === 'error') return `${renderWeatherError(weather)}${headerMeta(weather)}`;
  return `
    <h2 id="today-heading" class="visually-hidden">${escapeHtml(copy.todayHeading(''))}</h2>
    <p class="loading" role="status">${escapeHtml(copy.loadingForecast)}</p>
    <div class="skeleton skeleton-temp" aria-hidden="true"></div>
    <div class="skeleton skeleton-line short" aria-hidden="true"></div>
    ${headerMeta(weather)}`;
}

function renderForecastSection(weather, daySummary, { currentIndex, rangeStart, rangeEnd }) {
  const heading = `<h2 id="forecast-heading" class="section-title">${escapeHtml(copy.forecastHeading)}</h2>`;
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
  const note = copy.windowNote(
    formatters.hourLabel(DEFAULTS.dayStartHour),
    formatters.hourLabel(DEFAULTS.dayEndHour),
    daySummary?.window.start ?? formatters.hourLabel(DEFAULTS.dayStartHour),
    daySummary?.window.end ?? formatters.hourLabel(DEFAULTS.dayEndHour)
  );
  return `
    ${heading}
    <p class="section-note" id="window-note">${escapeHtml(note)}</p>
    <h3 id="chart-title" class="visually-hidden">${escapeHtml(copy.chartTitle)}</h3>
    <ul class="legend">
      <li><span class="swatch swatch-line" aria-hidden="true"></span>${escapeHtml(copy.legendTemperature)}</li>
      <li><span class="swatch swatch-bar" aria-hidden="true"></span>${escapeHtml(copy.legendRain)}</li>
      <li><span class="swatch swatch-mm" aria-hidden="true">0.4</span>${escapeHtml(copy.legendRainAmount)}</li>
      <li><span class="swatch swatch-range" aria-hidden="true"></span>${escapeHtml(copy.legendOutfitHours)}</li>
      ${nowLegend}
    </ul>
    <div class="chart-container" id="chart-wrap">
      <canvas id="hourly-chart" role="img" aria-labelledby="chart-title" aria-describedby="chart-alt"></canvas>
    </div>
    <p id="chart-alt" class="visually-hidden">${escapeHtml(copy.chartAlt)}</p>
    <p class="chart-unavailable muted" id="chart-unavailable" hidden>${escapeHtml(copy.chartUnavailable)}</p>
    <details class="disclosure table-details" id="hourly-table-details">
      <summary>${escapeHtml(copy.tableSummary)}</summary>
      ${renderHourlyTable(hours, { currentIndex, rangeStart, rangeEnd })}
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
  let renderedRange = '';
  let clockTimer = 0;
  let focusMemoId = null;
  let resizeFrame = 0;

  root.innerHTML = renderShell();
  const el = {
    refresh: root.querySelector('#refresh-button'),
    refreshLabel: root.querySelector('#refresh-label'),
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

  // By default the outfit looks at the hours from now to the end of the day; a
  // forecast for another day falls back to the whole day.
  function outfitFromHour(forecast) {
    const clock = localDateHour(now(), DEFAULTS.timezone);
    return clock.date === forecast.day.date ? clock.hour : DEFAULTS.dayStartHour;
  }

  // The chosen hours clamped into the tracked day, with the start never past the end.
  function outfitRange(forecast, range = state.range) {
    const clamp = (hour) => Math.min(Math.max(hour, DEFAULTS.dayStartHour), DEFAULTS.dayEndHour);
    const to = clamp(range.toHour);
    return { from: Math.min(clamp(range.fromHour ?? outfitFromHour(forecast)), to), to };
  }

  function rangePicker() {
    if (!state.weather.data) return null;
    const { from, to } = outfitRange(state.weather.data);
    return { from, to, followsNow: state.range.fromHour === null, min: DEFAULTS.dayStartHour, max: DEFAULTS.dayEndHour };
  }

  // Range as positions in `dayHours`, for the chart and table highlight.
  function rangeIndices(forecast) {
    const { from, to } = outfitRange(forecast);
    const hours = dayHours(forecast);
    return {
      rangeStart: hours.findIndex((hour) => hour.hour >= from),
      rangeEnd: hours.findLastIndex((hour) => hour.hour <= to)
    };
  }

  function render() {
    const { weather } = state;
    el.refreshLabel.textContent = weather.status === 'loading' && weather.data ? copy.refreshing : copy.refresh;
    el.main.setAttribute('aria-busy', String(weather.status === 'loading'));

    preservingFocus(() => {
      el.banner.innerHTML = renderStatusBanner(weather);
      el.snapshot.innerHTML = renderSnapshot(weather, state.daySummary, state.recommendation);

      const detailsOpen = el.outfit.querySelector('#decision-details')?.open ?? false;
      el.outfit.innerHTML = renderRecommendationCard({
        outfit: state.recommendation.outfitId ? getOutfitById(state.recommendation.outfitId) : null,
        recommendation: state.recommendation,
        daySummary: state.daySummary,
        weatherStatus: weather.status,
        range: rangePicker()
      });
      const details = el.outfit.querySelector('#decision-details');
      if (details) details.open = detailsOpen;

      // The chart only changes with new forecast data, a new hour or a new range.
      const nowIndex = currentIndex();
      const range = weather.data ? rangeIndices(weather.data) : {};
      const rangeKey = `${range.rangeStart}-${range.rangeEnd}`;
      if (weather.data !== renderedForecastData || nowIndex !== renderedCurrentIndex || rangeKey !== renderedRange || !weather.data) {
        el.forecast.innerHTML = renderForecastSection(weather, state.daySummary, { currentIndex: nowIndex, ...range });
        renderedForecastData = weather.data;
        renderedCurrentIndex = nowIndex;
        renderedRange = rangeKey;
        if (weather.data) paintChart();
      }
    });
  }

  function paintChart() {
    const canvas = el.forecast.querySelector('#hourly-chart');
    if (!canvas || !state.weather.data) return;
    let drawn = false;
    try {
      drawn = drawChart(canvas, dayHours(state.weather.data), {
        currentIndex: renderedCurrentIndex,
        ...rangeIndices(state.weather.data)
      });
    } catch {
      drawn = false;
    }
    state.chartAvailable = drawn;
    // Canvas unavailable: the table becomes the primary view.
    el.forecast.querySelector('#chart-wrap').hidden = !drawn;
    el.forecast.querySelector('#chart-unavailable').hidden = drawn;
    if (!drawn) el.forecast.querySelector('#hourly-table-details').open = true;
  }

  function summarize(data, range = state.range) {
    const { from, to } = outfitRange(data, range);
    const daySummary = deriveDaySummary(data, DEFAULTS, { fromHour: from, toHour: to });
    return { daySummary, recommendation: recommendOutfit(daySummary, DEFAULTS, OUTFITS) };
  }

  function setRange(range) {
    const { weather } = state;
    if (!weather.data) return;
    try {
      setState({ range, ...summarize(weather.data, range) });
    } catch {
      setState({ range, weather: { ...weather, status: 'error', error: copy.weatherError } });
    }
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
    if (button.dataset.action === 'range-now') {
      setRange({ fromHour: null, toHour: DEFAULTS.dayEndHour });
      // The Now button is gone once the range follows the clock again.
      root.querySelector('#range-from')?.focus();
    }
  }

  // Moving one end past the other drags the other end along.
  function onChange(event) {
    const select = event.target.closest?.('select[data-range]');
    if (!select || !state.weather.data) return;
    const hour = Number(select.value);
    const { from, to } = outfitRange(state.weather.data);
    setRange(
      select.dataset.range === 'from'
        ? { fromHour: hour, toHour: Math.max(to, hour) }
        : { fromHour: hour < from ? hour : state.range.fromHour, toHour: hour }
    );
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
  root.addEventListener('change', onChange);
  win.addEventListener('resize', onResize);
  // Canvas text does not reflow: redraw once the web fonts have arrived.
  doc.fonts?.ready?.then(onResize);

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
      root.removeEventListener('change', onChange);
      win.removeEventListener('resize', onResize);
    }
  };
}
