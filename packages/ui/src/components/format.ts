// Dates, times and numbers, written one way (design system v1 content.md, component 28, UX-18, R5.32).
const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

function toDate(v: string | number | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

export function formatDate(v: string | number | Date): string {
  const d = toDate(v);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTime(v: string | number | Date): string {
  const d = toDate(v);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(v: string | number | Date): string {
  return `${formatDate(v)} ${formatTime(v)}`;
}

export function formatFileStamp(v: string | number | Date): string {
  const d = toDate(v);
  return `${formatDate(d)}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/** Digits with a space for thousands and a dot for decimals: 12 345.5 */
export function formatNumber(n: number, decimals = 0): string {
  const fixed = Math.abs(n).toFixed(decimals);
  const [whole = '0', frac] = fixed.split('.');
  const spaced = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${n < 0 ? '-' : ''}${spaced}${frac ? `.${frac}` : ''}`;
}

export function formatCount(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
export function formatSize(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${formatNumber(value, unit === 0 || value >= 100 ? 0 : 1)} ${UNITS[unit] ?? 'B'}`;
}

export function formatPercent(n: number): string {
  return `${Math.round(n)}%`;
}

/** "5 min ago", never seconds. */
export function formatAgo(v: string | number | Date, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - toDate(v).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/** The exact time first, then how long ago. */
export function formatPast(v: string | number | Date, now: number = Date.now()): string {
  return `${formatDateTime(v)} (${formatAgo(v, now)})`;
}

/** "about 2 min left", never seconds. */
export function formatTimeLeft(ms: number): string {
  const minutes = Math.ceil(Math.max(0, ms) / 60000);
  if (minutes <= 1) return 'less than 1 min left';
  if (minutes < 60) return `about ${minutes} min left`;
  return `about ${Math.round(minutes / 60)} h left`;
}
