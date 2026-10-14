import type { Tool, ToolResult } from './types';
import { DAY_MS, MONTHS, clean, fmtDay, fmtN, parseDate, plural, todayUTC } from './shared';

/* Lunar phases after Jean Meeus, „Astronomical Algorithms“, chapter 49.
   True phase instants (not mean phases) – accurate to a few minutes. */

const RAD = Math.PI / 180;
const SYNODIC = 29.530588861;
const sin = (deg: number): number => Math.sin(deg * RAD);
const cos = (deg: number): number => Math.cos(deg * RAD);

export type PhaseKind = 0 | 0.25 | 0.5 | 0.75;
export const PHASE_NAME: Record<string, string> = { 0: 'Neumond', 0.25: 'Erstes Viertel', 0.5: 'Vollmond', 0.75: 'Letztes Viertel' };

/** Julian Ephemeris Day of the lunation `k` (integer = new moon, +0.5 = full moon …). */
export function phaseJde(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  let jde = 2451550.09766 + SYNODIC * k + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = 2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4;
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4;
  const O = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;
  const phase = k - Math.floor(k);
  const quarter = Math.abs(phase - 0.25) < 1e-6 || Math.abs(phase - 0.75) < 1e-6;
  if (!quarter) {
    const full = Math.abs(phase - 0.5) < 1e-6;
    jde += (full ? -0.40614 : -0.40720) * sin(Mp)
      + (full ? 0.17302 : 0.17241) * E * sin(M)
      + (full ? 0.01614 : 0.01608) * sin(2 * Mp)
      + (full ? 0.01043 : 0.01039) * sin(2 * F)
      + (full ? 0.00734 : 0.00739) * E * sin(Mp - M)
      - (full ? 0.00515 : 0.00514) * E * sin(Mp + M)
      + (full ? 0.00209 : 0.00208) * E * E * sin(2 * M)
      - 0.00111 * sin(Mp - 2 * F)
      - 0.00057 * sin(Mp + 2 * F)
      + 0.00056 * E * sin(2 * Mp + M)
      - 0.00042 * sin(3 * Mp)
      + 0.00042 * E * sin(M + 2 * F)
      + 0.00038 * E * sin(M - 2 * F)
      - 0.00024 * E * sin(2 * Mp - M)
      - 0.00017 * sin(O)
      - 0.00007 * sin(Mp + 2 * M)
      + 0.00004 * sin(2 * Mp - 2 * F)
      + 0.00004 * sin(3 * M)
      + 0.00003 * sin(Mp + M - 2 * F)
      + 0.00003 * sin(2 * Mp + 2 * F)
      - 0.00003 * sin(Mp + M + 2 * F)
      + 0.00003 * sin(Mp - M + 2 * F)
      - 0.00002 * sin(Mp - M - 2 * F)
      - 0.00002 * sin(3 * Mp + M)
      + 0.00002 * sin(4 * Mp);
  } else {
    jde += -0.62801 * sin(Mp)
      + 0.17172 * E * sin(M)
      - 0.01183 * E * sin(Mp + M)
      + 0.00862 * sin(2 * Mp)
      + 0.00804 * sin(2 * F)
      + 0.00454 * E * sin(Mp - M)
      + 0.00204 * E * E * sin(2 * M)
      - 0.00180 * sin(Mp - 2 * F)
      - 0.00070 * sin(Mp + 2 * F)
      - 0.00040 * sin(3 * Mp)
      - 0.00034 * E * sin(2 * Mp - M)
      + 0.00032 * E * sin(M + 2 * F)
      + 0.00032 * E * sin(M - 2 * F)
      - 0.00028 * E * E * sin(Mp + 2 * M)
      + 0.00027 * E * sin(2 * Mp + M)
      - 0.00017 * sin(O)
      - 0.00005 * sin(Mp - M - 2 * F)
      + 0.00004 * sin(2 * Mp + 2 * F)
      - 0.00004 * sin(Mp + M + 2 * F)
      + 0.00004 * sin(Mp - 2 * M)
      + 0.00003 * sin(Mp + M - 2 * F)
      + 0.00003 * sin(3 * M)
      + 0.00002 * sin(2 * Mp - 2 * F)
      + 0.00002 * sin(Mp - M + 2 * F)
      - 0.00002 * sin(3 * Mp + M);
    const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) - 0.00002 * cos(Mp - M) + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
    jde += Math.abs(phase - 0.25) < 1e-6 ? W : -W;
  }
  return jde;
}

