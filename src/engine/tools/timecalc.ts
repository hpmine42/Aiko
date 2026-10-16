import type { Tool, ToolResult } from './types';
import { clean, fmtN, toNum } from './shared';

/* Clock arithmetic: time spans, working hours with breaks, decimal hours, „Uhrzeit in 90 Minuten“. */

const TIME = '(\\d{1,2})(?:[:.](\\d{2}))?(?:\\s*uhr)?';

/** Parses „8:15“, „8.15 Uhr“, „8 Uhr“ into minutes since midnight. */
export function parseClock(raw: string): number | null {
  const m = String(raw).trim().match(new RegExp(`^${TIME}$`, 'i'));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** Parses durations like „2 h 45 min“, „2:45 h“, „1,5 Stunden“, „90 min“, „1 Tag 3 Stunden“. Returns minutes. */
export function parseDuration(raw: string): number | null {
  let s = String(raw).toLowerCase().replace(/,/g, '.').trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?\s*(?:h|std\.?|stunden?)?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0);
  let total = 0;
  let found = false;
  const re = /(\d+(?:\.\d+)?)\s*(tage?n?|tg\.?|d|stunden?|std\.?|h|minuten?|min\.?|m|sekunden?|sek\.?|s)(?=\s|$|\d)/g;
  while ((m = re.exec(s))) {
    const v = Number(m[1]);
    const unit = m[2];
    if (/^(tag|tg|d)/.test(unit)) total += v * 1440;
    else if (/^(stunde|std|h)/.test(unit)) total += v * 60;
    else if (/^(min|m)/.test(unit)) total += v;
    else total += v / 60;
    found = true;
  }
  if (!found) return null;
  s = s.replace(re, '').replace(/\s+/g, '');
  return s ? null : total;
}

export function fmtDuration(minutes: number, withSeconds = false): string {
  const sign = minutes < 0 ? '−' : '';
  const abs = Math.abs(minutes);
  const days = Math.floor(abs / 1440);
  const h = Math.floor((abs % 1440) / 60);
  const min = Math.floor(abs % 60);
  const sec = Math.round((abs - Math.floor(abs)) * 60);
  const parts: string[] = [];
  if (days) parts.push(`${days} ${days === 1 ? 'Tag' : 'Tage'}`);
  if (h) parts.push(`${h} h`);
  if (min || (!days && !h && !withSeconds)) parts.push(`${min} min`);
  if (withSeconds && sec) parts.push(`${sec} s`);
  return sign + parts.join(' ');
}

export const fmtClock = (minutes: number): string => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const fmtHm = (minutes: number): string => `${Math.floor(Math.abs(minutes) / 60)}:${String(Math.round(Math.abs(minutes) % 60)).padStart(2, '0')}`;

function spanReply(label: string, minutes: number, extra: string[] = []): ToolResult {
  const lines = [`**${label} = ${fmtDuration(minutes)}**`, '', `- Als Stunden: ${fmtHm(minutes)} h · dezimal ${fmtN(minutes / 60, 2)} h`, `- In Minuten: ${fmtN(Math.round(minutes * 100) / 100)}`, ...extra];
  return { text: lines.join('\n'), source: 'time', val: Math.round(minutes / 60 * 100) / 100 };
}

