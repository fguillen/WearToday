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
  windowNote: (start, end, from) => `We track the whole day, ${start}–${end}, hour by hour. The outfit covers ${from}–${end}.`,
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
  rulesDetail: 'Chosen by local weather rules.',
  detailWindow: (start, end, count) => `Checked ${start}–${end} (${count} hours).`,
  detailFeels: (min, max) => `Feels like ${min}°C to ${max}°C.`,
  detailRain: (percent, mm) => `Rain chance up to ${percent}% · ${mm} mm expected.`,
  detailWind: (kmh) => `Wind up to ${kmh} km/h.`,
  detailSun: (percent) => `Mostly clear skies ${percent}% of the hours.`,

  // Reasons (short chips)
  reasonFeelsLike: (temp, when) => `Feels like ${temp}°C ${when}`,
  reasonWarmsTo: (temp) => `Warming to ${temp}°C later`,
  reasonRainLikely: (when, percent) => `Rain likely ${when} (up to ${percent}%)`,
  reasonRainAmount: (mm) => `Showers possible (${mm} mm)`,
  reasonDry: 'Dry for the rest of the day',
  reasonSunny: 'Mostly sunny',
  reasonBreezy: (kmh) => `Breezy — up to ${kmh} km/h`,
  reasonWindy: (kmh) => `Windy — up to ${kmh} km/h`,
  timeOfDay: (hour) => {
    if (hour < 9) return 'early in the morning';
    if (hour < 12) return 'in the morning';
    if (hour < 14) return 'around lunch';
    if (hour < 18) return 'in the afternoon';
    return 'in the evening';
  },

  // Forecast section
  forecastHeading: 'Today, hour by hour',
  chartTitle: 'Hourly forecast — apparent temperature and rain chance',
  chartAlt: 'Chart of feels-like temperature and chance of rain per hour. The same data is in the table below.',
  legendTemperature: 'Line: feels-like temperature (°C, left axis)',
  legendRain: 'Bars: chance of rain (%, right axis)',
  legendPast: 'Grey: hours already passed',
  legendNow: (time) => `Green column: now (${time})`,
  nowMarker: 'Now',
  chartUnavailable: 'The chart could not be drawn on this device. The table below shows the same forecast.',
  tableSummary: 'View the hourly forecast as a table',
  tableCaption: (start, end) => `Hourly forecast, ${start}–${end}`,
  tableColumns: ['Time', 'Feels like', 'Rain chance', 'Condition', 'Wind'],

  // Tips + footer
  tipsHeading: 'Before you go',
  tipsText: 'Forecasts can change. Consider your child’s comfort, activity, and kindergarten rules.',
  footer: 'Weather data: Open-Meteo / DWD (CC BY 4.0) · Forecasts are estimates',

  // Live announcements
  announceForecastUpdated: (time) => `Forecast updated at ${time}.`
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
