// Canonical garment and outfit catalogs. This is the single source of garment
// names for the UI, the rules engine, and the tests.

// Body sections, top to bottom, in checklist order.
export const SECTIONS = ['head', 'middle', 'low', 'bottom', 'carry'];

// Keyed by id; the id is also the illustration layer and the icon name.
// Within a section, catalog order is dressing and display order.
export const GARMENTS = {
  sunHat: { label: 'Sun hat', section: 'head' },
  hat: { label: 'Hat', section: 'head' },
  warmHat: { label: 'Warm hat', section: 'head' },
  neckWarmer: { label: 'Neck warmer', section: 'head' },

  thermalLayer: { label: 'Thermal underwear', section: 'middle' },
  shortTee: { label: 'Short-sleeve T-shirt', section: 'middle' },
  longTee: { label: 'Long-sleeve T-shirt', section: 'middle' },
  sweater: { label: 'Sweater', section: 'middle' },
  jacket: { label: 'Jacket', section: 'middle' },
  rainJacket: { label: 'Rain jacket', section: 'middle' },
  snowsuit: { label: 'Snowsuit', section: 'middle' },

  shorts: { label: 'Shorts', section: 'low' },
  longPants: { label: 'Long pants', section: 'low' },
  mudOveralls: { label: 'Mud overalls', section: 'low' },

  socks: { label: 'Socks', section: 'bottom' },
  sandals: { label: 'Sandals', section: 'bottom' },
  shoes: { label: 'Closed shoes', section: 'bottom' },
  waterproofShoes: { label: 'Waterproof shoes', section: 'bottom', note: '(water shoes)' },
  wellies: { label: 'Wellington boots', section: 'bottom' },
  winterBoots: { label: 'Winter boots', section: 'bottom' },

  umbrella: { label: 'Umbrella', section: 'carry' },
  gloves: { label: 'Gloves', section: 'carry' }
};

export const OUTFITS = [
  {
    id: 'sunny-hot',
    label: 'Sunny & hot',
    description: 'Light clothes and sun protection for a dry, warm, sunny day.',
    garments: ['sunHat', 'shortTee', 'shorts', 'sandals'],
    tags: ['dry', 'warm', 'sunny']
  },
  {
    id: 'warm-dry',
    label: 'Warm & dry',
    description: 'Light clothes for a dry, warm day, sunny or not.',
    garments: ['shortTee', 'shorts', 'sandals'],
    tags: ['dry', 'warm']
  },
  {
    id: 'mild-dry',
    label: 'Mild & dry',
    description: 'Layers for a mild, cloudy or partly cloudy dry day.',
    garments: ['longTee', 'sweater', 'longPants', 'socks', 'shoes'],
    tags: ['dry', 'mild']
  },
  {
    id: 'fresh-dry',
    label: 'Fresh & dry',
    description: 'A warmer outer layer for a fresh dry day.',
    garments: ['longTee', 'sweater', 'jacket', 'longPants', 'socks', 'shoes'],
    tags: ['dry', 'fresh']
  },
  {
    id: 'cold-dry',
    label: 'Cold & dry',
    description: 'Warm layers with head and neck protection for a cold dry day.',
    garments: ['hat', 'neckWarmer', 'longTee', 'sweater', 'jacket', 'longPants', 'socks', 'shoes'],
    tags: ['dry', 'cold']
  },
  {
    id: 'hot-rain',
    label: 'Rainy & mild',
    description: 'A rain jacket and waterproof shoes for a mild wet day.',
    garments: ['longTee', 'sweater', 'rainJacket', 'longPants', 'socks', 'waterproofShoes'],
    tags: ['rain', 'waterproof', 'mild']
  },
  {
    id: 'cold-rain',
    label: 'Cold & rainy',
    description: 'Warm, rain-ready layers for a cold wet day.',
    garments: ['hat', 'neckWarmer', 'longTee', 'sweater', 'jacket', 'longPants', 'mudOveralls', 'socks', 'waterproofShoes', 'umbrella'],
    tags: ['rain', 'waterproof', 'cold']
  },
  {
    id: 'super-rain',
    label: 'Pouring rain',
    description: 'Full rain gear for a day with heavy rain.',
    garments: ['longTee', 'sweater', 'rainJacket', 'longPants', 'mudOveralls', 'socks', 'wellies', 'umbrella'],
    tags: ['rain', 'waterproof']
  },
  {
    id: 'super-cold',
    label: 'Freezing',
    description: 'A snowsuit over warm layers for a freezing day.',
    garments: ['thermalLayer', 'longTee', 'sweater', 'snowsuit', 'warmHat', 'neckWarmer', 'socks', 'winterBoots', 'gloves'],
    tags: ['cold', 'freezing', 'waterproof']
  }
];

// Add-ons extend a base outfit without inventing a new catalog record,
// e.g. a dry outfit on a day where rain is likely.
export const ADD_ONS = {
  'rain-gear': {
    id: 'rain-gear',
    label: 'Pack rain gear',
    note: 'Rain is likely today, but it is not cold. Keep the lighter outfit and bring rain protection.'
  }
};

export function getOutfitById(id, outfits = OUTFITS) {
  return outfits.find((outfit) => outfit.id === id) ?? null;
}

export function getGarment(id) {
  return GARMENTS[id] ?? null;
}

export const garmentLabels = (ids) => ids.map((id) => GARMENTS[id]?.label ?? id);

// Groups garment ids by body section, in SECTIONS order and catalog order
// within a section. Unknown ids land in "carry"; empty sections are skipped.
export function groupBySection(ids) {
  const catalogOrder = Object.keys(GARMENTS);
  const sectionOf = (id) => GARMENTS[id]?.section ?? 'carry';
  const rank = (id) => (id in GARMENTS ? catalogOrder.indexOf(id) : catalogOrder.length);
  return SECTIONS.map((section) => ({
    section,
    garments: ids.filter((id) => sectionOf(id) === section).sort((a, b) => rank(a) - rank(b))
  })).filter((group) => group.garments.length > 0);
}
