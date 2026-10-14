import type { Tool, ToolResult } from './types';
import { DAY_MS, WEEKDAYS, clean, daysBetween, fmtDay, fmtN, fmtShortDay, parseDate, plural, todayUTC, utc } from './shared';

/* ---------------- Computus & movable days ---------------- */

/** Easter Sunday (Gregorian, Meeus/Jones/Butcher) as UTC midnight. */
export function easter(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

const weekday = (ts: number): number => new Date(ts).getUTCDay();

/** n-th (1-based) given weekday (0 = Sunday) of a month. */
function nthWeekday(year: number, month: number, day: number, n: number): number {
  const first = utc(year, month, 1);
  const offset = (day - weekday(first) + 7) % 7;
  return first + (offset + (n - 1) * 7) * DAY_MS;
}

function lastWeekday(year: number, month: number, day: number): number {
  const last = utc(year, month + 1, 0);
  return last - ((weekday(last) - day + 7) % 7) * DAY_MS;
}

export function fourthAdvent(year: number): number {
  const christmas = utc(year, 12, 25);
  return christmas - (weekday(christmas) || 7) * DAY_MS;
}

/** Buß- und Bettag: the Wednesday before 23 November. */
export function bussUndBettag(year: number): number {
  const nov23 = utc(year, 11, 23);
  return nov23 - (((weekday(nov23) - 3) + 7) % 7 || 7) * DAY_MS;
}

interface Feast { key: string; label: string; date: (year: number) => number; aliases: string[] }

const FEASTS: Feast[] = [
  { key: 'neujahr', label: 'Neujahr', date: (y) => utc(y, 1, 1), aliases: ['neujahr', 'neujahrstag', '1. januar', 'erster januar'] },
  { key: 'dreikoenige', label: 'Heilige Drei Könige', date: (y) => utc(y, 1, 6), aliases: ['heilige drei könige', 'heilige drei koenige', 'dreikönig', 'dreikoenig', 'dreikönigstag', 'dreikoenigstag', 'epiphanias', 'erscheinungsfest'] },
  { key: 'weiberfastnacht', label: 'Weiberfastnacht', date: (y) => easter(y) - 52 * DAY_MS, aliases: ['weiberfastnacht', 'altweiber', 'altweiberfastnacht', 'weiberfasching', 'schmotziger donnerstag'] },
  { key: 'rosenmontag', label: 'Rosenmontag', date: (y) => easter(y) - 48 * DAY_MS, aliases: ['rosenmontag', 'karneval', 'fasching', 'fastnacht', 'fasnacht', 'fasnet'] },
  { key: 'fastnachtsdienstag', label: 'Fastnachtsdienstag', date: (y) => easter(y) - 47 * DAY_MS, aliases: ['faschingsdienstag', 'fastnachtsdienstag', 'veilchendienstag', 'karnevalsdienstag'] },
  { key: 'aschermittwoch', label: 'Aschermittwoch', date: (y) => easter(y) - 46 * DAY_MS, aliases: ['aschermittwoch'] },
  { key: 'valentinstag', label: 'Valentinstag', date: (y) => utc(y, 2, 14), aliases: ['valentinstag', 'valentin'] },
  { key: 'frauentag', label: 'Internationaler Frauentag', date: (y) => utc(y, 3, 8), aliases: ['frauentag', 'internationaler frauentag', 'weltfrauentag'] },
  { key: 'sommerzeit', label: 'Beginn der Sommerzeit (Uhr eine Stunde vor)', date: (y) => lastWeekday(y, 3, 0), aliases: ['sommerzeit', 'beginn der sommerzeit', 'zeitumstellung im frühjahr', 'sommerzeitbeginn'] },
  { key: 'palmsonntag', label: 'Palmsonntag', date: (y) => easter(y) - 7 * DAY_MS, aliases: ['palmsonntag'] },
  { key: 'gruendonnerstag', label: 'Gründonnerstag', date: (y) => easter(y) - 3 * DAY_MS, aliases: ['gründonnerstag', 'gruendonnerstag'] },
  { key: 'karfreitag', label: 'Karfreitag', date: (y) => easter(y) - 2 * DAY_MS, aliases: ['karfreitag'] },
  { key: 'karsamstag', label: 'Karsamstag', date: (y) => easter(y) - DAY_MS, aliases: ['karsamstag', 'ostersamstag'] },
  { key: 'ostern', label: 'Ostersonntag', date: (y) => easter(y), aliases: ['ostern', 'ostersonntag', 'osterfest', 'osterdatum'] },
  { key: 'ostermontag', label: 'Ostermontag', date: (y) => easter(y) + DAY_MS, aliases: ['ostermontag'] },
  { key: 'maifeiertag', label: 'Tag der Arbeit', date: (y) => utc(y, 5, 1), aliases: ['tag der arbeit', 'maifeiertag', '1. mai', 'erster mai'] },
  { key: 'muttertag', label: 'Muttertag', date: (y) => nthWeekday(y, 5, 0, 2), aliases: ['muttertag'] },
  { key: 'himmelfahrt', label: 'Christi Himmelfahrt', date: (y) => easter(y) + 39 * DAY_MS, aliases: ['christi himmelfahrt', 'himmelfahrt', 'vatertag', 'herrentag', 'männertag', 'maennertag'] },
  { key: 'pfingsten', label: 'Pfingstsonntag', date: (y) => easter(y) + 49 * DAY_MS, aliases: ['pfingsten', 'pfingstsonntag', 'pfingstfest'] },
  { key: 'pfingstmontag', label: 'Pfingstmontag', date: (y) => easter(y) + 50 * DAY_MS, aliases: ['pfingstmontag'] },
  { key: 'fronleichnam', label: 'Fronleichnam', date: (y) => easter(y) + 60 * DAY_MS, aliases: ['fronleichnam'] },
  { key: 'friedensfest', label: 'Augsburger Friedensfest', date: (y) => utc(y, 8, 8), aliases: ['augsburger friedensfest', 'friedensfest'] },
  { key: 'mariae', label: 'Mariä Himmelfahrt', date: (y) => utc(y, 8, 15), aliases: ['mariä himmelfahrt', 'maria himmelfahrt', 'mariae himmelfahrt'] },
  { key: 'weltkindertag', label: 'Weltkindertag', date: (y) => utc(y, 9, 20), aliases: ['weltkindertag', 'kindertag'] },
  { key: 'erntedank', label: 'Erntedankfest', date: (y) => nthWeekday(y, 10, 0, 1), aliases: ['erntedank', 'erntedankfest'] },
  { key: 'einheit', label: 'Tag der Deutschen Einheit', date: (y) => utc(y, 10, 3), aliases: ['tag der deutschen einheit', 'deutsche einheit', 'einheitstag'] },
  { key: 'winterzeit', label: 'Ende der Sommerzeit (Uhr eine Stunde zurück)', date: (y) => lastWeekday(y, 10, 0), aliases: ['winterzeit', 'normalzeit', 'ende der sommerzeit', 'zeitumstellung im herbst', 'winterzeitbeginn'] },
  { key: 'halloween', label: 'Halloween', date: (y) => utc(y, 10, 31), aliases: ['halloween'] },
  { key: 'reformationstag', label: 'Reformationstag', date: (y) => utc(y, 10, 31), aliases: ['reformationstag', 'reformationsfest'] },
  { key: 'allerheiligen', label: 'Allerheiligen', date: (y) => utc(y, 11, 1), aliases: ['allerheiligen'] },
  { key: 'allerseelen', label: 'Allerseelen', date: (y) => utc(y, 11, 2), aliases: ['allerseelen'] },
  { key: 'martinstag', label: 'Martinstag', date: (y) => utc(y, 11, 11), aliases: ['martinstag', 'sankt martin', 'st. martin', 'st martin', 'martini'] },
  { key: 'volkstrauertag', label: 'Volkstrauertag', date: (y) => fourthAdvent(y) - 35 * DAY_MS, aliases: ['volkstrauertag'] },
  { key: 'busstag', label: 'Buß- und Bettag', date: (y) => bussUndBettag(y), aliases: ['buß- und bettag', 'buss- und bettag', 'buß und bettag', 'buss und bettag', 'bußtag', 'busstag', 'bettag', 'buß-und bettag'] },
  { key: 'totensonntag', label: 'Totensonntag', date: (y) => fourthAdvent(y) - 28 * DAY_MS, aliases: ['totensonntag', 'ewigkeitssonntag'] },
  { key: 'nikolaus', label: 'Nikolaus', date: (y) => utc(y, 12, 6), aliases: ['nikolaus', 'nikolaustag'] },
  { key: 'advent1', label: '1. Advent', date: (y) => fourthAdvent(y) - 21 * DAY_MS, aliases: ['1. advent', 'erster advent', '1 advent', 'advent', 'adventssonntage', 'adventszeit'] },
  { key: 'advent2', label: '2. Advent', date: (y) => fourthAdvent(y) - 14 * DAY_MS, aliases: ['2. advent', 'zweiter advent', '2 advent'] },
  { key: 'advent3', label: '3. Advent', date: (y) => fourthAdvent(y) - 7 * DAY_MS, aliases: ['3. advent', 'dritter advent', '3 advent'] },
  { key: 'advent4', label: '4. Advent', date: (y) => fourthAdvent(y), aliases: ['4. advent', 'vierter advent', '4 advent'] },
  { key: 'heiligabend', label: 'Heiligabend', date: (y) => utc(y, 12, 24), aliases: ['heiligabend', 'heiliger abend', 'weihnachten', 'weihnachtsfest', 'xmas'] },
  { key: 'weihnachten1', label: '1. Weihnachtstag', date: (y) => utc(y, 12, 25), aliases: ['1. weihnachtstag', 'erster weihnachtstag', 'erster weihnachtsfeiertag', '1. weihnachtsfeiertag'] },
  { key: 'weihnachten2', label: '2. Weihnachtstag', date: (y) => utc(y, 12, 26), aliases: ['2. weihnachtstag', 'zweiter weihnachtstag', 'zweiter weihnachtsfeiertag', '2. weihnachtsfeiertag', 'stephanstag'] },
  { key: 'silvester', label: 'Silvester', date: (y) => utc(y, 12, 31), aliases: ['silvester', 'sylvester', 'jahreswechsel'] },
];
const FEAST_BY_KEY = new Map(FEASTS.map((feast) => [feast.key, feast]));

const normalizeName = (raw: string): string => String(raw || '').toLowerCase().replace(/[?!.,]+$/, '').replace(/\s+/g, ' ')
  .replace(/^(?:der|die|das|den|dem|am|zum|zur|an)\s+/, '').replace(/^(?:nächste[rsn]?|naechste[rsn]?|kommende[rsn]?)\s+/, '').trim();

/** Resolves a feast name („Ostern“, „1. Advent“, „Himmelfahrt 2027“). */
export function parseFeast(raw: string): { key: string; label: string; year: number | null } | null {
  let s = normalizeName(raw);
  let year: number | null = null;
  const withYear = s.match(/^(.+?)\s+(?:im\s+jahr\s+|in\s+)?(\d{4})$/) || s.match(/^(\d{4})\s+(.+)$/);
  if (withYear) {
    const [, a, b] = withYear;
    if (/^\d{4}$/.test(a)) { year = +a; s = b; } else { year = +b; s = a; }
  }
  s = s.replace(/^(?:der|die|das|den|dem|nächste|naechste)\s+/, '').trim();
  if (/^(?:zeitumstellung|uhr umstellen|uhren umstellen|uhrumstellung)$/.test(s)) {
    // Generic „Zeitumstellung“: whichever change comes next (or, with a year, the spring change).
    const base = year ?? new Date(todayUTC()).getUTCFullYear();
    const summer = lastWeekday(base, 3, 0);
    const winter = lastWeekday(base, 10, 0);
    const today = todayUTC();
    const key = year != null || summer >= today || winter < today ? 'sommerzeit' : 'winterzeit';
    return { key, label: FEAST_BY_KEY.get(key)!.label, year };
  }
  const feast = FEASTS.find((entry) => entry.aliases.includes(s)) || FEASTS.find((entry) => entry.aliases.some((alias) => alias.length > 4 && (s === alias + 'sfest' || s === alias + 'fest')));
  return feast ? { key: feast.key, label: feast.label, year } : null;
}

export function feastDate(key: string, year: number): number | null {
  const feast = FEAST_BY_KEY.get(key);
  return feast ? feast.date(year) : null;
}

/* ---------------- Public holidays per Bundesland ---------------- */

export const STATES: Record<string, string> = {
  BW: 'Baden-Württemberg', BY: 'Bayern', BE: 'Berlin', BB: 'Brandenburg', HB: 'Bremen', HH: 'Hamburg', HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern', NI: 'Niedersachsen', NW: 'Nordrhein-Westfalen', RP: 'Rheinland-Pfalz', SL: 'Saarland',
  SN: 'Sachsen', ST: 'Sachsen-Anhalt', SH: 'Schleswig-Holstein', TH: 'Thüringen',
};
const STATE_ALIASES: Array<[RegExp, string]> = [
  [/baden[\s-]*w(ü|ue)rttemberg|\bbw\b|bawü|bawue/i, 'BW'], [/bayern|\bby\b|bavaria/i, 'BY'], [/berlin|\bbe\b/i, 'BE'],
  [/brandenburg|\bbb\b/i, 'BB'], [/bremen|\bhb\b/i, 'HB'], [/hamburg|\bhh\b/i, 'HH'], [/hessen|\bhe\b/i, 'HE'],
  [/mecklenburg|vorpommern|\bmv\b/i, 'MV'], [/niedersachsen|\bni\b|\bnds\b/i, 'NI'], [/nordrhein|westfalen|\bnrw\b|\bnw\b/i, 'NW'],
  [/rheinland|pfalz|\brp\b|\brlp\b/i, 'RP'], [/saarland|\bsl\b/i, 'SL'], [/sachsen[\s-]*anhalt|\bst\b|\blsa\b/i, 'ST'],
  [/sachsen|\bsn\b/i, 'SN'], [/schleswig|holstein|\bsh\b/i, 'SH'], [/th(ü|ue)ringen|\bth\b/i, 'TH'],
];

export function parseState(raw: string): string | null {
  const s = String(raw || '');
  for (const [re, code] of STATE_ALIASES) if (re.test(s)) return code;
  return null;
}

interface PublicHoliday { key: string; states: 'all' | string[]; partial?: Record<string, string> }
const ALL_STATES = Object.keys(STATES);

const PUBLIC: PublicHoliday[] = [
  { key: 'neujahr', states: 'all' },
  { key: 'dreikoenige', states: ['BW', 'BY', 'ST'] },
  { key: 'frauentag', states: ['BE', 'MV'] },
  { key: 'karfreitag', states: 'all' },
  { key: 'ostern', states: ['BB'] },
  { key: 'ostermontag', states: 'all' },
  { key: 'maifeiertag', states: 'all' },
  { key: 'himmelfahrt', states: 'all' },
  { key: 'pfingsten', states: ['BB'] },
  { key: 'pfingstmontag', states: 'all' },
  { key: 'fronleichnam', states: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL', 'SN', 'TH'], partial: { SN: 'nur in einigen Gemeinden', TH: 'nur in einigen Gemeinden' } },
  { key: 'friedensfest', states: ['BY'], partial: { BY: 'nur im Stadtgebiet Augsburg' } },
  { key: 'mariae', states: ['BY', 'SL'], partial: { BY: 'nur in Gemeinden mit überwiegend katholischer Bevölkerung' } },
  { key: 'weltkindertag', states: ['TH'] },
  { key: 'einheit', states: 'all' },
  { key: 'reformationstag', states: ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'] },
  { key: 'allerheiligen', states: ['BW', 'BY', 'NW', 'RP', 'SL'] },
  { key: 'busstag', states: ['SN'] },
  { key: 'weihnachten1', states: 'all' },
  { key: 'weihnachten2', states: 'all' },
];
export interface HolidayEntry { key: string; label: string; ts: number; states: string[]; nationwide: boolean; note?: string }

export function publicHolidays(year: number, state: string | null): HolidayEntry[] {
  const list: HolidayEntry[] = [];
  for (const entry of PUBLIC) {
    const states = entry.states === 'all' ? ALL_STATES : entry.states;
    if (state && !states.includes(state)) continue;
    const feast = FEAST_BY_KEY.get(entry.key);
    if (!feast) continue;
    list.push({
      key: entry.key, label: feast.label, ts: feast.date(year), states, nationwide: entry.states === 'all',
      note: state ? entry.partial?.[state] : entry.partial ? Object.entries(entry.partial).map(([code, text]) => `${STATES[code]}: ${text}`).join('; ') : undefined,
    });
  }
  return list.sort((a, b) => a.ts - b.ts);
}

const stateList = (codes: string[]): string => (codes.length === ALL_STATES.length ? 'bundesweit' : codes.map((code) => STATES[code]).join(', '));

/* ---------------- Replies ---------------- */

function relative(ts: number, today: number): string {
  const diff = daysBetween(today, ts);
  if (diff === 0) return 'das ist **heute**! 🎉';
  if (diff > 0) return `noch **${plural(diff, 'Tag', 'Tage')}**${diff >= 14 ? ` (etwa ${fmtN(Math.round(diff / 7 * 10) / 10)} Wochen)` : ''}`;
  return `vor ${plural(-diff, 'Tag', 'Tagen')}`;
}

function feastReply(found: { key: string; label: string; year: number | null }, today: number): ToolResult {
  const thisYear = new Date(today).getUTCFullYear();
  let year = found.year ?? thisYear;
  let ts = feastDate(found.key, year)!;
  if (found.year == null && ts < today) { year += 1; ts = feastDate(found.key, year)!; }
  const lines = [`**${found.label} ${year}: ${fmtDay(ts)}** – ${relative(ts, today)}.`];
  const related: Record<string, string[]> = {
    ostern: ['gruendonnerstag', 'karfreitag', 'ostermontag', 'himmelfahrt', 'pfingsten'],
    pfingsten: ['pfingstmontag', 'fronleichnam'],
    rosenmontag: ['weiberfastnacht', 'fastnachtsdienstag', 'aschermittwoch'],
    advent1: ['advent2', 'advent3', 'advent4'],
    sommerzeit: ['winterzeit'],
    winterzeit: ['sommerzeit'],
  };
  const extra = related[found.key];
  if (extra) {
    lines.push('', ...extra.map((key) => {
      const feast = FEAST_BY_KEY.get(key)!;
      let when = feast.date(year);
      if (key === 'sommerzeit' && when < ts) when = feast.date(year + 1);
      return `- ${feast.label}: ${fmtDay(when)}`;
    }));
  }
  if (found.key === 'ostern') lines.push('', '_Ostersonntag ist der erste Sonntag nach dem ersten Frühlingsvollmond (Gauß’sche Osterformel, gregorianischer Kalender)._');
  const holiday = PUBLIC.find((entry) => entry.key === found.key);
  if (holiday) lines.push('', `Gesetzlicher Feiertag: ${holiday.states === 'all' ? 'bundesweit' : stateList(holiday.states)}.`);
  return { text: lines.join('\n'), source: 'holiday', val: daysBetween(today, ts) };
}

function listReply(year: number, state: string | null, today: number): ToolResult {
  const list = publicHolidays(year, state);
  const rows = list.map((entry) => {
    const wd = WEEKDAYS[weekday(entry.ts)];
    const where = state ? (entry.note ? `_${entry.note}_` : entry.nationwide ? 'bundesweit' : 'regional') : stateList(entry.states) + (entry.note ? ` (_${entry.note}_)` : '');
    return `| ${fmtShortDay(entry.ts)} | ${wd.slice(0, 2)} | ${entry.label} | ${where} |`;
  });
  const weekend = list.filter((entry) => weekday(entry.ts) === 0 || weekday(entry.ts) === 6).length;
  const upcoming = list.find((entry) => entry.ts >= today);
  const title = state ? `Gesetzliche Feiertage ${year} in ${STATES[state]}` : `Gesetzliche Feiertage ${year} in Deutschland`;
  return {
    text: `**${title}** (${list.length})\n\n| Datum | Tag | Feiertag | ${state ? 'Hinweis' : 'Gilt in'} |\n|---|---|---|---|\n${rows.join('\n')}\n\n` +
      `${weekend ? `${weekend} davon fallen auf ein Wochenende. ` : 'Keiner davon fällt auf ein Wochenende. '}` +
      `${upcoming && new Date(today).getUTCFullYear() === year ? `Der nächste ist **${upcoming.label}** am ${fmtDay(upcoming.ts)} – ${relative(upcoming.ts, today)}.` : ''}` +
      (state ? '' : '\n\n_Für ein Bundesland: „Feiertage in Bayern 2026“._'),
    source: 'holiday',
    val: list.length,
  };
}

function checkReply(ts: number, state: string | null, today: number): ToolResult {
  const year = new Date(ts).getUTCFullYear();
  const hits = publicHolidays(year, state).filter((entry) => entry.ts === ts);
  const feasts = FEASTS.filter((feast) => feast.date(year) === ts && !hits.some((hit) => hit.key === feast.key));
  const dayLabel = fmtDay(ts);
  const isToday = ts === today;
  const sunday = weekday(ts) === 0;
  if (!hits.length) {
    const extra = feasts.length ? ` Es ist aber ${feasts.map((feast) => `**${feast.label}**`).join(' und ')}${feasts.some((f) => ['muttertag', 'advent1', 'advent2', 'advent3', 'advent4', 'totensonntag', 'volkstrauertag', 'erntedank'].includes(f.key)) ? ' (kein gesetzlicher Feiertag)' : ' – kein gesetzlicher Feiertag'}.` : '';
    return { text: `**${isToday ? 'Heute' : dayLabel} ist ${state ? `in ${STATES[state]} ` : ''}kein gesetzlicher Feiertag**${sunday ? ' (aber Sonntag)' : ''}.${extra}`, source: 'holiday' };
  }
  const lines = hits.map((hit) => `**${hit.label}** – ${state ? (hit.note ? hit.note : hit.nationwide ? 'bundesweit' : `gesetzlicher Feiertag in ${STATES[state]}`) : stateList(hit.states)}${!state && hit.note ? ` (${hit.note})` : ''}`);
  return { text: `${isToday ? 'Heute' : dayLabel} ist ein Feiertag: ${lines.join('; ')}.`, source: 'holiday' };
}

function nextReply(state: string | null, today: number): ToolResult {
  const year = new Date(today).getUTCFullYear();
  const all = [...publicHolidays(year, state), ...publicHolidays(year + 1, state)].filter((entry) => entry.ts >= today);
  const next = all[0];
  if (!next) return { text: 'Ich finde keinen kommenden Feiertag.', source: 'holiday' };
  const following = all.slice(1, 4).map((entry) => `- ${entry.label}: ${fmtDay(entry.ts)}`);
  return {
    text: `Der nächste gesetzliche Feiertag${state ? ` in ${STATES[state]}` : ''} ist **${next.label}** am **${fmtDay(next.ts)}** – ${relative(next.ts, today)}.` +
      `${!state && !next.nationwide ? ` (${stateList(next.states)})` : ''}${next.note ? ` _${next.note}_` : ''}\n\nDanach:\n${following.join('\n')}`,
    source: 'holiday',
    val: daysBetween(today, next.ts),
  };
}

export const holidayTool: Tool = {
  id: 'holiday',
  label: 'Feiertage & Ostern',
  help: '- **Feiertage:** „Wann ist Ostern 2027?“, „Feiertage in Bayern 2026“, „Ist der 3.10.2026 ein Feiertag?“, „Nächster Feiertag in NRW“',
  run(input, context) {
    const s = clean(input);
    const today = todayUTC(context.now());
    const thisYear = context.now().getFullYear();
    let m: RegExpMatchArray | null;

    if ((m = s.match(/^(?:wann\s+ist\s+(?:der\s+)?nächste[rs]?|wann\s+ist\s+(?:der\s+)?naechste[rs]?|nächste[rs]?|naechste[rs]?|wann\s+ist\s+wieder\s+(?:ein\s+)?)\s*(?:gesetzliche[rs]?\s+)?feiertag(?:\s+(?:in|im)\s+(.+))?$/i))) {
      return nextReply(m[1] ? parseState(m[1]) : null, today);
    }
    if ((m = s.match(/^(?:ist|war|wird)\s+(?:der\s+|am\s+)?(.+?)\s+(?:ein\s+|eine?n\s+)?(?:gesetzlicher\s+)?feiertag(?:\s+(?:in|im)\s+(.+))?$/i))
      || (m = s.match(/^feiertag\s+(?:am\s+)?(.+?)(?:\s+(?:in|im)\s+(.+))?\s*$/i))) {
      let ts = parseDate(m[1], context.now());
      if (ts == null) {
        const feast = parseFeast(m[1]);
        if (feast) {
          const year = feast.year ?? thisYear;
          ts = feastDate(feast.key, year);
          if (ts != null && feast.year == null && ts < today) ts = feastDate(feast.key, year + 1);
        }
      }
      if (ts == null) return m[0].toLowerCase().startsWith('feiertag') ? null : { text: `Das Datum „${m[1]}“ verstehe ich nicht – versuche z. B. „Ist der 3.10.2026 ein Feiertag?“ oder „Ist morgen ein Feiertag?“.`, source: 'holiday' };
      return checkReply(ts, m[2] ? parseState(m[2]) : null, today);
    }
    if ((m = s.match(/^(?:welche\s+|alle\s+|zeige?\s+(?:mir\s+)?(?:die\s+|alle\s+)?|liste\s+(?:der\s+)?)?(?:gesetzlichen?\s+)?feiertage(?:\s+gibt\s+es|\s+haben\s+wir|\s+sind)?(?:\s+(?:in|im|für|fuer)\s+(?!jahr\b)(.+?))?(?:\s+(?:im\s+jahr\s+|in\s+)?(\d{4}))?$/i))) {
      const stateText = m[1] ? m[1].replace(/\s+\d{4}$/, '') : '';
      const state = stateText ? parseState(stateText) : null;
      if (stateText && !state && !/deutschland|bundesweit|de\b/i.test(stateText)) return { text: `„${stateText}“ kenne ich nicht als Bundesland. Beispiele: „Feiertage in Bayern 2026“, „Feiertage NRW“, „Feiertage 2027“.`, source: 'holiday' };
      return listReply(m[2] ? +m[2] : thisYear, state, today);
    }
    if ((m = s.match(/^(?:gesetzliche\s+)?feiertage\s+(.+)$/i))) {
      const yearMatch = m[1].match(/(\d{4})/);
      const state = parseState(m[1].replace(/\d{4}/, ''));
      if (!state && !yearMatch) return null;
      return listReply(yearMatch ? +yearMatch[1] : thisYear, state, today);
    }
    let name: string | null = null;
    if ((m = s.match(/^(?:wann\s+(?:ist|war|wird|fällt|faellt|feiern\s+wir|haben\s+wir)|an\s+welchem\s+(?:tag|datum)\s+ist|welches\s+datum\s+hat|datum\s+(?:von|für|fuer)|wann\s+beginnt|wann\s+endet|wann\s+startet)\s+(.+?)(?:\s+(?:dieses|nächstes|naechstes)\s+jahr)?$/i))) name = m[1];
    else if (parseFeast(s)) name = s;
    if (name) {
      const found = parseFeast(name);
      if (found) return feastReply(found, today);
    }
    return null;
  },
};
