import { copy } from '../copy.js';
import { GARMENTS, garmentLabels } from '../data/outfits.js';
import { escapeHtml } from './html.js';

// Composable SVG child figure. Each catalog garment maps to one <g>.

// Sections are drawn outer-last, which is not checklist order: shoes cover the
// trouser hems, tops and the snowsuit cover the waistband and boot tops, the
// neck warmer and hats cover the jacket collar, and the umbrella goes last.
export const DRAW_ORDER = ['low', 'bottom', 'middle', 'head', 'carry'];

// Figure geometry (viewBox 0 0 240 280): head centred at x=110.
const SKIN = '#E9C9A8';
const SKIN_LINE = '#C9A080';
const FACE = '#4A3320';

const torso = (fill, { top = 84, bottom = 158, inset = 0 } = {}) =>
  `<rect x="${82 + inset}" y="${top}" width="${56 - inset * 2}" height="${bottom - top}" rx="10" fill="${fill}"/>`;
const longSleeves = (fill, width = 14) =>
  `<rect x="${80 - width}" y="88" width="${width}" height="62" rx="7" fill="${fill}"/>` +
  `<rect x="140" y="88" width="${width}" height="62" rx="7" fill="${fill}"/>`;

const BODY = () => `
    <circle cx="110" cy="54" r="26" fill="${SKIN}" stroke="${SKIN_LINE}"/>
    <circle cx="101" cy="52" r="2.5" fill="${FACE}"/><circle cx="119" cy="52" r="2.5" fill="${FACE}"/>
    <path d="M102 63 q8 6 16 0" fill="none" stroke="${FACE}" stroke-width="2" stroke-linecap="round"/>
    <rect x="103" y="78" width="14" height="10" fill="${SKIN}"/>
    <rect x="82" y="84" width="56" height="74" rx="10" fill="${SKIN}" stroke="${SKIN_LINE}"/>
    <rect x="68" y="88" width="12" height="70" rx="6" fill="${SKIN}" stroke="${SKIN_LINE}"/>
    <rect x="140" y="88" width="12" height="70" rx="6" fill="${SKIN}" stroke="${SKIN_LINE}"/>
    <rect x="88" y="154" width="18" height="84" rx="7" fill="${SKIN}" stroke="${SKIN_LINE}"/>
    <rect x="114" y="154" width="18" height="84" rx="7" fill="${SKIN}" stroke="${SKIN_LINE}"/>
    <ellipse cx="96" cy="244" rx="12" ry="6" fill="${SKIN}" stroke="${SKIN_LINE}"/>
    <ellipse cx="124" cy="244" rx="12" ry="6" fill="${SKIN}" stroke="${SKIN_LINE}"/>`;

