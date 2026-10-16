import type { Tool, ToolResult } from './types';
import { DAY_MS, MONTHS, clean, fmtDay, fmtShortDay, parseDate, plural, todayUTC, utc } from './shared';
import { STATES, feastDate, parseFeast, parseState, publicHolidays } from './holidays';

/* Working days (Mo–Fr minus public holidays) and „Werktage“ (Mo–Sa minus public holidays). */

const cache = new Map<string, Map<number, string>>();

/** Public holidays of a year as map ts → label (nationwide only when state is null). */
export function holidayMap(year: number, state: string | null): Map<number, string> {
  const key = `${year}:${state || ''}`;
  let map = cache.get(key);
  if (!map) {
    map = new Map();
    for (const entry of publicHolidays(year, state)) if (state || entry.nationwide) map.set(entry.ts, entry.label);
    cache.set(key, map);
  }
  return map;
}

const weekday = (ts: number): number => new Date(ts).getUTCDay();

export function workdayInfo(ts: number, state: string | null, saturdays = false): { work: boolean; reason: string | null } {
  const wd = weekday(ts);
  if (wd === 0) return { work: false, reason: 'Sonntag' };
  if (wd === 6 && !saturdays) return { work: false, reason: 'Samstag' };
  const holiday = holidayMap(new Date(ts).getUTCFullYear(), state).get(ts);
  if (holiday) return { work: false, reason: holiday };
  return { work: true, reason: null };
}

/** Inclusive count of working days between two dates. */
export function countWorkdays(from: number, to: number, state: string | null, saturdays = false): { count: number; holidays: Array<[number, string]> } {
  let count = 0;
  const holidays: Array<[number, string]> = [];
  if (to < from) [from, to] = [to, from];
  for (let ts = from; ts <= to; ts += DAY_MS) {
    const info = workdayInfo(ts, state, saturdays);
    if (info.work) count += 1;
    else if (info.reason && info.reason !== 'Samstag' && info.reason !== 'Sonntag') holidays.push([ts, info.reason]);
  }
  return { count, holidays };
}

/** The date reached after `n` working days (n may be negative). */
export function addWorkdays(from: number, n: number, state: string | null, saturdays = false): number {
  let ts = from;
  let left = Math.abs(n);
  const step = n < 0 ? -DAY_MS : DAY_MS;
  while (left > 0) {
    ts += step;
    if (workdayInfo(ts, state, saturdays).work) left -= 1;
  }
  return ts;
}

const regionNote = (state: string | null, fromSettings: boolean): string => state
  ? `Feiertage: ${STATES[state]}${fromSettings ? ' (aus den Einstellungen)' : ''}.`
  : 'Nur bundesweite Feiertage berücksichtigt – für regionale ein Bundesland angeben („… in Bayern“) oder in den Einstellungen wählen.';

function resolveTarget(raw: string, now: Date): { ts: number; label: string } | null {
  const s = raw.trim().toLowerCase();
  const today = todayUTC(now);
  const y = now.getFullYear();
  if (/^(?:monatsende|ende\s+des\s+monats|zum\s+monatsende)$/.test(s)) return { ts: utc(y, now.getMonth() + 2, 0), label: 'Monatsende' };
  if (/^(?:jahresende|ende\s+des\s+jahres|silvester|zum\s+jahresende)$/.test(s)) return { ts: utc(y, 12, 31), label: 'Jahresende' };
  const date = parseDate(s, now);
  if (date != null) return { ts: date, label: fmtDay(date) };
  const feast = parseFeast(s);
  if (feast) {
    let ts = feastDate(feast.key, feast.year ?? y)!;
    if (feast.year == null && ts < today) ts = feastDate(feast.key, y + 1)!;
    return { ts, label: `${feast.label} (${fmtDay(ts)})` };
  }
  return null;
}

