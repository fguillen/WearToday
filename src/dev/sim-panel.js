// Development-only floating panel for the weather simulator. Lives outside
// #app so re-mounting the app does not wipe it.
import './sim-panel.css';
import { SCENARIOS } from './scenarios.js';
import { SIM_STATES } from './simulator.js';

const COLLAPSED_KEY = 'ready-to-go:sim-panel:collapsed';
const SCENARIO_NAMES = Object.keys(SCENARIOS);
// 06:00–23:30 so the edges outside the tracked 07:00–22:00 day can be checked too.
const MIN_MINUTES = 6 * 60;
const MAX_MINUTES = 23 * 60 + 30;
const STEP_MINUTES = 30;
const DEFAULT_MINUTES = 9 * 60;

const pad = (value) => String(value).padStart(2, '0');
const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHhmm = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const clampMinutes = (minutes) => Math.min(Math.max(minutes, MIN_MINUTES), MAX_MINUTES);

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Storage unavailable: the panel simply opens expanded next time.
  }
}

function renderPanel() {
  const scenarioOptions = SCENARIO_NAMES.map((name) => `<option value="${name}">${name}</option>`).join('');
  const stateOptions = SIM_STATES.map(
    (state) => `<label class="sim-state"><input type="radio" name="sim-state" value="${state}"> ${state}</label>`
  ).join('');
  return `
    <summary>Weather sim <span class="sim-summary" data-sim="summary"></span></summary>
    <div class="sim-body">
      <label class="sim-field">
        <span class="sim-label">Scenario</span>
        <select data-sim="fixture">
          <option value="">Live weather</option>
          ${scenarioOptions}
        </select>
      </label>
      <div class="sim-field">
        <span class="sim-label">Time <output data-sim="time-label"></output></span>
        <label class="sim-check"><input type="checkbox" data-sim="real-time"> Real time</label>
        <input type="range" data-sim="time" min="${MIN_MINUTES}" max="${MAX_MINUTES}" step="${STEP_MINUTES}" aria-label="Simulated time">
      </div>
      <fieldset class="sim-field">
        <legend class="sim-label">Service</legend>
        <div class="sim-states">${stateOptions}</div>
      </fieldset>
      <p class="sim-hint">Alt+↑/↓ scenario · Alt+←/→ time · <a href="?" data-sim="clear">Clear</a></p>
    </div>
  `;
}

// `onChange(config)` fires with the full new config after every edit.
export function mountSimPanel(doc, { config: initialConfig, onChange }) {
  let config = { ...initialConfig };
  const panel = doc.createElement('details');
  panel.className = 'sim-panel';
  panel.open = !readCollapsed();
  panel.innerHTML = renderPanel();
  doc.body.append(panel);

  const $ = (name) => panel.querySelector(`[data-sim="${name}"]`);
  const fixture = $('fixture');
  const realTime = $('real-time');
  const time = $('time');
  const timeLabel = $('time-label');
  const summary = $('summary');
  const states = [...panel.querySelectorAll('input[name="sim-state"]')];

  function sync() {
    fixture.value = config.fixture ?? '';
    realTime.checked = !config.now;
    time.disabled = !config.now;
    time.value = String(config.now ? toMinutes(config.now) : DEFAULT_MINUTES);
    timeLabel.textContent = config.now ?? 'now';
    for (const radio of states) radio.checked = radio.value === config.state;
    const parts = [config.fixture ?? 'live', config.now, config.state !== 'ready' && config.state].filter(Boolean);
    summary.textContent = `· ${parts.join(' · ')}`;
  }

  function update(patch) {
    config = { ...config, ...patch };
    sync();
    onChange(config);
  }

  fixture.addEventListener('change', () => update({ fixture: fixture.value || null }));
  realTime.addEventListener('change', () => update({ now: realTime.checked ? null : toHhmm(Number(time.value)) }));
  // Label follows the thumb while dragging; the app re-mounts on release.
  time.addEventListener('input', () => (timeLabel.textContent = toHhmm(Number(time.value))));
  time.addEventListener('change', () => update({ now: toHhmm(Number(time.value)) }));
  for (const radio of states) radio.addEventListener('change', () => update({ state: radio.value }));
  $('clear').addEventListener('click', (event) => {
    event.preventDefault();
    update({ fixture: null, now: null, state: 'ready' });
  });
  panel.addEventListener('toggle', () => writeCollapsed(!panel.open));

  // Alt+arrows sweep through every combination without touching the mouse.
  doc.addEventListener('keydown', (event) => {
    if (!event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const names = [null, ...SCENARIO_NAMES];
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = (names.indexOf(config.fixture) + step + names.length) % names.length;
      event.preventDefault();
      update({ fixture: names[next] });
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const step = event.key === 'ArrowRight' ? STEP_MINUTES : -STEP_MINUTES;
      const current = config.now ? toMinutes(config.now) : DEFAULT_MINUTES - step;
      event.preventDefault();
      update({ now: toHhmm(clampMinutes(current + step)) });
    }
  });

  sync();
  return panel;
}
