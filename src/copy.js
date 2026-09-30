// All user-facing strings live here so a German translation can be added later.

export const LOCALE = 'en-GB';
export const TIMEZONE = 'Europe/Berlin';

const pad = (value) => String(value).padStart(2, '0');

export const copy = {
  brand: 'Wear Today',
  locationLabel: 'Berlin',
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  updatedAt: (time) => `Updated ${time}`,
  lastUpdatedAt: (time) => `Last updated at ${time}.`,
  retry: 'Try again',
  loadingForecast: 'Loading today’s forecast…',

  // Snapshot
  todayHeading: (dateLabel) => `Today in Berlin · ${dateLabel}`,
  feelsLine: (feelsLike, condition) => `Feels like ${feelsLike}° · ${condition}`,
  temperatureNow: (temperature) => `${temperature}°C now`,
  alertRain: (percent, when) => `${percent}% rain ${when}`,
  alertWarmest: (temp, time) => `Warmest ${temp}° at ${time}`,
  windowNote: (start, end, from, to) => `We track the whole day, ${start}–${end}, hour by hour. The outfit covers ${from}–${to}.`,
  staleNotice: 'Showing a saved forecast. It may be out of date.',
  weatherErrorTitle: 'Forecast unavailable',
  weatherError: 'Today’s forecast could not load. Check your connection and try again.',
  weatherTimeout: 'The forecast took too long to load. Check your connection and try again.',

  // Recommendation card
  putOnToday: 'Put on today',
  outfitPending: 'Your outfit recommendation appears once the forecast has loaded.',
  garmentListLabel: 'Garments to put on',
  rangeLabel: 'Hours the outfit is for',
  rangeFrom: 'For',
  rangeTo: 'until',
  rangeNow: 'Now',
  rangeNowLabel: (end) => `Reset to now until ${end}`,
  sections: {
    head: 'Head',
    middle: 'Body',
    low: 'Legs',
    bottom: 'Feet',
    carry: 'Carry'
  },
  sectionHints: {
    headCold: (temp) => `Down to ${temp}°`,
    sun: 'Sun protection',
    layers: (count) => (count === 1 ? 'One layer' : `${count} layers`),
    peelOff: 'Peel off later',
    long: 'Long today',
    short: 'Short today',
    rainReady: 'Rain-ready',
    snowReady: 'Snow-ready',
    closed: 'Dry & cozy',
    open: 'Airy & light',
    carry: 'Just in case'
  },
  reasonsLabel: 'Why this outfit',
  illustrationBody: 'Child figure',
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
  reasonDryUntil: (time) => `Dry until ${time}`,
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
  chartTitle: 'Hourly forecast — apparent temperature, rain chance and rain amount',
  chartAlt: 'Chart of feels-like temperature, chance of rain and rain amount in millimetres per hour. The same data is in the table below.',
  legendTemperature: 'Feels like °C',
  legendRain: 'Rain chance %',
  legendRainAmount: 'Rain mm',
  legendPast: 'Past hours',
  legendOutfitHours: 'Outfit hours',
  legendNow: (time) => `Now ${time}`,
  nowMarker: 'Now',
  chartUnavailable: 'The chart could not be drawn on this device. The table below shows the same forecast.',
  tableSummary: 'View the hourly forecast as a table',
  tableCaption: (start, end) => `Hourly forecast, ${start}–${end}`,
  tableColumns: ['Time', 'Feels like', 'Rain chance', 'Rain amount', 'Condition', 'Wind'],

  // Tips + footer
  tipsHeading: 'Before you go…',
  tipsText: 'Forecasts can change. Consider your own comfort, your plans for the day, and any dress rules where you’re going.',
  footer: 'Weather data: Open-Meteo / DWD (CC BY 4.0) · Forecasts are estimates',
  version: (version) => `Version ${version}`,

  // Live announcements
  announceForecastUpdated: (time) => `Forecast updated at ${time}.`
};

export const formatters = {
  temperature: (value) => (Number.isFinite(value) ? String(Math.round(value)) : '–'),
  rainMm: (value) => (Number.isFinite(value) ? (value === 0 ? '0 mm' : `${value.toFixed(1)} mm`) : '–'),
  // Chart labels: no unit, and whole millimetres from 10 mm up to stay narrow.
  rainMmShort: (value) => (Math.round(value * 10) < 100 ? value.toFixed(1) : String(Math.round(value))),

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