function countReply(from: number, to: number, label: string, state: string | null, fromSettings: boolean, saturdays: boolean, includeStart: boolean): ToolResult {
  const start = includeStart ? from : from + DAY_MS;
  if (to < start) return { text: `${label} liegt nicht in der Zukunft – nenne mir einen Zeitraum, z. B. „Arbeitstage zwischen 1.3.2026 und 31.3.2026“.`, source: 'workdays' };
  const { count, holidays } = countWorkdays(start, to, state, saturdays);
  const other = countWorkdays(start, to, state, !saturdays).count;
  const unit = saturdays ? 'Werktage (Mo–Sa)' : 'Arbeitstage (Mo–Fr)';
  const preposition = includeStart ? (label.startsWith('Jahr ') ? 'im' : 'von') : 'bis';
  const lines = [`**${count} ${unit}** ${preposition} ${label}.`, ''];
  lines.push(`- Kalendertage: ${Math.round((to - start) / DAY_MS) + 1}`);
  lines.push(`- ${saturdays ? 'Ohne Samstage (Mo–Fr)' : 'Mit Samstagen (Werktage, Mo–Sa)'}: ${other}`);
  if (holidays.length) lines.push(`- Feiertage unter der Woche: ${holidays.map(([ts, name]) => `${name} (${fmtShortDay(ts)})`).join(', ')}`);
  lines.push('', `_${regionNote(state, fromSettings)}_`);
  return { text: lines.join('\n'), source: 'workdays', val: count };
}