// Garment layers by body section; within a section, inner to outer.
export const LAYERS = {
  head: {
    sunHat: () => `
      <path d="M88 38 a22 20 0 0 1 44 0 z" fill="#FACC15"/>
      <rect x="88" y="32" width="44" height="6" fill="#CA8A04"/>
      <ellipse cx="110" cy="39" rx="40" ry="6" fill="#FDE047" stroke="#CA8A04"/>`,
    hat: () => `
      <path d="M83 48 a27 27 0 0 1 54 0 z" fill="#7C3AED"/>
      <rect x="81" y="42" width="58" height="10" rx="5" fill="#6D28D9"/>
      <circle cx="110" cy="21" r="6" fill="#DDD6FE"/>`,
    warmHat: () => `
      <path d="M82 50 a28 28 0 0 1 56 0 z" fill="#0E7490"/>
      <rect x="78" y="44" width="12" height="26" rx="6" fill="#0E7490"/>
      <rect x="130" y="44" width="12" height="26" rx="6" fill="#0E7490"/>
      <rect x="80" y="42" width="60" height="10" rx="5" fill="#155E75"/>
      <circle cx="110" cy="20" r="7" fill="#F5F5F4"/>`,
    neckWarmer: () => `
      <rect x="91" y="73" width="38" height="17" rx="7" fill="#DC2626"/>
      <path d="M100 76 v11 M110 76 v11 M120 76 v11" stroke="#B91C1C" stroke-width="2" stroke-linecap="round"/>`
  },
  middle: {
    thermalLayer: () => `
      ${torso('#EADBC8')}${longSleeves('#EADBC8')}
      <rect x="87" y="154" width="20" height="68" rx="7" fill="#EADBC8"/>
      <rect x="113" y="154" width="20" height="68" rx="7" fill="#EADBC8"/>`,
    shortTee: () => `
      ${torso('#60A5FA')}
      <rect x="66" y="86" width="16" height="26" rx="7" fill="#60A5FA"/>
      <rect x="138" y="86" width="16" height="26" rx="7" fill="#60A5FA"/>`,
    longTee: () => `${torso('#E2E8F0')}${longSleeves('#E2E8F0')}`,
    sweater: () => `
      ${torso('#2E8B73', { top: 82, bottom: 156 })}${longSleeves('#2E8B73', 15)}
      <rect x="82" y="148" width="56" height="8" rx="3" fill="#256F5C"/>`,
    jacket: () => `
      <rect x="79" y="80" width="28" height="84" rx="10" fill="#F97316"/>
      <rect x="113" y="80" width="28" height="84" rx="10" fill="#F97316"/>
      ${longSleeves('#F97316', 17)}
      <circle cx="103" cy="104" r="2" fill="#7C2D12"/><circle cx="103" cy="124" r="2" fill="#7C2D12"/>`,
    rainJacket: () => `
      <rect x="78" y="80" width="64" height="92" rx="11" fill="#FACC15" stroke="#A16207"/>
      ${longSleeves('#FACC15', 17)}
      <ellipse cx="110" cy="82" rx="24" ry="6" fill="#EAB308" stroke="#A16207"/>
      <path d="M110 88 V170" stroke="#A16207" stroke-width="2"/>`,
    snowsuit: () => `
      <rect x="80" y="80" width="60" height="86" rx="12" fill="#2563EB"/>
      ${longSleeves('#2563EB', 17)}
      <rect x="84" y="150" width="25" height="70" rx="9" fill="#2563EB"/>
      <rect x="111" y="150" width="25" height="70" rx="9" fill="#2563EB"/>
      <path d="M110 84 V160" stroke="#1E3A8A" stroke-width="2"/>`
  },
  low: {
    shorts: () => `
      <rect x="84" y="150" width="52" height="16" rx="6" fill="#A16207"/>
      <rect x="85" y="154" width="24" height="34" rx="6" fill="#A16207"/>
      <rect x="111" y="154" width="24" height="34" rx="6" fill="#A16207"/>`,
    longPants: () => `
      <rect x="84" y="150" width="52" height="16" rx="6" fill="#334E7A"/>
      <rect x="86" y="154" width="22" height="80" rx="7" fill="#334E7A"/>
      <rect x="112" y="154" width="22" height="80" rx="7" fill="#334E7A"/>`,
    mudOveralls: () => `
      <rect x="92" y="104" width="36" height="52" rx="5" fill="#0EA5E9" stroke="#0369A1"/>
      <path d="M94 106 L90 86 M126 106 L130 86" stroke="#0369A1" stroke-width="4" stroke-linecap="round"/>
      <rect x="83" y="150" width="54" height="18" rx="6" fill="#0EA5E9" stroke="#0369A1"/>
      <rect x="83" y="160" width="26" height="76" rx="8" fill="#0EA5E9" stroke="#0369A1"/>
      <rect x="111" y="160" width="26" height="76" rx="8" fill="#0EA5E9" stroke="#0369A1"/>`
  },
  bottom: {
    socks: () => `
      <rect x="88" y="232" width="17" height="10" rx="3" fill="#F8FAFC" stroke="#94A3B8"/>
      <rect x="115" y="232" width="17" height="10" rx="3" fill="#F8FAFC" stroke="#94A3B8"/>`,
    sandals: () => `
      <rect x="82" y="248" width="28" height="5" rx="2.5" fill="#92400E"/>
      <rect x="110" y="248" width="28" height="5" rx="2.5" fill="#92400E"/>
      <path d="M86 243 h20 M114 243 h20" stroke="#92400E" stroke-width="4" stroke-linecap="round"/>`,
    shoes: () => `
      <rect x="80" y="238" width="30" height="14" rx="7" fill="#475569"/>
      <rect x="110" y="238" width="30" height="14" rx="7" fill="#475569"/>`,
    waterproofShoes: () => `
      <path d="M84 224 h22 v16 h6 a6 6 0 0 1 0 12 h-28 z" fill="#0F766E"/>
      <path d="M114 224 h22 v16 h6 a6 6 0 0 1 0 12 h-28 z" fill="#0F766E"/>`,
    wellies: () => `
      <path d="M83 200 h24 v40 h6 a6 6 0 0 1 0 12 h-30 z" fill="#15803D"/>
      <path d="M113 200 h24 v40 h6 a6 6 0 0 1 0 12 h-30 z" fill="#15803D"/>
      <path d="M83 206 h24 M113 206 h24" stroke="#166534" stroke-width="3"/>`,
    winterBoots: () => `
      <path d="M82 218 h26 v20 h6 a7 7 0 0 1 0 14 h-32 z" fill="#78350F"/>
      <path d="M112 218 h26 v20 h6 a7 7 0 0 1 0 14 h-32 z" fill="#78350F"/>
      <rect x="80" y="214" width="30" height="12" rx="6" fill="#F5F5F4" stroke="#D6D3D1"/>
      <rect x="110" y="214" width="30" height="12" rx="6" fill="#F5F5F4" stroke="#D6D3D1"/>`
  },
  carry: {
    umbrella: () => `
      <path d="M160 70 q30 -44 64 0 q-8 -7 -16 0 q-8 -7 -16 0 q-8 -7 -16 0 q-8 -7 -16 0 z" fill="#4F7FE6"/>
      <path d="M192 70 v82 q0 8 -8 8 q-8 0 -8 -8" fill="none" stroke="${FACE}" stroke-width="3" stroke-linecap="round"/>`,
    gloves: () => `
      <rect x="62" y="144" width="20" height="20" rx="8" fill="#DC2626"/>
      <rect x="138" y="144" width="20" height="20" rx="8" fill="#DC2626"/>
      <circle cx="82" cy="150" r="4" fill="#DC2626"/><circle cx="138" cy="150" r="4" fill="#DC2626"/>`
  }
};

