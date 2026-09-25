// All parent-facing strings live here so a German translation can be added later.

export const LOCALE = 'en-GB';
export const TIMEZONE = 'Europe/Berlin';

const pad = (value) => String(value).padStart(2, '0');

export const copy = {
  brand: 'Ready for Kindergarten',
  locationLabel: 'Berlin',
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  updatedAt: (time) => `Updated ${time}`,
  lastUpdatedAt: (time) => `Last updated at ${time}.`,
  retry: 'Try again',
  loadingForecast: 'Loading today’s forecast…',

  // Snapshot
  todayHeading: (dateLabel) => `Today in Berlin · ${dateLabel}`,
  nowLine: ({ temperature, feelsLike, condition }) =>
    `${temperature}°C now · feels like ${feelsLike}°C · ${condition}`,
  windowNote: (start, end) => `We check ${start}–${end} for kindergarten.`,
  staleNotice: 'Showing a saved forecast. It may be out of date.',
  weatherErrorTitle: 'Forecast unavailable',
  weatherError: 'Today’s forecast could not load. Check your connection and try again.',
  weatherTimeout: 'The forecast took too long to load. Check your connection and try again.',

  // Recommendation card
  putOnToday: 'Put on today',
  outfitPending: 'Your outfit recommendation appears once the forecast has loaded.',
  garmentListLabel: 'Garments to put on',
  garmentNotes: { 'Waterproof shoes': '(water shoes)' },
  reasonsLabel: 'Why this outfit',
  illustrationCaption: (label) => `Illustration: ${label} outfit`,
  illustrationLabel: (label, garments) => `Illustration: ${label} outfit — ${garments.join(', ')}`,
  decisionDetails: 'View decision details',
  sourceRules: 'Weather rules',
  sourceAiAccepted: 'AI decision checked against weather rules',
  sourceAiRejected: 'Weather rules used because the AI result was uncertain',
  aiRejectedStatus:
    'Weather rules selected this outfit because the AI result was uncertain. You can still review the forecast below.',
  aiFailed: 'The AI decision could not be loaded. Weather rules are still active.',
  aiAcceptedDetail: (percent) => `AI decision used · confidence ${percent}% · checked against local weather rules.`,
  aiRejectedDetail: 'The AI suggestion did not pass the local weather check, so the weather rules decided.',
  aiNotRequestedDetail: 'Chosen by local weather rules. No AI was used.',
  detailWindow: (start, end, count) => `Checked ${start}–${end} (${count} hours).`,
  detailFeels: (min, max) => `Feels like ${min}°C to ${max}°C.`,
  detailRain: (percent, mm) => `Rain chance up to ${percent}% · ${mm} mm expected.`,
  detailWind: (kmh) => `Wind up to ${kmh} km/h.`,
  detailSun: (percent) => `Mostly clear skies ${percent}% of the hours.`,
  useAiDecision: 'Use AI decision',
  checkingOptions: 'Checking the options…',
  changeKey: 'Change key',
  forgetKey: 'Forget key',
  keyForgotten: 'Key forgotten. Weather rules are active.',

  // Reasons (short chips)
  reasonFeelsLike: (temp, when) => `Feels like ${temp}°C ${when}`,
  reasonWarmsTo: (temp) => `Warming to ${temp}°C later`,
  reasonRainLikely: (when, percent) => `Rain likely ${when} (up to ${percent}%)`,
  reasonRainAmount: (mm) => `Showers possible (${mm} mm)`,
  reasonDry: 'Dry during kindergarten hours',
  reasonSunny: 'Mostly sunny',
  reasonBreezy: (kmh) => `Breezy — up to ${kmh} km/h`,
  reasonWindy: (kmh) => `Windy — up to ${kmh} km/h`,
  timeOfDay: (hour) => {
    if (hour <= 9) return 'at drop-off';
    if (hour < 12) return 'in the morning';
    if (hour < 14) return 'around lunch';
    if (hour < 16) return 'after lunch';
    return 'at pick-up';
  },

  // Forecast section
  forecastHeading: 'Today, hour by hour',
  chartTitle: 'Hourly forecast — apparent temperature and rain chance',
  chartAlt: 'Chart of feels-like temperature and chance of rain per hour. The same data is in the table below.',
  legendTemperature: 'Line: feels-like temperature (°C, left axis)',
  legendRain: 'Bars: chance of rain (%, right axis)',
  legendWindow: (start, end) => `Shaded: kindergarten hours ${start}–${end}`,
  chartUnavailable: 'The chart could not be drawn on this device. The table below shows the same forecast.',
  tableSummary: 'View the hourly forecast as a table',
  tableCaption: 'Hourly forecast for kindergarten hours',
  tableColumns: ['Time', 'Feels like', 'Rain chance', 'Condition', 'Wind'],

  // Tips + footer
  tipsHeading: 'Before you go',
  tipsText: 'Forecasts can change. Consider your child’s comfort, activity, and kindergarten rules.',
  footer: 'Weather data: Open-Meteo / DWD (CC BY 4.0) · Forecasts are estimates',

  // Key dialog
  keyDialogTitle: 'Use an AI decision',
  keyDialogWarning:
    'This prototype sends the key directly from your browser to OpenRouter. Use a separate key with a small credit limit. The app keeps it only until this tab is closed or you choose Forget key.',
  keyLabel: 'OpenRouter API key',
  showKey: 'Show key',
  hideKey: 'Hide key',
  keyRequired: 'Enter a key, or choose Skip to keep using the weather rules.',
  skipAi: 'Skip AI — use weather rules',

  // Live announcements
  announceForecastUpdated: (time) => `Forecast updated at ${time}.`,
  announceRecommendation: (label, source) => `Recommendation: ${label}. ${source}.`
};

export const formatters = {
  temperature: (value) => (Number.isFinite(value) ? String(Math.round(value)) : '–'),

  // fetchedAt is a UTC ISO string; show it as Berlin wall-clock time.
  clockTime(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '–';
    return new Intl.DateTimeFormat(LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: TIMEZONE
    }).format(date);
  },

  // Provider timestamps are already Berlin local time ("2026-09-25T08:00").
  localHourLabel: (localTime) => localTime.slice(11, 16),
  hourLabel: (hour) => `${pad(hour)}:00`,

  dayHeading(dateString) {
    const date = new Date(`${dateString}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return '';
    // Assembled from parts: ICU versions disagree on en-GB punctuation.
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
        .formatToParts(date)
        .map((part) => [part.type, part.value])
    );
    return `${parts.weekday}, ${parts.day} ${parts.month}`;
  }
};
