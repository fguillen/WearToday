// Inline SVG icons (24×24 viewBox). Stroke icons inherit `currentColor`; the
// CSS decides size and colour. All icons are decorative: callers pair them with
// visible text.

const STROKE = {
  // Garments
  sunHat: '<path d="M6 15a6 6 0 0 1 12 0"/><path d="M2 16c3 2 17 2 20 0"/>',
  hat: '<path d="M5 18a7 7 0 0 1 14 0v2H5z"/><path d="M4 20h16"/><circle cx="12" cy="8.5" r="1.5"/>',
  warmHat: '<path d="M5 16a7 7 0 0 1 14 0"/><path d="M4 16h16v2H4z"/><path d="M6 18v3M18 18v3"/><circle cx="12" cy="6.5" r="1.5"/>',
  neckWarmer: '<rect x="5" y="7" width="14" height="10" rx="3"/><path d="M9 7v10M12 7v10M15 7v10"/>',
  thermalLayer: '<path d="M9 3L5 5v8h3V7v7h8V7v6h3V5l-4-2a3 3 0 0 1-6 0z"/><path d="M8 14l-1 7h4l1-4 1 4h4l-1-7"/>',
  shortTee: '<path d="M4 8l4-3 4 2 4-2 4 3v2l-3 1v9H7v-9L4 10z"/>',
  longTee: '<path d="M9 4L4 7v12h3v-9 10h10V10v9h3V7l-5-3a3 3 0 0 1-6 0z"/>',
  sweater: '<path d="M3 9l5-4 4 2 4-2 5 4v3l-4 1v7H7v-7l-4-1z"/><path d="M7 16h10"/>',
  jacket: '<path d="M5 8l4-4 3 2 3-2 4 4v12H5z"/><path d="M12 6v14"/>',
  rainJacket: '<path d="M8 6a4 4 0 0 1 8 0l3 3v11H5V9z"/><path d="M8 6h8"/><path d="M12 10v10"/>',
  snowsuit: '<path d="M8 3h8l3 4v6h-3v8h-3l-1-6-1 6H8v-8H5V7z"/><path d="M12 4v9"/>',
  longPants: '<path d="M6 4h12l1 16h-5l-2-8-2 8H5z"/>',
  shorts: '<path d="M6 4h12l1 9h-5l-2-4-2 4H5z"/>',
  mudOveralls: '<path d="M8 3v6M16 3v6"/><path d="M7 9h10l1 12h-5l-1-6-1 6H6z"/>',
  socks: '<path d="M8 3h5v8l5 3a2.5 2.5 0 0 1-2 5l-8-4z"/><path d="M8 6h5"/>',
  shoes: '<path d="M3 17c0-2.5 1.5-5 4-5h3l3 3h5a3 3 0 0 1 3 3v1H3z"/><path d="M3 19h18"/>',
  waterproofShoes: '<path d="M7 3h6v10l5 2a2 2 0 0 1 1.5 2v3H7z"/><path d="M7 17h12.5"/>',
  wellies: '<path d="M7 2h7v14l5 2a2 2 0 0 1 1 2v2H7z"/><path d="M7 5h7"/>',
  winterBoots: '<path d="M7 8h7v7l5 2a2 2 0 0 1 1 2v3H7z"/><path d="M6 5h9v3H6z"/>',
  sandals: '<path d="M3 19h18"/><path d="M5 19c0-4 3-7 7-7s7 3 7 7"/><path d="M9 13l3 6 3-6"/>',
  umbrella: '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6a2 2 0 0 1-4 0"/>',
  gloves: '<path d="M8 21h8v-3l3-5a2 2 0 0 0-3.4-2L15 12V7a4 4 0 0 0-8 0v8l1 3z"/><path d="M8 18h8"/>',

  // Weather
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cloud: '<path d="M7 19h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11.5 3.8 3.8 0 0 0 7 19z"/>',
  cloudSun: '<path d="M8 3v1.5M3.8 5.8l1 1M2 10h1.5"/><path d="M5.3 12.7a4 4 0 0 1 6.6-4.8"/><path d="M9 20h8a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 13.6 3.2 3.2 0 0 0 9 20z"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 7.5 3.8 3.8 0 0 0 7 15z"/><path d="M8 18l-1 3m5-3-1 3m5-3-1 3"/>',
  snow: '<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 7.5 3.8 3.8 0 0 0 7 15z"/><path d="M8 19h.01M12 21h.01M16 19h.01"/>',
  storm: '<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 7.5 3.8 3.8 0 0 0 7 15z"/><path d="M13 14l-2 4h3l-2 4"/>',
  fog: '<path d="M4 9h16M3 13h18M5 17h14"/>',
  unknown: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
  umbrellaRain: '<path d="M12 3a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8z"/><path d="M12 11v7a2 2 0 0 1-4 0"/>',

  // Interface
  refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>'
};

const FILL = {
  sparkle: '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
  heart: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/>'
};

// WMO glyph names from forecast.js → stroke icon names above.
const WEATHER_ICONS = {
  sun: 'sun',
  'sun-cloud': 'cloudSun',
  'cloud-sun': 'cloudSun',
  cloud: 'cloud',
  fog: 'fog',
  drizzle: 'rain',
  rain: 'rain',
  snow: 'snow',
  storm: 'storm'
};

export const hasIcon = (name) => name in STROKE || name in FILL;

export function icon(name, className = '') {
  const cls = className ? ` class="${className}"` : '';
  if (FILL[name]) {
    return `<svg${cls} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${FILL[name]}</svg>`;
  }
  return `<svg${cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${STROKE[name] ?? STROKE.unknown}</svg>`;
}

export function weatherIcon(glyph, className = '') {
  return icon(WEATHER_ICONS[glyph] ?? 'unknown', className);
}
