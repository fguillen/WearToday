import { copy } from '../copy.js';
import { ADD_ONS } from '../data/outfits.js';
import { escapeHtml } from './html.js';
import { renderGarmentMarker, renderOutfitIllustration } from './outfit-illustration.js';

function renderDetails(daySummary) {
  const lines = [
    copy.detailWindow(daySummary.window.start, daySummary.window.end, daySummary.window.hourCount),
    copy.detailFeels(Math.round(daySummary.minApparentC), Math.round(daySummary.maxApparentC)),
    copy.detailRain(daySummary.maxRainProbability, daySummary.precipitationTotalMm),
    copy.detailWind(daySummary.maxWindKmh),
    copy.detailSun(Math.round(daySummary.sunnyFraction * 100))
  ];
  return `
    <details class="decision-details" id="decision-details">
      <summary>${escapeHtml(copy.decisionDetails)}</summary>
      <p>${escapeHtml(copy.rulesDetail)}</p>
      <ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
    </details>`;
}

export function renderRecommendationCard({ outfit, recommendation, daySummary, weatherStatus }) {
  const heading = `<h2 id="outfit-heading" class="eyebrow">${escapeHtml(copy.putOnToday)}</h2>`;

  if (!outfit) {
    if (weatherStatus === 'loading' || weatherStatus === 'idle') {
      return `${heading}<div class="skeleton skeleton-figure" aria-hidden="true"></div><div class="skeleton skeleton-line" aria-hidden="true"></div>`;
    }
    return `${heading}<p class="muted">${escapeHtml(copy.outfitPending)}</p>`;
  }

  const addOns = recommendation.addOns
    .map((id) => ADD_ONS[id])
    .filter(Boolean)
    .map((addOn) => `<p class="add-on" role="note"><strong>${escapeHtml(addOn.label)}</strong> — ${escapeHtml(addOn.note)}</p>`)
    .join('');

  const garments = outfit.garments
    .map((garment) => {
      const note = copy.garmentNotes[garment];
      return `<li>${renderGarmentMarker(garment)}<span>${escapeHtml(garment)}${note ? ` <span class="muted">${escapeHtml(note)}</span>` : ''}</span></li>`;
    })
    .join('');

  const reasons = recommendation.reasons
    .slice(0, 3)
    .map((reason) => `<li class="chip">${escapeHtml(reason)}</li>`)
    .join('');

  return `
    ${heading}
    <p class="outfit-name" data-outfit-id="${escapeHtml(outfit.id)}">${escapeHtml(outfit.label)}</p>
    <p class="source-line" data-source="${escapeHtml(recommendation.source)}">${escapeHtml(copy.sourceRules)}</p>
    ${addOns}
    <div class="outfit-body">
      ${renderOutfitIllustration(outfit)}
      <div>
        <ul class="garment-list" aria-label="${escapeHtml(copy.garmentListLabel)}">${garments}</ul>
        <ul class="chips" aria-label="${escapeHtml(copy.reasonsLabel)}">${reasons}</ul>
      </div>
    </div>
    ${renderDetails(daySummary)}`;
}