export const workdayTool: Tool = {
  id: 'workdays',
  label: 'Arbeitstage',
  help: '- **Arbeitstage:** „Wie viele Arbeitstage bis Weihnachten?“, „Arbeitstage im März 2026 in NRW“, „Welcher Tag ist in 10 Arbeitstagen?“',
  run(input, context) {
    const s = clean(input);
    if (!/arbeitstag|werktag|bürotag|buerotag|geschäftstag|geschaeftstag/i.test(s)) return null;
    const now = context.now();
    const today = todayUTC(now);
    const saturdays = /werktag/i.test(s);
    let m: RegExpMatchArray | null;

    // Optional region („… in NRW“) anywhere at the end.
    let state: string | null = null;
    let fromSettings = false;
    let body = s;
    const lower = s.toLowerCase();
    const cut = Math.max(...[' in ', ' im ', ' für ', ' fuer '].map((word) => lower.lastIndexOf(word)));
    if (cut > 0) {
      const tail = s.slice(cut).trim().replace(/^(?:in|im|für|fuer)\s+/i, '');
      if (!/\d/.test(tail) && tail.split(/\s+/).length <= 3 && parseState(tail)) { state = parseState(tail); body = s.slice(0, cut).trim(); }
    }
    if (!state && context.config.region && STATES[context.config.region]) { state = context.config.region; fromSettings = true; }
    const DAYS = '(?:arbeitstage?n?|werktage?n?|bürotage?n?|buerotage?n?|geschäftstage?n?|geschaeftstage?n?)';

    if ((m = body.match(new RegExp(`^(?:ist|war)\\s+(?:der\\s+|am\\s+)?(.+?)\\s+(?:ein\\s+)?${DAYS}$`, 'i')))) {
      const target = resolveTarget(m[1], now);
      if (!target) return null;
      const info = workdayInfo(target.ts, state, saturdays);
      const text = info.work
        ? `**Ja**, ${target.label} ist ein ${saturdays ? 'Werktag' : 'Arbeitstag'} (${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][weekday(target.ts)]}).`
        : `**Nein**, ${target.label} ist kein ${saturdays ? 'Werktag' : 'Arbeitstag'}: ${info.reason}.`;
      return { text: `${text}\n\n_${regionNote(state, fromSettings)}_`, source: 'workdays' };
    }
    if ((m = body.match(new RegExp(`^(?:welcher\\s+tag\\s+ist\\s+|welches\\s+datum\\s+ist\\s+|was\\s+ist\\s+|datum\\s+)?in\\s+(\\d{1,3})\\s+${DAYS}(?:\\s+(?:ab|nach|von)\\s+(?:dem\\s+)?(.+))?$`, 'i')))
      || (m = body.match(new RegExp(`^(\\d{1,3})\\s+${DAYS}\\s+(?:ab|nach|von)\\s+(?:dem\\s+)?(.+)$`, 'i')))) {
      const n = Number(m[1]);
      const base = m[2] ? resolveTarget(m[2], now) : { ts: today, label: 'heute' };
      if (!base) return { text: `Das Startdatum „${m[2]}“ verstehe ich nicht.`, source: 'workdays' };
      if (n < 1 || n > 999) return { text: 'Bitte 1 bis 999 Tage.', source: 'workdays' };
      const ts = addWorkdays(base.ts, n, state, saturdays);
      const skipped = countWorkdays(base.ts + DAY_MS, ts, state, saturdays).holidays;
      return {
        text: `In **${plural(n, saturdays ? 'Werktag' : 'Arbeitstag', saturdays ? 'Werktagen' : 'Arbeitstagen')}** ab ${base.label} ist **${fmtDay(ts)}**${skipped.length ? ` – übersprungen: ${skipped.map(([d, name]) => `${name} (${fmtShortDay(d)})`).join(', ')}` : ''}.\n\n_${regionNote(state, fromSettings)}_`,
        source: 'workdays',
        val: Math.round((ts - today) / DAY_MS),
      };
    }
    if ((m = body.match(new RegExp(`^(?:wie\\s*viele\\s+)?${DAYS}(?:\\s+(?:sind\\s+es|gibt\\s+es|habe\\s+ich|haben\\s+wir|bleiben|noch))*\\s+(?:bis|bis\\s+zum|bis\\s+zur|bis\\s+zu)\\s+(.+)$`, 'i')))) {
      const target = resolveTarget(m[1], now);
      if (!target) return { text: `Das Datum „${m[1]}“ verstehe ich nicht – z. B. „Arbeitstage bis 24.12.2026“, „… bis Ostern“ oder „… bis Jahresende“.`, source: 'workdays' };
      return countReply(today, target.ts, target.label, state, fromSettings, saturdays, false);
    }
    if ((m = body.match(new RegExp(`^(?:wie\\s*viele\\s+)?${DAYS}(?:\\s+(?:gibt\\s+es|sind|liegen|haben\\s+wir))?\\s+(?:zwischen|von|vom)\\s+(?:dem\\s+)?(.+?)\\s+(?:und|bis|bis\\s+zum)\\s+(?:dem\\s+)?(.+)$`, 'i')))) {
      const from = resolveTarget(m[1], now);
      const to = resolveTarget(m[2], now);
      if (!from || !to) return { text: 'Beide Daten brauche ich als Datum, z. B. „Arbeitstage zwischen 1.3.2026 und 31.3.2026“.', source: 'workdays' };
      return countReply(Math.min(from.ts, to.ts), Math.max(from.ts, to.ts), `${fmtShortDay(Math.min(from.ts, to.ts))} bis ${fmtShortDay(Math.max(from.ts, to.ts))}`, state, fromSettings, saturdays, true);
    }
    if ((m = body.match(new RegExp(`^(?:wie\\s*viele\\s+)?${DAYS}(?:\\s+(?:gibt\\s+es|hat|sind|haben\\s+wir))?(?:\\s+(?:im|in|für|fuer))?(?:\\s+(?:jahr|der|das|dem))?\\s*(${MONTHS.map((name) => name.toLowerCase()).join('|')})?\\s*(\\d{4})?$`, 'i')))) {
      const year = m[2] ? Number(m[2]) : now.getFullYear();
      const month = m[1] ? MONTHS.findIndex((name) => name.toLowerCase() === m![1].toLowerCase()) + 1 : null;
      const from = month ? utc(year, month, 1) : utc(year, 1, 1);
      const to = month ? utc(year, month + 1, 0) : utc(year, 12, 31);
      const label = month ? `${MONTHS[month - 1]} ${year}` : `Jahr ${year}`;
      const result = countReply(from, to, label, state, fromSettings, saturdays, true);
      if (!month) {
        const perMonth = MONTHS.map((name, i) => `| ${name.slice(0, 3)} | ${countWorkdays(utc(year, i + 1, 1), utc(year, i + 2, 0), state, saturdays).count} |`);
        result.text = result.text.replace('\n\n_', `\n\n| Monat | ${saturdays ? 'Werktage' : 'Arbeitstage'} |\n|---|---|\n${perMonth.join('\n')}\n\n_`);
      }
      return result;
    }
    return null;
  },
};
