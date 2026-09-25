import { copy } from '../copy.js';
import { escapeHtml } from './html.js';

// Composable SVG child figure. Each catalog visualLayer maps to one <g>.

export const LAYER_ORDER = [
  'longTee',
  'shortTee',
  'sweater',
  'longPants',
  'shorts',
  'jacket',
  'rainPants',
  'socks',
  'shoes',
  'waterproofShoes',
  'sandals',
  'scarf',
  'hat',
  'umbrella'
];

const LAYER_LABELS = {
  body: 'Child figure',
  shortTee: 'Short-sleeve T-shirt',
  longTee: 'Long-sleeve T-shirt',
  sweater: 'Sweater',
  longPants: 'Long pants',
  shorts: 'Shorts',
  jacket: 'Jacket',
  rainPants: 'Rain pants',
  socks: 'Socks',
  shoes: 'Closed shoes',
  waterproofShoes: 'Waterproof shoes',
  sandals: 'Sandals',
  scarf: 'Scarf',
  hat: 'Hat',
  umbrella: 'Umbrella'
};

// Figure geometry (viewBox 0 0 240 280): head centred at x=110.
const SKIN = '#E9C9A8';
const SKIN_LINE = '#C9A080';

const torso = (fill, { top = 84, bottom = 158, inset = 0 } = {}) =>
  `<rect x="${82 + inset}" y="${top}" width="${56 - inset * 2}" height="${bottom - top}" rx="10" fill="${fill}"/>`;
const longSleeves = (fill, width = 14) =>
  `<rect x="${80 - width}" y="88" width="${width}" height="62" rx="7" fill="${fill}"/>` +
  `<rect x="140" y="88" width="${width}" height="62" rx="7" fill="${fill}"/>`;

const LAYERS = {
  body: () => `
    <circle cx="110" cy="54" r="26" fill="${SKIN}" stroke="${SKIN_LINE}"/>
    <circle cx="101" cy="52" r="2.5" fill="#1E293B"/><circle cx="119" cy="52" r="2.5" fill="#1E293B"/>
    <path d="M102 63 q8 6 16 0" fill="none" stroke="#1E293B" stroke-width="2" stroke-linecap="round"/>
    <rect x="103" y="78" width="14" height="10" fill="${SKIN}"/>
    <rect x="82" y="84" width="56" height="74" rx="10" fill="${SKIN}" stroke="${SKIN_LINE}"/>
    <rect x="68" y="88" width="12" height="70" rx="6" fill="${SKIN}" stroke="${SKIN_LINE}"/>
    <rect x="140" y="88" width="12" height="70" rx="6" fill="${SKIN}" stroke="${SKIN_LINE}"/>
    <rect x="88" y="154" width="18" height="84" rx="7" fill="${SKIN}" stroke="${SKIN_LINE}"/>
    <rect x="114" y="154" width="18" height="84" rx="7" fill="${SKIN}" stroke="${SKIN_LINE}"/>
    <ellipse cx="96" cy="244" rx="12" ry="6" fill="${SKIN}" stroke="${SKIN_LINE}"/>
    <ellipse cx="124" cy="244" rx="12" ry="6" fill="${SKIN}" stroke="${SKIN_LINE}"/>`,
  shortTee: () => `
    ${torso('#60A5FA')}
    <rect x="66" y="86" width="16" height="26" rx="7" fill="#60A5FA"/>
    <rect x="138" y="86" width="16" height="26" rx="7" fill="#60A5FA"/>`,
  longTee: () => `${torso('#E2E8F0')}${longSleeves('#E2E8F0')}`,
  sweater: () => `
    ${torso('#2E8B73', { top: 82, bottom: 156 })}${longSleeves('#2E8B73', 15)}
    <rect x="82" y="148" width="56" height="8" rx="3" fill="#256F5C"/>`,
  longPants: () => `
    <rect x="84" y="150" width="52" height="16" rx="6" fill="#334E7A"/>
    <rect x="86" y="154" width="22" height="80" rx="7" fill="#334E7A"/>
    <rect x="112" y="154" width="22" height="80" rx="7" fill="#334E7A"/>`,
  shorts: () => `
    <rect x="84" y="150" width="52" height="16" rx="6" fill="#A16207"/>
    <rect x="85" y="154" width="24" height="34" rx="6" fill="#A16207"/>
    <rect x="111" y="154" width="24" height="34" rx="6" fill="#A16207"/>`,
  jacket: () => `
    <rect x="79" y="80" width="28" height="84" rx="10" fill="#F97316"/>
    <rect x="113" y="80" width="28" height="84" rx="10" fill="#F97316"/>
    ${longSleeves('#F97316', 17)}
    <circle cx="103" cy="104" r="2" fill="#7C2D12"/><circle cx="103" cy="124" r="2" fill="#7C2D12"/>`,
  rainPants: () => `
    <rect x="83" y="164" width="26" height="72" rx="8" fill="#FBBF24" stroke="#B45309"/>
    <rect x="111" y="164" width="26" height="72" rx="8" fill="#FBBF24" stroke="#B45309"/>`,
  socks: () => `
    <rect x="88" y="232" width="17" height="10" rx="3" fill="#F8FAFC" stroke="#94A3B8"/>
    <rect x="115" y="232" width="17" height="10" rx="3" fill="#F8FAFC" stroke="#94A3B8"/>`,
  shoes: () => `
    <rect x="80" y="238" width="30" height="14" rx="7" fill="#475569"/>
    <rect x="110" y="238" width="30" height="14" rx="7" fill="#475569"/>`,
  waterproofShoes: () => `
    <path d="M84 224 h22 v16 h6 a6 6 0 0 1 0 12 h-28 z" fill="#0F766E"/>
    <path d="M114 224 h22 v16 h6 a6 6 0 0 1 0 12 h-28 z" fill="#0F766E"/>`,
  sandals: () => `
    <rect x="82" y="248" width="28" height="5" rx="2.5" fill="#92400E"/>
    <rect x="110" y="248" width="28" height="5" rx="2.5" fill="#92400E"/>
    <path d="M86 243 h20 M114 243 h20" stroke="#92400E" stroke-width="4" stroke-linecap="round"/>`,
  scarf: () => `
    <rect x="90" y="76" width="40" height="12" rx="6" fill="#DC2626"/>
    <rect x="114" y="82" width="11" height="34" rx="4" fill="#DC2626"/>`,
  hat: () => `
    <path d="M83 48 a27 27 0 0 1 54 0 z" fill="#7C3AED"/>
    <rect x="81" y="42" width="58" height="10" rx="5" fill="#6D28D9"/>
    <circle cx="110" cy="21" r="6" fill="#DDD6FE"/>`,
  umbrella: () => `
    <path d="M160 70 q30 -44 64 0 q-8 -7 -16 0 q-8 -7 -16 0 q-8 -7 -16 0 q-8 -7 -16 0 z" fill="#4F7FE6"/>
    <path d="M192 70 v82 q0 8 -8 8 q-8 0 -8 -8" fill="none" stroke="#1E293B" stroke-width="3" stroke-linecap="round"/>`
};

