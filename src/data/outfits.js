// Canonical outfit catalog. This is the single source of garment names for the
// UI, the rules engine, and the tests.

export const OUTFITS = [
  {
    id: 'sunny-hot',
    label: 'Sunny & hot',
    description: 'Light clothes for a dry, warm, sunny kindergarten day.',
    garments: ['Short-sleeve T-shirt', 'Shorts', 'Sandals'],
    visualLayers: ['shortTee', 'shorts', 'sandals'],
    tags: ['dry', 'warm', 'sunny']
  },
  {
    id: 'mild-dry',
    label: 'Mild & dry',
    description: 'Layers for a mild, cloudy or partly cloudy dry day.',
    garments: ['Long pants', 'Long-sleeve T-shirt', 'Sweater', 'Socks', 'Closed shoes'],
    visualLayers: ['longTee', 'sweater', 'longPants', 'socks', 'shoes'],
    tags: ['dry', 'mild']
  },
  {
    id: 'fresh-dry',
    label: 'Fresh & dry',
    description: 'A warmer outer layer for a fresh dry day.',
    garments: ['Long pants', 'Long-sleeve T-shirt', 'Sweater', 'Jacket', 'Socks', 'Closed shoes'],
    visualLayers: ['longTee', 'sweater', 'jacket', 'longPants', 'socks', 'shoes'],
    tags: ['dry', 'fresh']
  },
  {
    id: 'cold-dry',
    label: 'Cold & dry',
    description: 'Warm layers with head and neck protection for a cold dry day.',
    garments: ['Long pants', 'Long-sleeve T-shirt', 'Sweater', 'Jacket', 'Scarf', 'Hat', 'Socks', 'Closed shoes'],
    visualLayers: ['longTee', 'sweater', 'jacket', 'longPants', 'scarf', 'hat', 'socks', 'shoes'],
    tags: ['dry', 'cold']
  },
  {
    id: 'cold-rain',
    label: 'Cold & rainy',
    description: 'Warm, rain-ready layers for a cold wet day.',
    garments: ['Long pants', 'Long-sleeve T-shirt', 'Sweater', 'Jacket', 'Scarf', 'Hat', 'Umbrella', 'Socks', 'Waterproof shoes', 'Rain pants'],
    visualLayers: ['longTee', 'sweater', 'jacket', 'longPants', 'scarf', 'hat', 'socks', 'waterproofShoes', 'rainPants', 'umbrella'],
    tags: ['rain', 'cold']
  }
];

// Add-ons extend a base outfit without inventing a new catalog record,
// e.g. a mild dry outfit on a day where rain is likely.
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

export function outfitHasLayers(outfit, layers) {
  return layers.every((layer) => outfit.visualLayers.includes(layer));
}

export function outfitHasAnyLayer(outfit, layers) {
  return layers.some((layer) => outfit.visualLayers.includes(layer));
}
