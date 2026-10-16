import type { Tool } from './types';
import { clean } from './shared';
import { fmtClock, fmtDuration, parseClock } from './timecalc';

/* Sleep-cycle calculator (90-minute cycles, ~15 minutes to fall asleep) and age-based recommendations. */

const CYCLE = 90;
const FALL_ASLEEP = 15;

const NEEDS: Array<{ max: number; label: string; hours: string }> = [
  { max: 0.25, label: 'Neugeborene (0–3 Monate)', hours: '14–17 h' },
  { max: 1, label: 'Säuglinge (4–11 Monate)', hours: '12–15 h' },
  { max: 2, label: 'Kleinkinder (1–2 Jahre)', hours: '11–14 h' },
  { max: 5, label: 'Vorschulkinder (3–5 Jahre)', hours: '10–13 h' },
  { max: 13, label: 'Schulkinder (6–13 Jahre)', hours: '9–11 h' },
  { max: 17, label: 'Teenager (14–17 Jahre)', hours: '8–10 h' },
  { max: 64, label: 'Erwachsene (18–64 Jahre)', hours: '7–9 h' },
  { max: Infinity, label: 'Ältere Erwachsene (65+)', hours: '7–8 h' },
];

function bedtimes(wake: number): string[] {
  return [6, 5, 4, 3].map((cycles) => `- **${fmtClock(wake - cycles * CYCLE - FALL_ASLEEP)} Uhr** → ${cycles} Zyklen = ${fmtDuration(cycles * CYCLE)} Schlaf${cycles >= 5 ? ' ✅' : cycles === 4 ? ' (knapp)' : ' (zu wenig)'}`);
}

function waketimes(bed: number): string[] {
  const asleep = bed + FALL_ASLEEP;
  return [4, 5, 6].map((cycles) => `- **${fmtClock(asleep + cycles * CYCLE)} Uhr** → ${cycles} Zyklen = ${fmtDuration(cycles * CYCLE)} Schlaf${cycles >= 5 ? ' ✅' : ' (knapp)'}`);
}