export const timeTool: Tool = {
  id: 'time',
  label: 'Zeitrechnung',
  help: '- **Zeitrechnung:** „8:15 bis 17:30 mit 45 Minuten Pause“, „2 h 45 min + 1 h 30 min“, „7,75 Stunden in h:mm“, „Uhrzeit in 90 Minuten“',
  run(input, context) {
    const s = clean(input).replace(/\s+uhr\b/gi, '').replace(/\bund\b/gi, '+');
    let m: RegExpMatchArray | null;

    // „von 8:15 bis 17:30 (45 min Pause)“ or several ranges „8:00-12:00, 13:00-17:30“
    const rangeRe = new RegExp(`${TIME}\\s*(?:bis|-|–|—)\\s*${TIME}`, 'gi');
    const ranges = [...s.matchAll(rangeRe)];
    if (ranges.length) {
      const breakMatch = s.match(/(\d+(?:[.,]\d+)?)\s*(min(?:uten)?|h|std\.?|stunden?)?\s*(?:minuten\s+)?pause/i) || s.match(/pause\s*(?:von\s+)?(\d+(?:[.,]\d+)?)\s*(min(?:uten)?|h|std\.?|stunden?)?/i);
      const rest = s.replace(rangeRe, ' ').replace(/\(?[^()]*pause\)?/gi, ' ')
        .replace(/^(?:arbeitszeit|arbeitsdauer|dienst|schicht|dauer|zeitspanne|zeit|wie\s+lang(?:e)?(?:\s+(?:ist\s+es|dauert\s+es|sind\s+es|geht\s+es))?)\s*(?:von|:)?/i, ' ')
        .replace(/\b(?:von|bis|mit|minus|abzüglich|abzueglich)\b/gi, ' ').replace(/[\s,;+()\-–]/g, '');
      if (rest) return null;
      let total = 0;
      const parts: string[] = [];
      for (const r of ranges) {
        const from = Number(r[1]) * 60 + Number(r[2] || 0);
        let to = Number(r[3]) * 60 + Number(r[4] || 0);
        if (from > 1440 || to > 1440) return null;
        if (to < from) to += 1440;      // over midnight
        total += to - from;
        parts.push(`${fmtClock(from)}–${fmtClock(to)} = ${fmtDuration(to - from)}`);
      }
      let pause = 0;
      if (breakMatch) pause = /^(h|std|stunde)/i.test(breakMatch[2] || '') ? toNum(breakMatch[1]) * 60 : toNum(breakMatch[1]);
      const net = total - pause;
      const extra: string[] = [];
      if (parts.length > 1) extra.push('', ...parts.map((p) => `- ${p}`));
      if (pause) extra.push('', `Ohne Pause wären es ${fmtDuration(total)}; abgezogen: ${fmtDuration(pause)} Pause.`);
      if (!pause && total > 6 * 60 && ranges.length === 1 && /arbeit|dienst|schicht/i.test(s)) extra.push('', `_Hinweis: Nach dem Arbeitszeitgesetz sind bei mehr als 6 Stunden 30 min Pause vorgesehen, bei mehr als 9 Stunden 45 min – z. B. „${fmtClock(Number(ranges[0][1]) * 60 + Number(ranges[0][2] || 0))} bis ${fmtClock(Number(ranges[0][3]) * 60 + Number(ranges[0][4] || 0))} mit 30 Minuten Pause“._`);
      const first = `${fmtClock(Number(ranges[0][1]) * 60 + Number(ranges[0][2] || 0))} bis ${fmtClock(Number(ranges[0][3]) * 60 + Number(ranges[0][4] || 0))}`;
      return spanReply(`${ranges.length === 1 ? first : `${ranges.length} Zeiträume`}${pause ? ` abzüglich ${fmtDuration(pause)} Pause` : ''}`, net, extra);
    }

    // „Uhrzeit in 90 Minuten“, „wie spät ist es in 2 Stunden 30“, „wie spät war es vor 3 Stunden“
    if ((m = s.match(/^(?:uhrzeit|wie\s+spät\s+ist\s+es|wie\s+spaet\s+ist\s+es|wie\s+spät\s+war\s+es|wie\s+spaet\s+war\s+es|welche\s+uhrzeit\s+ist)\s+(in|vor)\s+(.+)$/i))) {
      const dur = parseDuration(m[2]);
      if (dur == null) return null;
      const now = context.now();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const target = m[1].toLowerCase() === 'in' ? nowMin + dur : nowMin - dur;
      const dayShift = Math.floor(target / 1440);
      const dayNote = dayShift === 1 ? ' (morgen)' : dayShift === -1 ? ' (gestern)' : dayShift > 1 ? ` (in ${dayShift} Tagen)` : dayShift < -1 ? ` (vor ${-dayShift} Tagen)` : '';
      return { text: `${m[1].toLowerCase() === 'in' ? 'In' : 'Vor'} ${fmtDuration(dur)} ${m[1].toLowerCase() === 'in' ? 'ist' : 'war'} es **${fmtClock(target)} Uhr**${dayNote} – jetzt ist es ${fmtClock(nowMin)} Uhr.`, source: 'time' };
    }
    // „14:30 + 2 Stunden 45 Minuten“, „9 Uhr minus 2,5 Stunden“
    if ((m = s.match(new RegExp(`^${TIME}\\s*(\\+|plus|-|−|minus)\\s*(.+)$`, 'i')))) {
      const start = Number(m[1]) * 60 + Number(m[2] || 0);
      const dur = parseDuration(m[4]);
      if (start > 1440 || dur == null) return null;
      const add = /^(\+|plus)$/i.test(m[3]);
      const target = add ? start + dur : start - dur;
      const dayShift = Math.floor(target / 1440);
      return { text: `**${fmtClock(start)} ${add ? '+' : '−'} ${fmtDuration(dur)} = ${fmtClock(target)} Uhr**${dayShift === 1 ? ' (am nächsten Tag)' : dayShift === -1 ? ' (am Vortag)' : dayShift ? ` (${dayShift > 0 ? '+' : ''}${dayShift} Tage)` : ''}`, source: 'time' };
    }
    // „7,75 Stunden in h:mm“ / „7:45 h in Dezimal“ / „Dezimalstunden 7,75“ / „Industriezeit 7,75“
    if ((m = s.match(/^(?:(?:dezimal|industrie)(?:stunden|zeit|minuten)?\s*:?\s*)?(\d{1,3}(?:[.,]\d+)?)\s*(?:h|std\.?|stunden?)?\s+(?:in|als|nach|zu)\s+(?:h:mm|hh:mm|stunden\s+und\s+minuten|uhrzeit|normalzeit|zeit|minuten)$/i))
      || (m = s.match(/^(?:dezimal|industrie)(?:stunden|zeit)\s*:?\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:h|std\.?|stunden?)?$/i))) {
      const hours = toNum(m[1]);
      const minutes = Math.round(hours * 60);
      return { text: `**${fmtN(hours)} Stunden = ${fmtHm(minutes)} h** (${Math.floor(minutes / 60)} Stunden ${minutes % 60} Minuten, ${fmtN(minutes)} Minuten insgesamt).\n\n_Dezimal- oder Industriestunden: 0,25 h = 15 min, 0,5 h = 30 min, 0,75 h = 45 min._`, source: 'time', val: minutes };
    }
    if ((m = s.match(/^(\d{1,3}):(\d{2})\s*(?:h|std\.?|stunden?)?\s+(?:in|als|nach|zu)\s+(?:dezimal(?:stunden|zeit)?|industrie(?:stunden|zeit|minuten)|kommazahl|dezimalzahl)$/i))) {
      const minutes = Number(m[1]) * 60 + Number(m[2]);
      return { text: `**${m[1]}:${m[2]} h = ${fmtN(minutes / 60, 2)} Dezimalstunden** (${fmtN(minutes)} Minuten; Industrieminuten: ${fmtN(Math.round(minutes / 60 * 100))}).`, source: 'time', val: Math.round(minutes / 60 * 100) / 100 };
    }
    // Sum/difference of durations: „2 h 45 min + 1 h 30 min“, „3:20 h + 2:50 h - 45 min“
    if (/^(?:dauer|zeiten?|summe|zeit(?:en)?\s+addieren|rechne)?\s*:?\s*\d/i.test(s) && /(?:h|std|stunden?|min(?:uten)?|:\d{2})/i.test(s) && /[+\-−]/.test(s)) {
      const body = s.replace(/^(?:dauer|zeiten?|summe|zeit(?:en)?\s+addieren|rechne)\s*:?\s*/i, '').replace(/−/g, '-');
      const terms = body.split(/\s*([+-])\s*/);
      let total = 0;
      let sign = 1;
      const shown: string[] = [];
      for (const term of terms) {
        if (term === '+') { sign = 1; continue; }
        if (term === '-') { sign = -1; continue; }
        const dur = parseDuration(term);
        if (dur == null) return null;
        total += sign * dur;
        shown.push(`${sign < 0 ? '− ' : shown.length ? '+ ' : ''}${fmtDuration(dur)}`);
      }
      if (shown.length < 2) return null;
      return spanReply(shown.join(' '), total);
    }
    // „90 Minuten in Stunden und Minuten“ / „135 min in h:mm“
    if ((m = s.match(/^(\d+(?:[.,]\d+)?)\s*(min(?:uten)?|sek(?:unden)?|s)\s+(?:in|als)\s+(?:h:mm|stunden(?:\s+\+?\s*(?:und\s+)?minuten)?|zeit|uhrzeitformat)$/i))) {
      const minutes = /^s/i.test(m[2]) ? toNum(m[1]) / 60 : toNum(m[1]);
      return spanReply(`${fmtN(toNum(m[1]))} ${/^s/i.test(m[2]) ? 'Sekunden' : 'Minuten'}`, minutes);
    }
    return null;
  },
};
