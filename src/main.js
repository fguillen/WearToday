import './styles.css';
import { createApp } from './ui/app.js';

async function boot() {
  const root = document.querySelector('#app');
  const deps = {};

  // Development-only fixture switch, e.g. /?fixture=cold-rain. Removed from
  // production builds because import.meta.env.DEV is statically false there.
  if (import.meta.env.DEV) {
    const fixtureName = new URLSearchParams(window.location.search).get('fixture');
    if (fixtureName) {
      const { createFixtureWeatherService } = await import('../tests/fixtures.js');
      deps.weatherService = createFixtureWeatherService(fixtureName);
    }
  }

  createApp(root, deps).start();
}

boot();