export const sleepTool: Tool = {
  id: 'sleep',
  label: 'Schlaf',
  help: '- **Schlaf:** „Wann ins Bett, wenn ich um 6:30 aufstehen muss?“, „Wann aufstehen, wenn ich um 23 Uhr schlafen gehe?“, „Wie viel Schlaf braucht ein 10-Jähriger?“',
  run(input, context) {
    const s = clean(input).replace(/\s+/g, ' ');
    let m: RegExpMatchArray | null;
    if ((m = s.match(/^(?:wann\s+)?(?:sollte\s+ich\s+|soll\s+ich\s+|muss\s+ich\s+)?(?:ins\s+bett(?:\s+gehen)?|schlafen\s+gehen|einschlafen|zu\s+bett|bettzeit|schlafenszeit)\b.*?(?:um|ab)\s+(\d{1,2}(?:[:.]\d{2})?)(?:\s*uhr)?\s*(?:aufstehen|aufwachen|wach|raus|hoch|klingelt|wecker).*$/i))
      || (m = s.match(/^(?:wecker|aufstehen|aufwachen)\s+(?:um\s+)?(\d{1,2}(?:[:.]\d{2})?)(?:\s*uhr)?\s*[,:–-]?\s*(?:wann\s+)?(?:ins\s+bett|schlafen(?:\s+gehen)?|bettzeit|einschlafen)\??$/i))
      || (m = s.match(/^(?:schlafrechner|schlafzyklen|schlafzyklus)\s*:?\s*(?:aufstehen\s+|wecker\s+|aufwachen\s+)(?:um\s+)?(\d{1,2}(?:[:.]\d{2})?)(?:\s*uhr)?$/i))) {
      const wake = parseClock(m[1]);
      if (wake == null) return null;
      return {
        text: `**Aufstehen um ${fmtClock(wake)} Uhr – gute Zeiten zum Zubettgehen:**\n\n${bedtimes(wake).join('\n')}\n\n_Gerechnet mit 90-Minuten-Schlafzyklen plus ${FALL_ASLEEP} Minuten Einschlafzeit. Am Ende eines Zyklus fällt das Aufwachen leichter. Erwachsene brauchen meist 7–9 Stunden._`,
        source: 'sleep',
      };
    }
    if ((m = s.match(/^(?:wann\s+)?(?:sollte\s+ich\s+|soll\s+ich\s+|kann\s+ich\s+|muss\s+ich\s+)?(?:aufstehen|aufwachen|(?:den\s+)?wecker\s+stellen)\b.*?(?:um|ab)\s+(\d{1,2}(?:[:.]\d{2})?)(?:\s*uhr)?\s*(?:ins\s+bett|schlafen|einschlafe|zu\s+bett).*$/i))
      || (m = s.match(/^wann\s+(?:sollte|soll|muss|kann)\s+ich\s+(?:um\s+)?(\d{1,2}(?:[:.]\d{2})?)(?:\s*uhr)?\s+(?:ins\s+bett(?:\s+gehen)?|schlafen(?:\s+gehen)?|einschlafen|zu\s+bett)\??$/i))
      || (m = s.match(/^(?:ins\s+bett|schlafen(?:\s+gehen)?|einschlafen|bettzeit)\s+(?:um\s+)?(\d{1,2}(?:[:.]\d{2})?)(?:\s*uhr)?\s*[,:–-]?\s*(?:wann\s+)?(?:aufstehen|aufwachen|wecker)\??$/i))
      || (m = s.match(/^(?:schlafrechner|schlafzyklen|schlafzyklus)\s*:?\s*(?:ins\s+bett\s+|schlafen\s+|einschlafen\s+)(?:um\s+)?(\d{1,2}(?:[:.]\d{2})?)(?:\s*uhr)?$/i))) {
      const bed = parseClock(m[1]);
      if (bed == null) return null;
      return {
        text: `**Ins Bett um ${fmtClock(bed)} Uhr – gute Weckzeiten:**\n\n${waketimes(bed).join('\n')}\n\n_Gerechnet mit 90-Minuten-Schlafzyklen plus ${FALL_ASLEEP} Minuten Einschlafzeit. Wer jetzt sofort schläft, hat um ${fmtClock(bed + FALL_ASLEEP + 5 * CYCLE)} Uhr fünf Zyklen voll._`,
        source: 'sleep',
      };
    }
    if (/^(?:schlafrechner|schlafzyklen|schlafzyklus|wann\s+(?:sollte|soll)\s+ich\s+(?:ins\s+bett(?:\s+gehen)?|schlafen\s+gehen))\??$/i.test(s)) {
      const now = context.now();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      return {
        text: `**Schlafrechner** – sag mir eine Zeit:\n\n- „Wann ins Bett, wenn ich um 6:30 aufstehen muss?“\n- „Wann aufstehen, wenn ich um 23 Uhr schlafen gehe?“\n\nWenn du jetzt (${fmtClock(nowMin)} Uhr) schlafen gehst:\n\n${waketimes(nowMin).join('\n')}`,
        source: 'sleep',
      };
    }
    if ((m = s.match(/^(?:wie\s*viel\s+schlaf\s+(?:braucht|brauchen|benötigt)|schlafbedarf|empfohlene\s+schlafdauer|wie\s+lange\s+(?:sollte|soll|muss)\s+(?:ein|eine|man|ich)\b.*?schlafen)\b.*?(\d{1,3})\s*(?:-?\s*jährige[rs]?|-?\s*jaehrige[rs]?|jahre|monate|wochen)?.*$/i))) {
      const months = /monate|wochen/i.test(m[0]) && !/jahr|jährig|jaehrig/i.test(m[0]);
      const age = months ? Number(m[1]) / 12 : Number(m[1]);
      const need = NEEDS.find((row) => age <= row.max)!;
      return { text: `**${need.label}: empfohlen ${need.hours} Schlaf pro Nacht.**\n\n${NEEDS.map((row) => `| ${row.label} | ${row.hours} |`).reduce((acc, row) => `${acc}\n${row}`, '| Alter | Empfehlung |\n|---|---|')}\n\n_Richtwerte der National Sleep Foundation; individuell kann es abweichen._`, source: 'sleep' };
    }
    if (/^(?:wie\s*viel\s+schlaf\s+(?:braucht\s+man|brauche\s+ich|ist\s+gesund)|schlafbedarf|wie\s+lange\s+(?:sollte|soll)\s+(?:man|ich)\s+schlafen)\??$/i.test(s)) {
      return { text: `**Erwachsene: 7–9 Stunden pro Nacht.**\n\n${NEEDS.map((row) => `| ${row.label} | ${row.hours} |`).reduce((acc, row) => `${acc}\n${row}`, '| Alter | Empfehlung |\n|---|---|')}\n\n_Richtwerte der National Sleep Foundation. Frag „Wann ins Bett, wenn ich um 6:30 aufstehen muss?“ für passende Zeiten._`, source: 'sleep' };
    }
    return null;
  },
};
