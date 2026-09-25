import { copy } from '../copy.js';
import { ADD_ONS } from '../data/outfits.js';
import { escapeHtml } from './html.js';
import { renderGarmentMarker, renderOutfitIllustration } from './outfit-illustration.js';

export function sourceText(recommendation, ai) {
  if (recommendation.source === 'ai') return copy.sourceAiAccepted;
  if (ai.status === 'rejected') return copy.sourceAiRejected;
  return copy.sourceRules;
}

function renderAiControls({ ai, hasKey, canUseAi }) {
  const loading = ai.status === 'loading';
  const aiLabel = loading ? copy.checkingOptions : copy.useAiDecision;
  const disabled = !canUseAi || loading;
  return `
    <div class="ai-controls">
      <button type="button" id="ai-button" class="button button-primary" data-action="use-ai"${disabled ? ' disabled' : ''}>${escapeHtml(aiLabel)}</button>
      ${hasKey ? `
        <button type="button" id="change-key-button" class="button" data-action="change-key"${loading ? ' disabled' : ''}>${escapeHtml(copy.changeKey)}</button>
        <button type="button" id="forget-key-button" class="button button-quiet" data-action="forget-key"${loading ? ' disabled' : ''}>${escapeHtml(copy.forgetKey)}</button>` : ''}
    </div>`;
}

function renderAiStatus(ai) {
  if (ai.status === 'rejected') return `<p class="ai-status" role="status">${escapeHtml(copy.aiRejectedStatus)}</p>`;
  if (ai.status === 'error') return `<p class="ai-status ai-status-error" role="status">${escapeHtml(copy.aiFailed)}</p>`;
  return '';
}

function renderDetails({ recommendation, ai, daySummary }) {
  const lines = [
    copy.detailWindow(daySummary.window.start, daySummary.window.end, daySummary.window.hourCount),
    copy.detailFeels(Math.round(daySummary.minApparentC), Math.round(daySummary.maxApparentC)),
    copy.detailRain(daySummary.maxRainProbability, daySummary.precipitationTotalMm),
    copy.detailWind(daySummary.maxWindKmh),
    copy.detailSun(Math.round(daySummary.sunnyFraction * 100))
  ];
  let aiLine = copy.aiNotRequestedDetail;
  if (recommendation.source === 'ai' && ai.decision) aiLine = copy.aiAcceptedDetail(Math.round(ai.decision.confidence * 100));
  else if (ai.status === 'rejected') aiLine = copy.aiRejectedDetail;
  else if (ai.status === 'error') aiLine = copy.aiFailed;

  return `
    <details class="decision-details" id="decision-details">
      <summary>${escapeHtml(copy.decisionDetails)}</summary>
      <p>${escapeHtml(aiLine)}</p>
      <ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
    </details>`;
}

export function renderRecommendationCard({ outfit, recommendation, ai, daySummary, hasKey, weatherStatus }) {
  const heading = `<h2 id="outfit-heading" class="eyebrow">${escapeHtml(copy.putOnToday)}</h2>`;

  if (!outfit) {
    if (weatherStatus === 'loading' || weatherStatus === 'idle') {
      return `${heading}<div class="skeleton skeleton-figure" aria-hidden="true"></div><div class="skeleton skeleton-line" aria-hidden="true"></div>`;
    }
    return `${heading}<p class="muted">${escapeHtml(copy.outfitPending)}</p>${renderAiControls({ ai, hasKey, canUseAi: false })}`;
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
    <p class="source-line" data-source="${escapeHtml(recommendation.source)}">${escapeHtml(sourceText(recommendation, ai))}</p>
    ${addOns}
    <div class="outfit-body">
      ${renderOutfitIllustration(outfit)}
      <div>
        <ul class="garment-list" aria-label="${escapeHtml(copy.garmentListLabel)}">${garments}</ul>
        <ul class="chips" aria-label="${escapeHtml(copy.reasonsLabel)}">${reasons}</ul>
      </div>
    </div>
    ${renderAiStatus(ai)}
    ${renderDetails({ recommendation, ai, daySummary })}
    ${renderAiControls({ ai, hasKey, canUseAi: true })}`;
}
