import { copy, formatters } from '../copy.js';
import { feelsLike, getWeatherMeta } from '../domain/forecast.js';
import { escapeHtml } from './html.js';

// Canvas 2D chart plus an accessible table built from the same hours.

const PADDING = { top: 34, right: 40, bottom: 48, left: 38 };
const GLYPH_WIDTH_PX = 26;

export function computeTemperatureScale(values) {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { min: 0, max: 10, step: 5, ticks: [0, 5, 10] };
  const low = Math.min(...finite);
  const high = Math.max(...finite);
  const range = high - low;
  const step = range <= 8 ? 2 : range <= 20 ? 5 : 10;
  const min = Math.floor(low / step) * step;
  let max = Math.ceil(high / step) * step;
  if (max === min) max = min + step;
  const ticks = [];
  for (let tick = min; tick <= max; tick += step) ticks.push(tick);
  return { min, max, step, ticks };
}

function readColors(element) {
  const styles = globalThis.getComputedStyle?.(element);
  const token = (name, fallback) => styles?.getPropertyValue(name).trim() || fallback;
  return {
    ink: token('--ink', '#1E293B'),
    muted: token('--muted-ink', '#5B6473'),
    line: token('--line', '#E2E8F0'),
    temperature: token('--warm', '#F97316'),
    rain: token('--rain', '#4F7FE6'),
    sun: token('--sun', '#FBBF24'),
    now: token('--leaf-strong', '#1F6F5C'),
    nowBand: 'rgba(46, 139, 115, 0.16)',
    pastBand: 'rgba(100, 116, 139, 0.10)',
    card: token('--card', '#FFFFFF')
  };
}

function drawGlyph(ctx, icon, x, y, colors) {
  const cloud = (fill = '#94A3B8') => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x - 5, y + 1, 5, 0, Math.PI * 2);
    ctx.arc(x + 1, y - 3, 6, 0, Math.PI * 2);
    ctx.arc(x + 7, y + 1, 5, 0, Math.PI * 2);
    ctx.fill();
  };
  const sun = (dx = 0, dy = 0, radius = 6) => {
    ctx.fillStyle = colors.sun;
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  const strokes = (color, dash) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash?.(dash);
    ctx.beginPath();
    for (const offset of [-4, 1, 6]) {
      ctx.moveTo(x + offset, y + 8);
      ctx.lineTo(x + offset - 2, y + 13);
    }
    ctx.stroke();
    ctx.setLineDash?.([]);
  };

  switch (icon) {
    case 'sun': sun(); break;
    case 'sun-cloud':
    case 'cloud-sun': sun(-4, -3, 5); cloud('#CBD5E1'); break;
    case 'cloud': cloud(); break;
    case 'fog': cloud('#CBD5E1'); strokes(colors.muted, [2, 2]); break;
    case 'drizzle': cloud(); strokes(colors.rain, [2, 2]); break;
    case 'rain': cloud(); strokes(colors.rain, []); break;
    case 'snow': cloud(); strokes(colors.muted, [1, 3]); break;
    case 'storm': cloud('#64748B'); strokes(colors.sun, []); break;
    default:
      ctx.fillStyle = colors.muted;
      ctx.fillText('?', x, y + 4);
  }
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

