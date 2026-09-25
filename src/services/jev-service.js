import { OUTFITS } from '../data/outfits.js';

// Jev via OpenRouter's Decisions API. Jev picks from the supplied catalog only;
// the result is validated locally before it can replace the rules outcome.

export const JEV_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';
export const JEV_MODEL = 'typesafe/jev-1.13';
export const JEV_TIMEOUT_MS = 15000;

const CHILD_CONTEXT =
  'A toddler attends kindergarten. This app only chooses from the supplied outfits; the parent makes the final decision.';

// Error messages never include the key or a response body.
export class JevServiceError extends Error {
  constructor(code, { status } = {}) {
    super(`AI decision failed: ${code}${status ? ` (HTTP ${status})` : ''}`);
    this.name = 'JevServiceError';
    this.code = code;
    this.status = status ?? null;
  }
}

function describeGarments(garments) {
  const items = garments.map((garment, index) =>
    index === 0 ? garment : garment.charAt(0).toLowerCase() + garment.slice(1)
  );
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

export function buildJevRequest({ daySummary, outfits = OUTFITS }) {
  const available = Object.fromEntries(
    outfits.map((outfit) => [outfit.id, `${describeGarments(outfit.garments)}. ${outfit.description}`])
  );
  const criteria = Object.fromEntries(outfits.map((outfit) => [outfit.id, outfit.decisionCriteria]));

  return {
    model: JEV_MODEL,
    state: {
      location: 'Berlin',
      child_context: CHILD_CONTEXT,
      assessment_window: `${daySummary.window.start}–${daySummary.window.end} Europe/Berlin`,
      weather: {
        min_apparent_c: daySummary.minApparentC,
        max_apparent_c: daySummary.maxApparentC,
        rain_likely: daySummary.rainLikely,
        max_rain_probability_percent: daySummary.maxRainProbability,
        precipitation_total_mm: daySummary.precipitationTotalMm,
        sunny_fraction: daySummary.sunnyFraction,
        max_wind_kmh: daySummary.maxWindKmh
      },
      available_outfits: available
    },
    questions: {
      recommended_outfit: {
        type: 'choice',
        instructions:
          'Choose exactly one available outfit ID. Prefer rain protection when rain is likely and warmer layers when the apparent temperature is low. Never choose an ID not listed in the criteria.',
        criteria
      },
      rain_gear_required: {
        type: 'noul',
        instructions: 'Is rain gear important for the kindergarten assessment window?',
        criteria: {
          true: 'Rain is likely or meaningful precipitation is forecast during the assessment window.',
          false: 'Rain is not likely and little or no precipitation is forecast during the assessment window.'
        }
      },
      warmth_level: {
        type: 'score',
        instructions: 'How much warmth is appropriate for the assessment window?',
        criteria: ['Light clothes only', 'Light layers', 'Jacket needed', 'Jacket, scarf, and hat needed']
      }
    }
  };
}

const finiteOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function normalizeJevResponse(json) {
  const outfitAnswer = json?.answers?.recommended_outfit;
  if (!outfitAnswer || typeof outfitAnswer !== 'object' || typeof outfitAnswer.choice !== 'string') {
    throw new JevServiceError('malformed');
  }
  const rainAnswer = json.answers.rain_gear_required;
  const warmthAnswer = json.answers.warmth_level;

  return {
    requested: true,
    accepted: false,
    type: outfitAnswer.type ?? null,
    outfitId: outfitAnswer.choice,
    confidence: finiteOrNull(outfitAnswer.confidence),
    rainGearProbability: finiteOrNull(rainAnswer?.noul),
    warmthScore: finiteOrNull(warmthAnswer?.score),
    source: 'jev'
  };
}

export async function requestJevDecision({
  apiKey,
  daySummary,
  outfits = OUTFITS,
  signal,
  fetchImpl = globalThis.fetch.bind(globalThis),
  timeoutMs = JEV_TIMEOUT_MS
}) {
  if (!apiKey) throw new JevServiceError('missing-key');

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    let response;
    try {
      response = await fetchImpl(JEV_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildJevRequest({ daySummary, outfits })),
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      });
    } catch {
      // Network failure or CORS block. Do not attach the original error: some
      // runtimes echo request details in it.
      throw new JevServiceError(timedOut ? 'timeout' : signal?.aborted ? 'aborted' : 'network');
    }

    if (!response.ok) {
      throw new JevServiceError(response.status === 401 || response.status === 403 ? 'unauthorized' : 'http', {
        status: response.status
      });
    }

    let json;
    try {
      json = await response.json();
    } catch {
      throw new JevServiceError(timedOut ? 'timeout' : 'malformed');
    }
    return normalizeJevResponse(json);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}
