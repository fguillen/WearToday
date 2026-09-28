import { copy } from '../copy.js';
import { ADD_ONS } from '../data/outfits.js';
import { escapeHtml } from './html.js';
import { icon } from './icons.js';
import { renderOutfitIllustration } from './outfit-illustration.js';

// Presentation only: which body zone a catalog garment belongs to, in
// dressing order, and the icon it gets. Garments missing here land in "carry".
const ZONES = [
  { id: 'head', garments: ['Hat', 'Scarf'] },
  { id: 'top', garments: ['Short-sleeve T-shirt', 'Long-sleeve T-shirt', 'Sweater', 'Jacket'] },
  { id: 'legs', garments: ['Shorts', 'Long pants', 'Rain pants'] },
  { id: 'feet', garments: ['Socks', 'Sandals', 'Closed shoes', 'Waterproof shoes'] },
  { id: 'carry', garments: ['Umbrella'] }
];

const GARMENT_ICONS = {
  Hat: 'hat',
  Scarf: 'scarf',
  'Short-sleeve T-shirt': 'shortTee',
  'Long-sleeve T-shirt': 'longTee',
  Sweater: 'sweater',
  Jacket: 'jacket',
  Shorts: 'shorts',
  'Long pants': 'longPants',
  'Rain pants': 'rainPants',
  Socks: 'socks',
  Sandals: 'sandals',
  'Closed shoes': 'shoes',
  'Waterproof shoes': 'waterproofShoes',
  Umbrella: 'umbrella'
};

export function groupGarments(garments) {
  const known = new Set(ZONES.flatMap((zone) => zone.garments));
  return ZONES.map((zone) => ({
    id: zone.id,
    garments:
      zone.id === 'carry'
        ? garments.filter((garment) => zone.garments.includes(garment) || !known.has(garment))
        : zone.garments.filter((garment) => garments.includes(garment))
  })).filter((zone) => zone.garments.length > 0);
}

function zoneHint(zone, daySummary) {
  const hints = copy.zoneHints;
  const has = (garment) => zone.garments.includes(garment);
  switch (zone.id) {
    case 'head': return hints.headCold(Math.round(daySummary.minApparentC));
    case 'top': return hints.layers(zone.garments.length);
    case 'legs': return has('Rain pants') ? hints.rainReady : has('Shorts') ? hints.short : hints.long;
    case 'feet': return has('Waterproof shoes') ? hints.rainReady : has('Sandals') ? hints.open : hints.closed;
    default: return hints.carry;
  }
}

function renderZone(zone, daySummary) {
  const labelId = `zone-${zone.id}`;
  const items = zone.garments
    .map((garment) => {
      const note = copy.garmentNotes[garment];
      return `<li class="clothing-chip">${icon(GARMENT_ICONS[garment] ?? 'unknown')}<span>${escapeHtml(garment)}${note ? ` <span class="muted">${escapeHtml(note)}</span>` : ''}</span></li>`;
    })
    .join('');
  return `
    <div class="clothing-row">
      <div class="layer-head">
        <span class="layer-name" id="${labelId}">${escapeHtml(copy.zones[zone.id])}</span>
        <span class="layer-hint">${escapeHtml(zoneHint(zone, daySummary))}</span>
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
          ${groupGarments(outfit.garments).map((zone) => renderZone(zone, daySummary)).join('')}
        </div>
        ${renderOutfitIllustration(outfit)}
      </div>
      <p class="source-line" data-source="${escapeHtml(recommendation.source)}">${escapeHtml(copy.sourceRules)}</p>
      ${renderDetails(daySummary)}
    </div>`;
}
