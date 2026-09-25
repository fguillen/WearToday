import { copy, formatters } from '../copy.js';
import { escapeHtml } from './html.js';

// Global weather status: stale cache notice or a fetch failure over cached data.
// Returns '' when there is nothing to say.
export function renderStatusBanner(weather) {
  if (!weather.data || !weather.isStale) return '';
  const message = weather.status === 'error' ? weather.error ?? copy.weatherError : copy.staleNotice;
  return `
    <div class="banner" role="status">
      <p>${escapeHtml(message)} ${escapeHtml(copy.lastUpdatedAt(formatters.clockTime(weather.data.fetchedAt)))}</p>
      <button type="button" id="banner-retry" class="button" data-action="refresh"${weather.status === 'loading' ? ' disabled' : ''}>${escapeHtml(copy.retry)}</button>
    </div>`;
}

export function renderWeatherError(weather) {
  return `
    <div class="error-card" role="alert">
      <h2 id="today-heading">${escapeHtml(copy.weatherErrorTitle)}</h2>
      <p>${escapeHtml(weather.error ?? copy.weatherError)}</p>
      <button type="button" id="error-retry" class="button button-primary" data-action="refresh">${escapeHtml(copy.retry)}</button>
    </div>`;
}