// `currentIndex` is the position of the current hour in `hours` (-1: not today).
export function drawHourlyChart(canvas, hours, { currentIndex = -1 } = {}) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx || hours.length === 0) return false;

  const dpr = globalThis.devicePixelRatio || 1;
  const width = canvas.clientWidth || 600;
  const height = canvas.clientHeight || 260;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const colors = readColors(canvas);
  const plot = {
    left: PADDING.left,
    right: width - PADDING.right,
    top: PADDING.top,
    bottom: height - PADDING.bottom
  };
  const slot = (plot.right - plot.left) / hours.length;
  const xCenter = (index) => plot.left + slot * (index + 0.5);
  const temps = hours.map(feelsLike);
  const scale = computeTemperatureScale(temps);
  const yTemp = (value) => plot.bottom - ((value - scale.min) / (scale.max - scale.min)) * (plot.bottom - plot.top);
  const yRain = (percent) => plot.bottom - (percent / 100) * (plot.bottom - plot.top);

  ctx.font = '12px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';

  // Past hours in grey, the current hour as a full-height green column.
  if (currentIndex > 0) {
    ctx.fillStyle = colors.pastBand;
    ctx.fillRect(plot.left, 0, slot * currentIndex, plot.bottom);
  }
  if (currentIndex >= 0) {
    ctx.fillStyle = colors.nowBand;
    ctx.fillRect(plot.left + slot * currentIndex, 0, slot, plot.bottom);
  }

  // Grid + left axis (temperature).
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1;
  ctx.fillStyle = colors.muted;
  ctx.textAlign = 'right';
  for (const tick of scale.ticks) {
    const y = Math.round(yTemp(tick)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.stroke();
    ctx.fillText(`${tick}°`, plot.left - 6, y);
  }

  // Right axis (rain %).
  ctx.textAlign = 'left';
  for (const percent of [0, 50, 100]) ctx.fillText(`${percent}%`, plot.right + 6, yRain(percent));

  // Rain bars.
  ctx.fillStyle = colors.rain;
  ctx.globalAlpha = 0.35;
  const barWidth = Math.max(4, slot * 0.55);
  hours.forEach((hour, index) => {
    const percent = hour.precipitationProbabilityPercent ?? 0;
    if (percent <= 0) return;
    const top = yRain(percent);
    ctx.fillRect(xCenter(index) - barWidth / 2, top, barWidth, plot.bottom - top);
  });
  ctx.globalAlpha = 1;

  // Feels-like line.
  ctx.strokeStyle = colors.temperature;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let started = false;
  temps.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    const x = xCenter(index);
    const y = yTemp(value);
    if (started) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
    started = true;
  });
  ctx.stroke();
  ctx.fillStyle = colors.temperature;
  temps.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    ctx.beginPath();
    ctx.arc(xCenter(index), yTemp(value), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Current hour: a larger ringed dot on the line.
  const nowTemp = temps[currentIndex];
  if (Number.isFinite(nowTemp)) {
    ctx.fillStyle = colors.card;
    ctx.beginPath();
    ctx.arc(xCenter(currentIndex), yTemp(nowTemp), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.now;
    ctx.beginPath();
    ctx.arc(xCenter(currentIndex), yTemp(nowTemp), 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // X labels + weather glyphs, thinned out on narrow screens. The current
  // hour always gets both; skipped neighbours keep the labels from colliding.
  const labelEvery = slot < 34 ? 2 : 1;
  const glyphEvery = Math.ceil(GLYPH_WIDTH_PX / slot);
  const near = (index, every) => currentIndex >= 0 && index !== currentIndex && Math.abs(index - currentIndex) < every;
  ctx.textAlign = 'center';
  hours.forEach((hour, index) => {
    const isNow = index === currentIndex;
    if (isNow || (index % labelEvery === 0 && !near(index, labelEvery))) {
      ctx.fillStyle = isNow ? colors.ink : colors.muted;
      ctx.font = `${isNow ? '700 ' : ''}12px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.fillText(formatters.hourLabel(hour.hour).slice(0, 2), xCenter(index), plot.bottom + 14);
    }
    if (isNow || (index % glyphEvery === 0 && !near(index, glyphEvery))) {
      drawGlyph(ctx, getWeatherMeta(hour.weatherCode).icon, xCenter(index), 14, colors);
    }
  });

  // "Now" pill under the current hour's label.
  if (currentIndex >= 0) {
    ctx.font = '700 11px system-ui, -apple-system, "Segoe UI", sans-serif';
    const label = copy.nowMarker;
    const pillWidth = ctx.measureText(label).width + 14;
    const pillLeft = Math.min(Math.max(xCenter(currentIndex) - pillWidth / 2, 0), width - pillWidth);
    ctx.fillStyle = colors.now;
    roundedRect(ctx, pillLeft, plot.bottom + 24, pillWidth, 18, 9);
    ctx.fill();
    ctx.fillStyle = colors.card;
    ctx.fillText(label, pillLeft + pillWidth / 2, plot.bottom + 33);
  }

  return true;
}

export function renderHourlyTable(hours, { currentIndex = -1 } = {}) {
  const [time, feels, rain, condition, wind] = copy.tableColumns;
  const rows = hours
    .map((hour, index) => {
      const feelsValue = feelsLike(hour);
      const isNow = index === currentIndex;
      const rowAttrs = isNow ? ' class="is-now" aria-current="time"' : currentIndex > index ? ' class="is-past"' : '';
      return `<tr${rowAttrs}>
        <th scope="row">${escapeHtml(formatters.localHourLabel(hour.time))}${isNow ? ` <span class="now-tag">${escapeHtml(copy.nowMarker)}</span>` : ''}</th>
        <td>${Number.isFinite(feelsValue) ? `${Math.round(feelsValue)}°C` : '–'}</td>
        <td>${hour.precipitationProbabilityPercent ?? '–'}${hour.precipitationProbabilityPercent !== null ? '%' : ''}</td>
        <td>${escapeHtml(getWeatherMeta(hour.weatherCode).label)}</td>
        <td>${hour.windKmh !== null ? `${Math.round(hour.windKmh)} km/h` : '–'}</td>
      </tr>`;
    })
    .join('');

  return `
    <div class="table-scroll">
      <table class="hourly-table">
        <caption>${hours.length ? escapeHtml(copy.tableCaption(formatters.localHourLabel(hours[0].time), formatters.localHourLabel(hours.at(-1).time))) : ''}</caption>
        <thead><tr>
          <th scope="col">${time}</th><th scope="col">${feels}</th><th scope="col">${rain}</th>
          <th scope="col">${condition}</th><th scope="col">${wind}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
