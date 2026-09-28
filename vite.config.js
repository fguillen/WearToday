import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // Installable, offline app shell. The service worker only exists in
    // production builds; forecast data stays in the app's own cache.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeManifestIcons: false,
      manifest: {
        name: 'Ready to go',
        short_name: 'Ready to go',
        description: 'What should a toddler wear to kindergarten in Berlin today?',
        lang: 'en',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        theme_color: '#A8D7E8',
        background_color: '#FFFFFF',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html'
      }
    })
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js']
  }
});
