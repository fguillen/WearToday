import { OUTFITS, getOutfitById, outfitHasAnyLayer, outfitHasLayers } from '../data/outfits.js';
import { DEFAULTS } from './recommendation.js';

// Local guardrail for AI output. The AI may only replace the rules outcome when
// every check passes; the rules engine stays the safety authority.

export const REJECTION_REASONS = Object.freeze({
  invalidShape: 'invalid-shape',
  invalidType: 'invalid-type',
  unknownOutfit: 'unknown-outfit',
  lowConfidence: 'low-confidence',
  rainInadequate: 'rain-inadequate',
  coldInadequate: 'cold-inadequate',
  overLayered: 'over-layered',
  rainConflict: 'rain-conflict'
});

const COLD_LAYERS = ['jacket', 'hat', 'scarf'];
// Probability that rain gear is required; values beyond these bounds disagree
// strongly with the local precipitation summary.
const RAIN_CONFLICT_LOW = 0.2;
const RAIN_CONFLICT_HIGH = 0.8;

const reject = (reason) => ({ accepted: false, reason });

export function validateAiDecision({ decision, daySummary, outfits = OUTFITS, defaults = DEFAULTS }) {
  if (!decision || typeof decision !== 'object' || typeof decision.outfitId !== 'string') {
    return reject(REJECTION_REASONS.invalidShape);
  }
  if (!daySummary || typeof daySummary !== 'object') return reject(REJECTION_REASONS.invalidShape);
  if (decision.type !== 'choice') return reject(REJECTION_REASONS.invalidType);

  const outfit = getOutfitById(decision.outfitId, outfits);
  if (!outfit) return reject(REJECTION_REASONS.unknownOutfit);

  const confidence = Number.isFinite(decision.confidence) ? decision.confidence : 0;
  if (confidence < defaults.minimumAiConfidence) return reject(REJECTION_REASONS.lowConfidence);

  const isCold = daySummary.minApparentC < defaults.coldRainMaximumApparentC;
  if (daySummary.rainLikely && !outfit.tags.includes('rain')) {
    // Warm-rain path: a dry base outfit is acceptable because the app adds the
    // "Pack rain gear" add-on. On a cold wet day only a rain outfit will do.
    if (isCold) return reject(REJECTION_REASONS.rainInadequate);
  }

  if (daySummary.minApparentC < defaults.freshMinimumApparentC && !outfitHasLayers(outfit, COLD_LAYERS)) {
    return reject(REJECTION_REASONS.coldInadequate);
  }

  if (daySummary.hotAndSunny && outfitHasAnyLayer(outfit, COLD_LAYERS)) {
    return reject(REJECTION_REASONS.overLayered);
  }

  const rainGear = decision.rainGearProbability;
  if (Number.isFinite(rainGear)) {
    const conflicts = daySummary.rainLikely ? rainGear < RAIN_CONFLICT_LOW : rainGear > RAIN_CONFLICT_HIGH;
    if (conflicts) return reject(REJECTION_REASONS.rainConflict);
  }

  return { accepted: true, reason: null };
}
