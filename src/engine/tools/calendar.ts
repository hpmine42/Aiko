import type { Tool } from './types';
import { clean, DAY_MS, fmtShortDay, MONTHS, reorder, todayUTC, utc } from './shared';
import { STATES, parseState, publicHolidays } from './holidays';
import { holidayMap, countWorkdays } from './workdays';

/* Month calendar as a chat widget („Kalender März 2026“) plus a text summary of holidays, weeks and working days. */

export function isoWeek(ts: number): { week: number; year: number } {
  const d = new Date(ts);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const year = d.getUTCFullYear();
  const jan4 = Date.UTC(year, 0, 4);
  const jan4day = (new Date(jan4).getUTCDay() + 6) % 7;
  const week1Thu = jan4 + (3 - jan4day) * DAY_MS;
  return { week: 1 + Math.round((d.getTime() - week1Thu) / (7 * DAY_MS)), year };
}

export interface CalendarCell { ts: number; day: number; weekend: boolean; holiday: string | null; today: boolean }
export interface CalendarMonth { year: number; month: number; weeks: Array<{ kw: number; days: Array<CalendarCell | null> }> }

/** Builds the week rows (Monday first) of a month, with holidays of the given state marked. */
export function buildMonth(year: number, month: number, state: string | null, now: Date = new Date()): CalendarMonth {
  const first = utc(year, month, 1);
  const daysInMonth = new Date(utc(year, month + 1, 0)).getUTCDate();
  const today = todayUTC(now);
  const holidays = holidayMap(year, state);
  const weeks: CalendarMonth['weeks'] = [];
  let row: Array<CalendarCell | null> = Array((new Date(first).getUTCDay() + 6) % 7).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const ts = first + (day - 1) * DAY_MS;
    const wd = new Date(ts).getUTCDay();
    row.push({ ts, day, weekend: wd === 0 || wd === 6, holiday: holidays.get(ts) || null, today: ts === today });
    if (row.length === 7) { weeks.push({ kw: isoWeek(ts).week, days: row }); row = []; }
  }
  if (row.length) { while (row.length < 7) row.push(null); weeks.push({ kw: isoWeek(row.find(Boolean)!.ts).week, days: row }); }
  return { year, month, weeks };
}

const MONTH_RE = MONTHS.map((name) => name.toLowerCase()).join('|');

export const calendarTool: Tool = {
  id: 'calendar',
  label: 'Kalender',
  help: '- **Kalender:** „Kalender“, „Kalender März 2026“, „Kalender nächsten Monat“, „Zeig mir den Oktober“ – mit Feiertagen des gewählten Bundeslands',
  run(input, context) {
    const s = clean(input);
    const now = context.now();
    let m: RegExpMatchArray | null;
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    let state: string | null = null;
    let body = s;
    const regionMatch = s.match(/\s+(?:in|für|fuer)\s+([A-Za-zäöüÄÖÜß\-\s]{2,30})$/i);
    if (regionMatch && parseState(regionMatch[1])) { state = parseState(regionMatch[1]); body = s.slice(0, regionMatch.index); }
    if (!state && context.config.region && STATES[context.config.region]) state = context.config.region;

    if ((m = body.match(new RegExp(`^(?:zeig(?:e)?\\s+(?:mir\\s+)?(?:den\\s+|bitte\\s+)?)?(?:monats)?kalender(?:\\s+(?:für|fuer|von|vom|im))?\\s*(?:(diesen|aktuellen|nächsten|naechsten|kommenden|letzten|vorigen|vorherigen)\\s+monat|(${MONTH_RE})(?:\\s+(\\d{4}))?|(\\d{1,2})[./](\\d{4})|(\\d{4})-(\\d{1,2})|(\\d{4}))?$`, 'i')))
      || (m = reorder(body.match(new RegExp(`^zeig(?:e)?\\s+(?:mir\\s+)?(?:den\\s+)?(${MONTH_RE})(?:\\s+(\\d{4}))?$`, 'i')), 0, 3, 1, 2))) {
      if (m[1]) {
        const shift = /nächst|naechst|kommend/i.test(m[1]) ? 1 : /letzt|vorig|vorherig/i.test(m[1]) ? -1 : 0;
        const d = new Date(Date.UTC(year, month - 1 + shift, 1));
        year = d.getUTCFullYear(); month = d.getUTCMonth() + 1;
      } else if (m[2]) {
        month = MONTHS.findIndex((name) => name.toLowerCase() === m![2].toLowerCase()) + 1;
        if (m[3]) year = Number(m[3]);
        else if (month < now.getMonth() + 1 - 6) year += 1;      // „Kalender Januar“ in October → next year
      } else if (m[4]) { month = Number(m[4]); year = Number(m[5]); }
      else if (m[6]) { year = Number(m[6]); month = Number(m[7]); }
      else if (m[8]) {
        year = Number(m[8]);
        // Whole year → compact overview instead of a widget.
        const lines = MONTHS.map((name, i) => {
          const from = utc(year, i + 1, 1);
          const to = utc(year, i + 2, 0);
          const work = countWorkdays(from, to, state).count;
          const hols = publicHolidays(year, state).filter((h) => h.ts >= from && h.ts <= to && (state || h.nationwide)).map((h) => `${h.label} (${new Date(h.ts).getUTCDate()}.)`);
          return `| ${name} | ${new Date(to).getUTCDate()} | ${work} | ${hols.join(', ') || '–'} |`;
        });
        const first = new Date(utc(year, 1, 1));
        const leap = new Date(utc(year, 2, 29)).getUTCDate() === 29;
        return {
          text: `**Jahresübersicht ${year}**${state ? ` – Feiertage ${STATES[state]}` : ' – bundesweite Feiertage'}\n\n| Monat | Tage | Arbeitstage | Feiertage |\n|---|---:|---:|---|\n${lines.join('\n')}\n\n_${year} ${leap ? 'ist ein Schaltjahr (366 Tage)' : 'hat 365 Tage'}, beginnt an einem ${['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][first.getUTCDay()]} und hat ${isoWeek(utc(year, 12, 28)).week} Kalenderwochen. „Kalender März ${year}“ zeigt einen Monat._`,
          source: 'calendar',
        };
      }
      if (month < 1 || month > 12 || year < 1900 || year > 2200) return null;
      const cal = buildMonth(year, month, state, now);
      const from = utc(year, month, 1);
      const to = utc(year, month + 1, 0);
      const holidays = publicHolidays(year, state).filter((h) => h.ts >= from && h.ts <= to && (state || h.nationwide));
      const work = countWorkdays(from, to, state).count;
      const kws = cal.weeks.map((w) => w.kw);
      const lines = [
        `**${MONTHS[month - 1]} ${year}** – ${new Date(to).getUTCDate()} Tage, KW ${kws[0]}–${kws[kws.length - 1]}, ${work} Arbeitstage${state ? ` (${STATES[state]})` : ''}`,
        '',
        holidays.length ? `Feiertage: ${holidays.map((h) => `${h.label} (${fmtShortDay(h.ts).slice(0, 6)})`).join(', ')}` : 'Keine gesetzlichen Feiertage in diesem Monat.',
      ];
      if (!state) lines.push('', '_Für regionale Feiertage ein Bundesland in den Einstellungen wählen oder „Kalender Mai in Bayern“ fragen._');
      return { text: lines.join('\n'), source: 'calendar', widget: { type: 'calendar', year, month, state } };
    }
    return null;
  },
};