function backdrop(tags) {
  const sun = '<circle cx="34" cy="34" r="14" fill="#FBBF24"/>';
  const cloud = (x, y, fill = '#CBD5E1') =>
    `<g fill="${fill}"><circle cx="${x}" cy="${y}" r="10"/><circle cx="${x + 12}" cy="${y - 5}" r="12"/><circle cx="${x + 24}" cy="${y}" r="10"/><rect x="${x}" y="${y}" width="24" height="10"/></g>`;
  const drops = '<path d="M22 64 l-3 8 M34 64 l-3 8 M46 64 l-3 8" stroke="#4F7FE6" stroke-width="3" stroke-linecap="round"/>';

  let art;
  if (tags.includes('rain')) art = cloud(18, 48, '#94A3B8') + drops;
  else if (tags.includes('sunny')) art = sun;
  else if (tags.includes('cold')) art = cloud(18, 44);
  else art = sun + cloud(26, 50);
  return `<g class="illustration-backdrop" aria-hidden="true">${art}</g>`;
}

export function sortLayers(layers) {
  return [...layers].sort((a, b) => LAYER_ORDER.indexOf(a) - LAYER_ORDER.indexOf(b));
}

export function renderOutfitIllustration(outfit) {
  const layers = sortLayers(outfit.visualLayers.filter((layer) => LAYERS[layer]));
  const label = copy.illustrationLabel(outfit.label, outfit.garments);
  const groups = ['body', ...layers]
    .map((layer) => `<g data-layer="${layer}" aria-label="${escapeHtml(LAYER_LABELS[layer])}">${LAYERS[layer]()}</g>`)
    .join('');

  return `
    <figure class="illustration">
      <svg class="illustration-svg" viewBox="0 0 240 280" role="img" aria-label="${escapeHtml(label)}" focusable="false">
        <title>${escapeHtml(label)}</title>
        ${backdrop(outfit.tags)}
        ${groups}
      </svg>
      <figcaption class="illustration-caption">${escapeHtml(copy.illustrationCaption(outfit.label))}</figcaption>
    </figure>`;
}

// Tiny garment markers for the checklist.
const MARKERS = {
  top: '<path d="M6 3 l-4 4 3 3 1-1 v9 h12 v-9 l1 1 3-3 -4-4 h-3 a3 3 0 0 1 -6 0 z"/>',
  bottom: '<path d="M5 3 h12 l1 17 h-5 l-2-10 -2 10 h-5 z"/>',
  feet: '<path d="M3 11 h8 l2 3 h6 a2 2 0 0 1 0 5 h-16 z"/>',
  head: '<path d="M4 15 a7 7 0 0 1 14 0 z M2 15 h18 v3 h-18 z"/>',
  neck: '<path d="M3 6 h16 v5 h-5 v9 h-4 v-9 h-7 z"/>',
  umbrella: '<path d="M2 11 a9 8 0 0 1 18 0 z M11 11 v7 a2 2 0 0 1 -4 0" />'
};

const GARMENT_MARKERS = {
  'Short-sleeve T-shirt': 'top',
  'Long-sleeve T-shirt': 'top',
  Sweater: 'top',
  Jacket: 'top',
  Shorts: 'bottom',
  'Long pants': 'bottom',
  'Rain pants': 'bottom',
  Socks: 'feet',
  Sandals: 'feet',
  'Closed shoes': 'feet',
  'Waterproof shoes': 'feet',
  Hat: 'head',
  Scarf: 'neck',
  Umbrella: 'umbrella'
};

export function renderGarmentMarker(garment) {
  const marker = MARKERS[GARMENT_MARKERS[garment]] ?? '<circle cx="11" cy="11" r="6"/>';
  return `<svg class="garment-marker" viewBox="0 0 22 22" aria-hidden="true" focusable="false">${marker}</svg>`;
}
