import { afterEach, beforeEach, vi } from 'vitest';

// jsdom has no canvas implementation; return null quietly so the app takes its
// "chart unavailable" path unless a test injects its own drawChart.
HTMLCanvasElement.prototype.getContext = function getContext() {
  return null;
};

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = '';
});
