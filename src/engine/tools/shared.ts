/* Shared helpers for the typed offline tools. They intentionally mirror the
   number handling of the legacy engine (German decimal comma, de-DE output). */

export const NUM = '([+-]?\\d+(?:[.,]\\d+)?)';
export const DAY_MS = 86_400_000;

/** Parses „1.234,56“, „1234.5“, „3,5“ and „1.000“ (grouped integer). */
export function toNum(raw: string): number {
  const s = String(raw).trim();
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
}

/** de-DE number formatting; `digits` limits the fraction digits (default 6). */
export function fmtN(value: number, digits?: number): string {
  if (!Number.isFinite(value)) return '–';
  const v = Object.is(value, -0) ? 0 : value;
  const abs = Math.abs(v);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e15)) {
    return v.toExponential(6).replace('.', ',').replace(/0+e/, 'e').replace(/,e/, 'e');
  }
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits == null ? 6 : digits }).format(v);
}

export function fmtEuro(value: number): string {
  return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} €`;
}

export const cap1 = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function plural(n: number, one: string, many: string): string {
  return `${fmtN(n)} ${Math.abs(n) === 1 ? one : many}`;
}

/** Normalises whitespace and strips a trailing „?“/„!“/„.“. */
export function clean(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim().replace(/[?!.\s]+$/, '').trim();
}

export function fence(body: string, lang = 'text'): string {
  return `\`\`\`${lang}\n${body.replace(/```/g, 'ˋˋˋ')}\n\`\`\``;
}

/**
 * Parses a list of numbers such as „3, 7, 12, 5“, „3,5 7,2 1“, „1;2;3“ or
 * „1,2,3“. Returns null when any token is not a number.
 */
export function parseNumberList(raw: string): number[] | null {
  const text = String(raw || '').replace(/\s+(?:und|and)\s+/gi, ' ').trim();
  if (!text) return null;
  const tokens = text.includes(';') || text.includes('\n')
    ? text.split(/\s*[;\n]\s*/)
    : text.split(/,\s+|\s+/);
  const values: number[] = [];
  for (const token of tokens) {
    const t = token.trim().replace(/[,;]+$/, '');
    if (!t) continue;
    if ((t.match(/,/g) || []).length > 1) {
      // „1,2,3“ without spaces – commas separate integers here.
      for (const part of t.split(',')) {
        if (!/^[+-]?\d+(?:\.\d+)?$/.test(part)) return null;
        values.push(Number(part));
      }
      continue;
    }
    if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(t)) return null;
    const value = toNum(t.replace(/^([+-]?)[.,]/, '$10,'));
    if (!Number.isFinite(value)) return null;
    values.push(value);
  }
  return values.length ? values : null;
}

/* ---------------- Dates (UTC midnight timestamps, like the legacy engine) ---------------- */

export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTH_SHORT: Record<string, number> = { jan: 1, feb: 2, mär: 3, mrz: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, okt: 10, nov: 11, dez: 12 };

export function todayUTC(now: Date = new Date()): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

export function utc(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day);
}

export function fmtDay(ts: number): string {
  const d = new Date(ts);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtShortDay(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}

export function daysBetween(from: number, to: number): number {
  return Math.round((to - from) / DAY_MS);
}

/** „heute“, „morgen“, „24.12.2026“, „24.12.“, „2026-12-24“, „24. Dezember 2026“ → UTC midnight. */
export function parseDate(raw: string, now: Date = new Date()): number | null {
  const s = String(raw || '').toLowerCase().trim().replace(/[?.!]+$/, '').replace(/^(?:dem|den|der|am|zum|zur|bis)\s+/, '').trim();
  const rel: Record<string, number> = { heute: 0, morgen: 1, übermorgen: 2, gestern: -1, vorgestern: -2 };
  if (s in rel) return todayUTC(now) + rel[s] * DAY_MS;
  let m: RegExpMatchArray | null;
  // Weekday names („Montag“, „nächsten Freitag“) resolve to the next such day after today.
  const dayName = s.replace(/^(?:nächsten|naechsten|kommenden|diesen|nächste|naechste|kommende)\s+/, '');
  const weekday = WEEKDAYS.findIndex((name) => name.toLowerCase() === dayName);
  if (weekday >= 0) {
    const today = todayUTC(now);
    const diff = (weekday - new Date(today).getUTCDay() + 7) % 7 || 7;
    return today + diff * DAY_MS;
  }
  if ((m = s.match(/^in\s+(\d{1,3})\s+(tag(?:en)?|woche(?:n)?|monat(?:en)?)$/))) {
    const n = Number(m[1]);
    if (m[2].startsWith('tag')) return todayUTC(now) + n * DAY_MS;
    if (m[2].startsWith('woche')) return todayUTC(now) + n * 7 * DAY_MS;
    return Date.UTC(now.getFullYear(), now.getMonth() + n, now.getDate());
  }
  if (/^(?:nächste|naechste|kommende)\s+woche$/.test(s)) return todayUTC(now) + 7 * DAY_MS;
  if (/^(?:nächsten|naechsten|kommenden)\s+monat$/.test(s)) return Date.UTC(now.getFullYear(), now.getMonth() + 1, now.getDate());
  let y: number | null = null;
  let mo = 0;
  let d = 0;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.?\s*(\d{2}|\d{4})?$/))) { d = +m[1]; mo = +m[2]; if (m[3]) y = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})\.?\s*([a-zä]+)\.?\s*(\d{4})?$/))) {
    d = +m[1];
    const name = m[2];
    mo = MONTHS.findIndex((month) => month.toLowerCase() === name) + 1 || MONTH_SHORT[name] || 0;
    if (m[3]) y = +m[3];
  } else return null;
  if (y != null && y < 100) y += y < 70 ? 2000 : 1900;
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  const year = y ?? now.getFullYear();
  const ts = utc(year, mo, d);
  if (new Date(ts).getUTCDate() !== d) return null;
  return ts;
}

/** Draws an unbiased random integer in [0, max). */
export function randomInt(max: number): number {
  if (max <= 0) return 0;
  const cryptoApi = typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function' ? globalThis.crypto : null;
  if (!cryptoApi) return Math.floor(Math.random() * max);
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  for (;;) {
    cryptoApi.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % max;
  }
}

export const pick = <T,>(list: readonly T[]): T => list[randomInt(list.length)];

/** Re-orders capture groups so alternative phrasings share one handler: reorder(m, 0, 2, 1). */
export function reorder(match: RegExpMatchArray | null, ...order: number[]): RegExpMatchArray | null {
  if (!match) return null;
  return order.map((index) => match[index]) as unknown as RegExpMatchArray;
}
