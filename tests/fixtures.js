// Test fixtures. The weather scenarios live in src/dev/scenarios.js so the
// development-only simulator can use them too.
export { FIXTURE_DATE, SCENARIOS, buildRawForecast, normalizedScenario, rawScenario } from '../src/dev/scenarios.js';

// Minimal Response stand-in for mocked fetch.
export function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}
