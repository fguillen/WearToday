import { copy } from '../copy.js';
import { ADD_ONS, GARMENTS, groupBySection } from '../data/outfits.js';
import { escapeHtml } from './html.js';
import { icon } from './icons.js';
import { renderOutfitIllustration } from './outfit-illustration.js';

function sectionHint({ section, garments }, daySummary) {
  const hints = copy.sectionHints;
  const has = (...ids) => ids.some((id) => garments.includes(id));
  switch (section) {
    case 'head': return has('sunHat') ? hints.sun : hints.headCold(Math.round(daySummary.minApparentC));
    case 'middle': return hints.layers(garments.length);
    case 'low': return has('mudOveralls') ? hints.rainReady : has('shorts') ? hints.short : hints.long;
    case 'bottom':
      if (has('waterproofShoes', 'wellies')) return hints.rainReady;
      if (has('winterBoots')) return hints.snowReady;
      return has('sandals') ? hints.open : hints.closed;
    default: return hints.carry;
  }
}

function renderSection(group, daySummary) {
  const labelId = `section-${group.section}`;
  const items = group.garments
    .map((id) => {
      const { label, note } = GARMENTS[id] ?? { label: id };
      return `<li class="clothing-chip">${icon(GARMENTS[id] ? id : 'unknown')}<span>${escapeHtml(label)}${note ? ` <span class="muted">${escapeHtml(note)}</span>` : ''}</span></li>`;
    })
    .join('');
  return `
    <div class="clothing-row">
      <div class="layer-head">
        <span class="layer-name" id="${labelId}">${escapeHtml(copy.sections[group.section])}</span>
        <span class="layer-hint">${escapeHtml(sectionHint(group, daySummary))}</span>
      </div>
      <ul class="garment-list layer-items" aria-labelledby="${labelId}">${items}</ul>
    </div>`;
}

function renderDetails(daySummary) {
  const lines = [
    copy.detailWindow(daySummary.window.start, daySummary.window.end, daySummary.window.hourCount),
    copy.detailFeels(Math.round(daySummary.minApparentC), Math.round(daySummary.maxApparentC)),
    copy.detailRain(daySummary.maxRainProbability, daySummary.precipitationTotalMm),
    copy.detailWind(daySummary.maxWindKmh),
    copy.detailSun(Math.round(daySummary.sunnyFraction * 100))
  ];
  return `
    <details class="disclosure decision-details" id="decision-details">
      <summary>${escapeHtml(copy.decisionDetails)}</summary>
      <p>${escapeHtml(copy.rulesDetail)}</p>
      <ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
    </details>`;
}

function cardHeader(outfit) {
  return `
    <div class="outfit-header">
      <span class="outfit-icon" aria-hidden="true">${icon('sparkle')}</span>
      <div class="outfit-heading">
        <h2 id="outfit-heading" class="eyebrow">${escapeHtml(copy.putOnToday)}</h2>
        ${outfit ? `<p class="outfit-name" data-outfit-id="${escapeHtml(outfit.id)}">${escapeHtml(outfit.label)}</p>` : ''}
      </div>
    </div>`;
}

export function renderRecommendationCard({ outfit, recommendation, daySummary, weatherStatus }) {
  if (!outfit) {
    const body =
      weatherStatus === 'loading' || weatherStatus === 'idle'
        ? '<div class="skeleton skeleton-line" aria-hidden="true"></div><div class="skeleton skeleton-figure" aria-hidden="true"></div>'
        : `<p class="muted">${escapeHtml(copy.outfitPending)}</p>`;
    return `<div class="outfit-card">${cardHeader(null)}${body}</div>`;
  }

  const addOns = recommendation.addOns
    .map((id) => ADD_ONS[id])
    .filter(Boolean)
    .map((addOn) => `<p class="add-on" role="note">${icon('umbrellaRain')}<span><strong>${escapeHtml(addOn.label)}</strong> — ${escapeHtml(addOn.note)}</span></p>`)
    .join('');

  return `
    <div class="outfit-card">
      ${cardHeader(outfit)}
      ${addOns}
      <div class="outfit-body">
        <div class="clothing-stack" role="group" aria-label="${escapeHtml(copy.garmentListLabel)}">
          ${groupBySection(outfit.garments).map((group) => renderSection(group, daySummary)).join('')}
        </div>
        ${renderOutfitIllustration(outfit)}
      </div>
      <p class="source-line" data-source="${escapeHtml(recommendation.source)}">${escapeHtml(copy.sourceRules)}</p>
      ${renderDetails(daySummary)}
    </div>`;
}