function backdrop(tags) {
  const sun = '<circle cx="34" cy="34" r="14" fill="#F4CE6A"/>';
  const cloud = (x, y, fill = '#D3E6EE') =>
    `<g fill="${fill}"><circle cx="${x}" cy="${y}" r="10"/><circle cx="${x + 12}" cy="${y - 5}" r="12"/><circle cx="${x + 24}" cy="${y}" r="10"/><rect x="${x}" y="${y}" width="24" height="10"/></g>`;
  const drops = '<path d="M22 64 l-3 8 M34 64 l-3 8 M46 64 l-3 8" stroke="#4A90B8" stroke-width="3" stroke-linecap="round"/>';
  const snow = '<g fill="#93C5FD"><circle cx="22" cy="66" r="2.5"/><circle cx="34" cy="72" r="2.5"/><circle cx="46" cy="66" r="2.5"/></g>';

  let art;
  if (tags.includes('freezing')) art = cloud(18, 48, '#C7D7E0') + snow;
  else if (tags.includes('rain')) art = cloud(18, 48, '#A8C3CF') + drops;
  else if (tags.includes('sunny')) art = sun;
  else if (tags.includes('cold')) art = cloud(18, 44);
  else art = sun + cloud(26, 50);
  return `<g class="illustration-backdrop" aria-hidden="true">${art}</g>`;
}

// The outfit's garments that have a layer, in draw order.
export function layersInDrawOrder(garmentIds) {
  return DRAW_ORDER.flatMap((section) =>
    Object.keys(LAYERS[section])
      .filter((id) => garmentIds.includes(id))
      .map((id) => ({ id, render: LAYERS[section][id] }))
  );
}

export function renderOutfitIllustration(outfit) {
  const label = copy.illustrationLabel(outfit.label, garmentLabels(outfit.garments));
  const layer = (id, label, render) => `<g data-layer="${id}" aria-label="${escapeHtml(label)}">${render()}</g>`;
  const groups =
    layer('body', copy.illustrationBody, BODY) +
    layersInDrawOrder(outfit.garments).map(({ id, render }) => layer(id, GARMENTS[id].label, render)).join('');

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
