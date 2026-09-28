# Ready to go

**What should a toddler wear to kindergarten in Berlin today?**

Ready to go is a small web app for the morning rush. It reads today's
Berlin forecast and suggests one outfit for a three-year-old, with an
illustration, a garment checklist, an hour-by-hour weather chart and the
reasons behind the choice ("Feels like 7°C in the morning", "Rain is likely
(up to 70%)").

It is a suggestion, not a safety guarantee. The parent still decides,
keeping in mind the child, the day's activities and the kindergarten's rules.

Live at **https://fguillen.github.io/ToddlerOutfitAdvisor/**.

## Features

- **One clear answer.** A single recommended outfit, drawn as a layered SVG
  illustration, with a checklist grouped by head, body, legs, feet and things
  to carry.
- **Transparent reasons.** Short chips show the weather signals that drove
  the choice.
- **Hourly forecast.** A Canvas chart of temperature, feels-like temperature
  and chance of rain from 07:00 to 22:00, with rain amounts, condition icons
  and a text table for screen readers.
- **Only the hours ahead count.** The recommendation looks at the time from
  now until 22:00 and updates when the hour changes.
- **Handles bad connections.** Requests time out after 8 seconds and fall
  back to a second weather model. The last saved forecast is shown, marked as
  outdated, while a new one loads or if loading fails.
- **Installable and offline-ready.** A Progressive Web App: add it to the
  home screen and it opens full screen, loads without a connection, and
  shows today's last saved forecast when offline.
- **Private.** No accounts, analytics, cookies or backend. The only network
  request goes to the weather API.
- **No framework.** Plain JavaScript, Vite and Vitest.

## How the outfit is chosen

Choosing an outfit uses fixed, local rules. No AI service is involved. The app
looks at the hours from now until 22:00 (Berlin time) and picks from a fixed
catalog of eight outfits:

| Outfit | When |
| --- | --- |
| Freezing | Feels colder than 0°C at some point |
| Pouring rain | Rain likely and at least 5 mm expected |
| Cold & rainy | Rain likely and feels colder than 12°C |
| Rainy & mild | Rain likely otherwise |
| Sunny & hot | Dry, always feels 22°C or warmer, and mostly clear skies |
| Mild & dry | Dry and always feels 16°C or warmer |
| Fresh & dry | Dry and always feels 9°C or warmer |
| Cold & dry | Anything colder |

"Rain likely" means any hour has a 50% or higher chance of rain, or at least
0.3 mm is expected in total. The rules are checked from top to bottom. All
thresholds are defaults in `DEFAULTS`
([src/domain/recommendation.js](src/domain/recommendation.js)). Outfits and
garments are defined in [src/data/outfits.js](src/data/outfits.js).

## Getting started

Requirements: [Node.js](https://nodejs.org/) 20.19+ or 22.12+ (Vite 7 needs
one of these).

```bash
git clone <this-repo-url>
cd ToddlerOutfitAdvisor
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173). You do not
need an API key.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Build the production site into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run the tests in watch mode |

### Weather simulator (development only)

In `npm run dev`, a floating panel lets you try the app with sample weather
instead of the live forecast. Every setting is stored in the URL, so you can
bookmark any view:

```text
/?fixture=storm&now=15:30
/?fixture=snow&state=stale
```

- `fixture` is a sample day: one for each outfit (`sunny-hot`, `mild-dry`,
  `fresh-dry`, `cold-dry`, `hot-rain`, `cold-rain`, `super-rain`,
  `super-cold`), plus `snow`, `storm`, `fog`, `drizzle` and `windy`.
- `now` freezes the clock at a Berlin time such as `08:00`.
- `state` simulates `loading`, `offline` or `stale` data.

The simulator is left out of production builds.

## Project structure

```text
index.html                  App shell
src/
  main.js                   Entry point (mounts the dev simulator only in development)
  copy.js                   All user-facing text, kept together for future translation
  data/outfits.js           Garment and outfit catalog
  domain/forecast.js        Converts Open-Meteo data into the app's format; time helpers
  domain/recommendation.js  Thresholds and outfit rules
  services/weather-service.js  Open-Meteo requests, timeout, fallback, cache
  ui/                       Rendering: app shell, outfit card, SVG illustration, chart, icons
  dev/                      Development-only weather simulator and sample days
tests/                      Vitest unit and DOM tests (jsdom)
PRODUCT.md                  Full product and design specification
```

## Deployment

The live site is served by GitHub Pages at
https://fguillen.github.io/ToddlerOutfitAdvisor/. Every push to `main` runs
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which runs the
tests, builds with `--base=/ToddlerOutfitAdvisor/` and publishes `dist/`. It
can also be started by hand from the repository's Actions tab.

To host it somewhere else: the build output is a static site, so any static host works (GitHub Pages,
Netlify, Cloudflare Pages, an S3 bucket and so on):

```bash
npm run build   # upload the contents of dist/
```

If the site is served from a subpath, for example
`https://<user>.github.io/<repo>/`, set Vite's base path when building:

```bash
npx vite build --base=/<repo>/
```

### Progressive Web App

[`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) generates the web app
manifest and a service worker that precaches the app shell, fonts and icons.
The forecast itself is not cached by the service worker. The app keeps today's
last forecast in `localStorage`, so offline launches show it as outdated.
New deployments update installed apps silently; the next launch runs the new
version.

The service worker only exists in production builds. To try installing and
going offline locally, use `npm run build && npm run preview`, not
`npm run dev`.

The icons in `public/` were generated once from `public/icon.svg` with
[`@vite-pwa/assets-generator`](https://vite-pwa-org.netlify.app/assets-generator/),
full-bleed with no padding and a sky-blue background for the maskable and
Apple icons.

## Weather data

Forecasts come from [Open-Meteo](https://open-meteo.com/). The app uses the
German Weather Service's (DWD) ICON-D2 model and falls back to Open-Meteo's
automatic model choice. Weather data is licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and the app credits
it in the footer. Keep that credit if you fork the project.

Open-Meteo's free API is for **non-commercial use** only and has rate limits.
Commercial use needs an
[Open-Meteo API plan](https://open-meteo.com/en/pricing).

## Contributing

Issues and pull requests are welcome. Please run `npm test` before opening a
pull request, and add or change outfits only in `src/data/outfits.js`.
[PRODUCT.md](PRODUCT.md) describes the intended behaviour in detail.

## License

The code is released under the [MIT License](LICENSE.txt).

Third-party material:

- The [Outfit](https://fonts.google.com/specimen/Outfit) and
  [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)
  fonts are bundled via Fontsource and licensed under the SIL Open Font
  License 1.1.
- Weather data © Open-Meteo and DWD, licensed under CC BY 4.0.