export const jdeToMs = (jde: number): number => (jde - 2440587.5) * DAY_MS;
const msToJde = (ms: number): number => ms / DAY_MS + 2440587.5;

/** Timestamp (ms) of the phase `kind` with lunation index k. */
export const phaseTime = (k: number): number => jdeToMs(phaseJde(k));

function kEstimate(ms: number): number {
  const date = new Date(ms);
  const year = date.getUTCFullYear() + (date.getUTCMonth() + (date.getUTCDate() - 1) / 31) / 12;
  return (year - 2000) * 12.3685;
}

/** Next instant (> ms) of a given phase kind. */
export function nextPhase(kind: PhaseKind, ms: number): number {
  let k = Math.floor(kEstimate(ms)) - 2 + kind;
  for (let i = 0; i < 8; i += 1) {
    const t = phaseTime(k);
    if (t > ms) return t;
    k += 1;
  }
  return phaseTime(k);
}

/** Previous instant (≤ ms) of a given phase kind. */
export function previousPhase(kind: PhaseKind, ms: number): number {
  let k = Math.ceil(kEstimate(ms)) + 2 + kind;
  for (let i = 0; i < 8; i += 1) {
    const t = phaseTime(k);
    if (t <= ms) return t;
    k -= 1;
  }
  return phaseTime(k);
}

export interface MoonState { angle: number; illumination: number; age: number; name: string; emoji: string; lastNew: number; nextNew: number }

export function moonState(ms: number): MoonState {
  const lastNew = previousPhase(0, ms);
  const nextNew = nextPhase(0, ms);
  // Interpolate between the two true phase instants around `ms` (each quarter = 90°),
  // so the name and illumination agree with the listed phase times.
  const kinds: PhaseKind[] = [0, 0.25, 0.5, 0.75];
  const previous = kinds.map((kind) => ({ kind, t: previousPhase(kind, ms) })).sort((a, b) => b.t - a.t)[0];
  const followingKind = ((previous.kind + 0.25) % 1) as PhaseKind;
  const following = nextPhase(followingKind, ms);
  const angle = previous.kind * 360 + 90 * Math.min(1, Math.max(0, (ms - previous.t) / (following - previous.t)));
  const illumination = (1 - cos(angle)) / 2;
  const age = (ms - lastNew) / DAY_MS;
  const near = (target: number): boolean => Math.abs(angle - target) < 6 || (target === 0 && angle > 354);
  let name: string;
  let emoji: string;
  if (near(0)) { name = 'Neumond'; emoji = '🌑'; }
  else if (near(90)) { name = 'Erstes Viertel (zunehmender Halbmond)'; emoji = '🌓'; }
  else if (near(180)) { name = 'Vollmond'; emoji = '🌕'; }
  else if (near(270)) { name = 'Letztes Viertel (abnehmender Halbmond)'; emoji = '🌗'; }
  else if (angle < 90) { name = 'Zunehmende Sichel'; emoji = '🌒'; }
  else if (angle < 180) { name = 'Zunehmender Mond (Dreiviertelmond)'; emoji = '🌔'; }
  else if (angle < 270) { name = 'Abnehmender Mond (Dreiviertelmond)'; emoji = '🌖'; }
  else { name = 'Abnehmende Sichel'; emoji = '🌘'; }
  return { angle, illumination, age, name, emoji, lastNew, nextNew };
}

/** All instants of a phase kind within a calendar year (UTC). */
export function phasesInYear(kind: PhaseKind, year: number): number[] {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const list: number[] = [];
  let t = nextPhase(kind, start - 1);
  while (t < end) {
    list.push(t);
    t = nextPhase(kind, t + DAY_MS);
  }
  return list;
}

