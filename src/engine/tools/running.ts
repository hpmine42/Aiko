import type { Tool } from './types';
import { NUM, clean, fmtN, toNum } from './shared';

/* Wettkampf-Prognose (Riegel-Formel), gleichmäßige Splits und Herzfrequenz-Zonen (Karvonen).
   Ergänzt das Pace-Werkzeug („Pace 10 km in 52:30“), das Zeiten ↔ Tempo rechnet. */

const RACES: Array<[number, string]> = [
  [5, '5 km'],
  [10, '10 km'],
  [21.0975, 'Halbmarathon'],
  [42.195, 'Marathon'],
];

function parseDistance(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (/^(?:voll)?marathon$/.test(s)) return 42.195;
  if (/^halb(?:marathon)?$/.test(s)) return 21.0975;
  const m = s.match(/^(\d+(?:[.,]\d+)?)(km|k)$/);
  return m ? toNum(m[1]) : null;
}

function distName(d: number): string {
  if (Math.abs(d - 42.195) < 0.01) return 'Marathon';
  if (Math.abs(d - 21.0975) < 0.01) return 'Halbmarathon';
  return `${fmtN(d, d % 1 ? 2 : 0).replace(/,?0+$/, '')} km`;
}

/** „52:30“ (m:ss), „1:45:00“ (h:mm:ss), „12,5 min“, „45 minuten“. */
function parseRaceSeconds(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '');
  let m = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  m = s.match(/^(\d{1,3}):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(new RegExp(`^${NUM}\\s*(?:min(?:uten)?|m)$`));
  if (m) return toNum(m[1]) * 60;
  return null;
}

/** Sekunden → „52:30“ / „1:45:00“. */
function fmtRace(seconds: number): string {
  const t = Math.round(seconds);
  const h = Math.floor(t / 3600);
  const min = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return h ? `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${min}:${String(sec).padStart(2, '0')}`;
}

