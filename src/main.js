import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/outfit/800.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './styles.css';
import { createApp } from './ui/app.js';

async function boot() {
  const root = document.querySelector('#app');

  // Development-only weather simulator, e.g. /?fixture=storm&now=15:30&state=stale.
  // Removed from production builds because import.meta.env.DEV is statically
  // false there.
  if (import.meta.env.DEV) {
    const sim = await import('./dev/simulator.js');
    const { mountSimPanel } = await import('./dev/sim-panel.js');
    let app = null;

    const mount = (config) => {
      app?.destroy();
      const deps = {};
      if (config.now) deps.now = sim.createSimClock(config.now);
      if (sim.usesSimulatedWeather(config)) deps.weatherService = sim.createSimWeatherService(config, deps.now);
      app = createApp(root, deps);
      app.start();
    };

    const config = sim.readSimConfig(window.location.search);
    mountSimPanel(document, {
      config,
      onChange(next) {
        history.replaceState(null, '', `${window.location.pathname}${sim.simSearch(next)}`);
        mount(next);
      }
    });
    mount(config);
    return;
  }

  createApp(root).start();
}

boot();