const fmtTime = (ms: number): string => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtLocalDay = (ms: number): string => {
  const d = new Date(ms);
  return fmtDay(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};
const localMidnight = (ms: number): number => {
  const d = new Date(ms);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};

function phaseLine(kind: PhaseKind, ms: number, today: number): string {
  const days = Math.round((localMidnight(ms) - today) / DAY_MS);
  const when = days === 0 ? 'heute' : days === 1 ? 'morgen' : days < 0 ? `vor ${plural(-days, 'Tag', 'Tagen')}` : `in ${plural(days, 'Tag', 'Tagen')}`;
  return `- ${PHASE_NAME[kind]}: ${fmtLocalDay(ms)}, ${fmtTime(ms)} Uhr (${when})`;
}

const NOTE = '_Astronomische Berechnung (Meeus) in deiner Zeitzone – auf wenige Minuten genau, komplett offline._';

function stateReply(ms: number, label: string, today: number): ToolResult {
  const state = moonState(ms);
  const kinds: PhaseKind[] = [0.25, 0.5, 0.75, 0];
  const upcoming = kinds.map((kind) => [kind, nextPhase(kind, ms)] as const).sort((a, b) => a[1] - b[1]);
  return {
    text: `${state.emoji} **${label}: ${state.name}** – zu etwa **${fmtN(Math.round(state.illumination * 100))} %** beleuchtet\n\n` +
      `Mondalter: ${fmtN(state.age, 1)} Tage seit Neumond (${fmtLocalDay(state.lastNew)}).\n\nNächste Phasen:\n${upcoming.map(([kind, t]) => phaseLine(kind, t, today)).join('\n')}\n\n${NOTE}`,
    source: 'moon',
    val: Math.round(state.illumination * 100),
  };
}

function listReply(kind: PhaseKind, year: number, month: number | null): ToolResult {
  let list = phasesInYear(kind, year);
  if (month != null) list = list.filter((ms) => new Date(ms).getMonth() === month - 1);
  const title = `${PHASE_NAME[kind]}${list.length === 1 ? '' : 'e'} ${month != null ? `im ${MONTHS[month - 1]} ` : ''}${year}`;
  if (!list.length) return { text: `Im ${MONTHS[month! - 1]} ${year} gibt es keinen ${PHASE_NAME[kind]} – das passiert im Februar gelegentlich.`, source: 'moon', val: 0 };
  return {
    text: `**${title}** (${list.length})\n\n${list.map((ms) => `- ${fmtLocalDay(ms)}, ${fmtTime(ms)} Uhr`).join('\n')}\n\n${NOTE}`,
    source: 'moon',
    val: list.length,
  };
}

const KIND_WORDS: Array<[RegExp, PhaseKind]> = [
  [/vollmond/i, 0.5], [/neumond/i, 0], [/erste[sn]?\s+viertel|zunehmende[rn]?\s+halbmond|halbmond/i, 0.25], [/letzte[sn]?\s+viertel|abnehmende[rn]?\s+halbmond/i, 0.75],
];
const MONTH_RE = new RegExp(`\\b(${MONTHS.map((m) => m.toLowerCase()).join('|')})\\b`, 'i');

export const moonTool: Tool = {
  id: 'moon',
  label: 'Mondphase',
  help: '- **Mond:** „Mondphase heute“, „Mondphase am 24.12.2026“, „Wann ist Vollmond?“, „Vollmonde 2026“',
  run(input, context) {
    const s = clean(input);
    const nowMs = context.now().getTime();
    const today = todayUTC(context.now());
    let m: RegExpMatchArray | null;

    if ((m = s.match(/^(?:welche\s+mondphase\s+(?:ist|haben\s+wir|herrscht)(?:\s+(?:am|an|zu))?|wie\s+ist\s+(?:der\s+mond|die\s+mondphase)(?:\s+am)?|(?:die\s+)?mondphase(?:\s+(?:am|an|für|fuer|vom|von))?|mond(?:\s+am)?|mondstand(?:\s+am)?)\s*(.*)$/i))) {
      const rest = m[1].trim();
      if (!rest || /^(?:heute|jetzt|gerade|aktuell|im\s+moment)$/i.test(rest)) return stateReply(nowMs, 'Mondphase heute', today);
      const ts = parseDate(rest, context.now());
      if (ts == null) return /^mond$/i.test(s) ? null : { text: `Das Datum „${rest}“ verstehe ich nicht – z. B. „Mondphase am 24.12.2026“ oder „Mondphase morgen“.`, source: 'moon' };
      const d = new Date(ts);
      const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12).getTime();
      return stateReply(local, `Mondphase am ${fmtDay(ts)}`, today);
    }
    const kindMatch = KIND_WORDS.find(([re]) => re.test(s));
    if (!kindMatch) return null;
    const kind = kindMatch[1];
    if ((m = s.match(/^(?:ist|haben\s+wir)\s+(heute|morgen|übermorgen|gestern)\s+(?:ein\s+)?(?:vollmond|neumond|halbmond)$/i))) {
      const ts = parseDate(m[1], context.now())!;
      const exact = nextPhase(kind, ts - 1);
      const sameDay = localMidnight(exact) === ts;
      const state = moonState(/^heute$/i.test(m[1]) ? nowMs : ts + 12 * 3_600_000);
      return {
        text: `${sameDay ? `${state.emoji} **Ja** – ${PHASE_NAME[kind]} ist ${m[1].toLowerCase()} um ${fmtTime(exact)} Uhr.` : `${state.emoji} **Nein** – ${m[1].toLowerCase()} ist ${state.name.toLowerCase()} (zu ${fmtN(Math.round(state.illumination * 100))} % beleuchtet).`}\n\n${phaseLine(kind, nextPhase(kind, ts - 1), today).replace(/^- /, 'Nächster ')}\n\n${NOTE}`,
        source: 'moon',
      };
    }
    const yearMatch = s.match(/\b(\d{4})\b/);
    const monthMatch = s.match(MONTH_RE);
    if (/^(?:alle\s+)?(?:vollmonde|neumonde|vollmondtermine|neumondtermine|vollmond[-\s]?daten|neumond[-\s]?daten)/i.test(s) || yearMatch || monthMatch) {
      const year = yearMatch ? +yearMatch[1] : context.now().getFullYear();
      const month = monthMatch ? MONTHS.findIndex((name) => name.toLowerCase() === monthMatch[1].toLowerCase()) + 1 : null;
      if (year < 1900 || year > 2200) return { text: 'Mondphasen berechne ich für die Jahre 1900 bis 2200.', source: 'moon' };
      return listReply(kind, year, month);
    }
    if (/^(?:wann\s+ist\s+(?:der\s+)?(?:nächste[rs]?\s+|naechste[rs]?\s+|wieder\s+)?|nächste[rs]?\s+|naechste[rs]?\s+|wann\s+haben\s+wir\s+(?:wieder\s+)?|wann\s+gibt\s+es\s+(?:wieder\s+)?(?:den\s+nächsten\s+)?)?(?:vollmond|neumond|erste[sn]?\s+viertel|letzte[sn]?\s+viertel|halbmond)$/i.test(s)) {
      const next = nextPhase(kind, nowMs);
      const after = nextPhase(kind, next + DAY_MS);
      const state = moonState(nowMs);
      return {
        text: `${phaseLine(kind, next, today).replace(/^- /, `Der nächste **${PHASE_NAME[kind]}** ist am `).replace(`${PHASE_NAME[kind]}: `, '')}.\n\nDanach: ${fmtLocalDay(after)}, ${fmtTime(after)} Uhr.\n\nHeute: ${state.emoji} ${state.name}, zu ${fmtN(Math.round(state.illumination * 100))} % beleuchtet.\n\n${NOTE}`,
        source: 'moon',
        val: Math.round((localMidnight(next) - today) / DAY_MS),
      };
    }
    return null;
  },
};