/** Sekunden/km → „5:15 min/km“. */
function fmtPace(secondsPerKm: number): string {
  const total = Math.round(secondsPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} min/km`;
}

/** Riegel: T₂ = T₁ · (D₂ / D₁)^1,06 – die Ermüdung wächst mit der Strecke. */
const riegel = (t1: number, d1: number, d2: number): number => t1 * (d2 / d1) ** 1.06;

const ZONES: Array<[number, number, string]> = [
  [50, 60, 'Regeneration / locker'],
  [60, 70, 'Grundlagenausdauer'],
  [70, 80, 'Tempodauerlauf'],
  [80, 90, 'anaerobe Schwelle (10-km-Rennen)'],
  [90, 100, 'Intervalle / VO₂max'],
];

const TIME_GROUP = '([0-9]{1,3}:[0-9]{2}(?::[0-9]{2})?|[0-9]+(?:[.,][0-9]+)?\\s*min)';

export const runningTool: Tool = {
  id: 'running',
  label: 'Lauf-Prognose, Splits & Pulszonen',
  help: '- **Lauf & Puls:** „Prognose 10 km in 52:30“, „Splits 10 km in 50:00“, „Pulszonen bei Ruhepuls 60 und Maximalpuls 185“, „Trainingspuls 35 Jahre“',
  run(input) {
    const s = clean(input).replace(/\s+/g, ' ');
    let m: RegExpMatchArray | null;

    // „Prognose 10 km in 52:30 [für Halbmarathon]“ – Riegel-Formel
    if ((m = s.match(new RegExp(`^(?:wettkampf\\s+)?(?:prognose|riegel|vorhersage)\\s+(?:für\\s+|von\\s+|aus\\s+)?(.+?)\\s+in\\s+${TIME_GROUP}(?:\\s+(?:für|auf)\\s+(.+?))?\\s*$`, 'i')))) {
      const d1 = parseDistance(m[1]);
      const t1 = parseRaceSeconds(m[2]);
      const d2 = m[3] ? parseDistance(m[3]) : null;
      if (d1 == null || t1 == null || d1 <= 0 || t1 <= 0 || (m[3] && d2 == null)) {
        return { text: 'Für die Prognose brauche ich Strecke und Zeit, z. B. **„Prognose 10 km in 52:30“** oder **„Prognose 5 km in 25:12 für Halbmarathon“** (Strecken: 5 km, 10 km, Halbmarathon, Marathon oder eine KM-Zahl).', source: 'running' };
      }
      if (d2 != null) {
        const t2 = riegel(t1, d1, d2);
        return {
          text: `**${distName(d2)} in ${fmtRace(t2)}** – prognostiziert aus ${distName(d1)} in ${fmtRace(t1)}\n\n- Riegel-Formel: ${fmtRace(t1)} × (${fmtN(d2, 2)} ÷ ${fmtN(d1, 2)})^1,06\n- Pace dafür: ${fmtPace(t2 / d2)} (${fmtN(d2 / (t2 / 3600), 2)} km/h)\n\n_Die Formel gilt bei passendem Training für die Zielstrecke – Top-Form oder Hitze verschieben das Ergebnis._`,
          source: 'running',
          val: Math.round(t2),
        };
      }
      const rows = RACES.map(([d, name]) => `| ${name}${Math.abs(d - d1) < 0.01 ? ' ←' : ''} | ${fmtRace(riegel(t1, d1, d))} | ${fmtPace(riegel(t1, d1, d) / d)} |`).join('\n');
      return {
        text: `**Wettkampf-Prognose aus ${distName(d1)} in ${fmtRace(t1)}** (Riegel-Formel, Exponent 1,06)\n\n| Strecke | Zeit | Pace |\n|---|---|---|\n${rows}\n\n_Gilt für gleichmäßiges Ausdauerniveau – längere Distanzen brauchen entsprechendes Training._`,
        source: 'running',
        val: Math.round(riegel(t1, d1, 42.195)),
      };
    }

    // „Splits 10 km in 50:00“ – gleichmäßige Renneinteilung
    if ((m = s.match(new RegExp(`^(?:splits?|split-?zeiten|zwischenzeiten?|renneinteilung)\\s*(?:für|auf|von)?\\s*(.+?)\\s+in\\s+${TIME_GROUP}\\s*$`, 'i')))) {
      const d = parseDistance(m[1]);
      const t = parseRaceSeconds(m[2]);
      if (d == null || t == null || d <= 0 || t <= 0) {
        return { text: 'Für Splits brauche ich Strecke und Zielzeit, z. B. **„Splits 10 km in 50:00“** oder **„Splits Marathon in 3:59:00“**.', source: 'running' };
      }
      const pace = t / d;
      const step = d <= 5.1 ? 1 : d <= 10.2 ? 2 : d <= 21.2 ? 5 : 10;
      const marks: number[] = [];
      for (let km = step; km < d - 0.01; km += step) marks.push(km);
      if (d > 21.2 && Math.abs(d - 42.195) < 0.01) marks.push(21.0975);
      marks.push(d);
      const rows = marks.map((km) => `| ${fmtN(km, km % 1 ? 3 : 0).replace(/,?0+$/, '')} km${Math.abs(km - d) < 0.01 ? ' (Ziel)' : ''} | ${fmtRace(pace * km)} |`).join('\n');
      return {
        text: `**${distName(d)} in ${fmtRace(t)} – gleichmäßige Einteilung**\n\n- Pace: **${fmtPace(pace)}** (${fmtN(d / (t / 3600), 2)} km/h)\n\n| Kilometer | Zeit |\n|---|---|\n${rows}\n\n_Tipp: Die ersten Kilometer 2–3 s pro km langsamer beginnen spart Kraft fürs Finish._`,
        source: 'running',
        val: Math.round(pace),
      };
    }

    // „Pulszonen bei Ruhepuls 60 und Maximalpuls 185“ / „Trainingspuls 35 Jahre“
    if (/pulszonen|trainingspuls|herzfrequenz|trainingsbereiche|pulsrechn/i.test(s)) {
      const rest = s.match(new RegExp(`(?:ruhepuls|ruheherzfrequenz)\\s*(?:von|ist|:|bei)?\\s*${NUM}`, 'i'));
      const max = s.match(new RegExp(`(?:maximalpuls|max\\.?\\s*hf|maximalherzfrequenz|hf\\s*max)\\s*(?:von|ist|:|bei)?\\s*${NUM}`, 'i'));
      const age = s.match(new RegExp(`${NUM}\\s*(?:jahren?|jahre)`, 'i')) || s.match(new RegExp(`(?:alter|im\\s+alter\\s+von)\\s*${NUM}`, 'i'));
      let restPuls = rest ? toNum(rest[1]) : null;
      let maxPuls = max ? toNum(max[1]) : null;
      const ageValue = age ? toNum(age[1]) : null;
      const tanaka = ageValue != null ? Math.round(208 - 0.7 * ageValue) : null;
      if (maxPuls == null && ageValue != null) maxPuls = 220 - ageValue;
      if (restPuls == null) restPuls = 60;
      if (maxPuls == null || !(maxPuls > restPuls) || maxPuls > 230 || restPuls < 25) {
        return { text: 'Für Pulszonen brauche ich Ruhepuls und Maximalpuls oder dein Alter, z. B. **„Pulszonen bei Ruhepuls 60 und Maximalpuls 185“** oder **„Trainingspuls 35 Jahre“**.', source: 'running' };
      }
      const hrr = maxPuls - restPuls;
      const rows = ZONES.map(([from, to, purpose], i) => {
        const low = Math.round(restPuls + from / 100 * hrr);
        const high = Math.round(restPuls + to / 100 * hrr);
        return `| Z${i + 1} | ${from}–${to} % | **${low}–${high}** | ${purpose} |`;
      }).join('\n');
      const base = `**Trainingspuls-Zonen** (Ruhepuls ${fmtN(restPuls)}, Maximalpuls ${fmtN(maxPuls)} – Karvonen-Formel)\n\n| Zone | Intensität | Puls | Zweck |\n|---|---|---|---|\n${rows}`;
      const note = ageValue != null
        ? `\n\n_Maximalpuls geschätzt mit 220 − ${fmtN(ageValue)} = ${fmtN(220 - ageValue)} (Faustformel)${tanaka != null ? `; nach Tanaka: 208 − 0,7 × ${fmtN(ageValue)} ≈ ${fmtN(tanaka)}` : ''}. Gemessen (z. B. Leistungstest) ist genauer. Ruhepuls ${rest ? 'von dir angegeben' : 'standardmäßig 60'}._`
        : `\n\n_Formel: Puls = Ruhepuls + Intensität × (Maximalpuls − Ruhepuls). Die tatsächliche Herzfrequenz hängt u. a. von Tagesform, Hitze und Medikamenten ab._`;
      return { text: base + note, source: 'running', val: maxPuls };
    }

    return null;
  },
};
