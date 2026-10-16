import type { Tool } from './types';
import { NUM, clean, fmtN, toNum } from './shared';

/* School grades: points → grade (IHK and linear scales), averages with +/-, upper-school points, "what do I need" calculations. */

const IHK: Array<[number, number, string]> = [[92, 1, 'sehr gut'], [81, 2, 'gut'], [67, 3, 'befriedigend'], [50, 4, 'ausreichend'], [30, 5, 'mangelhaft'], [0, 6, 'ungenügend']];
const LINEAR: Array<[number, number, string]> = [[87.5, 1, 'sehr gut'], [75, 2, 'gut'], [62.5, 3, 'befriedigend'], [50, 4, 'ausreichend'], [25, 5, 'mangelhaft'], [0, 6, 'ungenügend']];
const WORDS = ['', 'sehr gut', 'gut', 'befriedigend', 'ausreichend', 'mangelhaft', 'ungenügend'];

export const gradeFor = (pct: number, scale = IHK): [number, string] => { const row = scale.find(([min]) => pct >= min) || scale[scale.length - 1]; return [row[1], row[2]]; };

export function pointsToGrade(points: number): string {
  const table: Record<number, string> = { 15: '1+', 14: '1', 13: '1−', 12: '2+', 11: '2', 10: '2−', 9: '3+', 8: '3', 7: '3−', 6: '4+', 5: '4', 4: '4−', 3: '5+', 2: '5', 1: '5−', 0: '6' };
  return table[points] ?? '?';
}

export function gradeToPoints(grade: string): number | null {
  const m = grade.trim().match(/^([1-6])\s*([+\-−]?)$/);
  if (!m) return null;
  const base = Number(m[1]);
  if (base === 6) return 0;
  const mid = 17 - base * 3;                                 // 1 → 14, 2 → 11, 3 → 8, 4 → 5, 5 → 2
  return mid + (m[2] === '+' ? 1 : m[2] ? -1 : 0);
}

/** Parses „2+“, „3-“, „1,7“, „2“ into a decimal grade (tendencies count ±0,3). */
export function parseGrade(raw: string): number | null {
  const s = raw.trim().replace(/−/g, '-');
  let m = s.match(/^([1-6])\s*([+-])$/);
  if (m) return Number(m[1]) + (m[2] === '+' ? -0.3 : 0.3);
  m = s.match(/^([1-6](?:[.,]\d)?)$/);
  if (m) return toNum(m[1]);
  return null;
}

const fmtGrade = (v: number): string => fmtN(Math.round(v * 100) / 100, 2);

export const gradeTool: Tool = {
  id: 'grades',
  label: 'Noten',
  help: '- **Noten:** „Note bei 42 von 60 Punkten“, „Notendurchschnitt 2+, 3, 1-, 2“, „11 Punkte in Note“, „Welche Note brauche ich für 2,0 bei Schnitt 2,4 aus 3 Noten?“',
  run(input) {
    const s = clean(input).replace(/\?$/, '').trim();
    let m: RegExpMatchArray | null;

    if ((m = s.match(new RegExp(`^(?:welche\\s+)?(?:note|zensur|schulnote)\\s*(?:bei|für|fuer|mit|habe\\s+ich\\s+(?:bei|mit)|ist|:)?\\s*${NUM}\\s*(?:von|/|aus)\\s*${NUM}\\s*(?:punkten?|pkt\\.?|p)?(?:\\s*(?:nach|mit|im)\\s*(ihk|linear|prozent|schul(?:schlüssel|schluessel)))?$`, 'i')))
      || (m = s.match(new RegExp(`^${NUM}\\s*(?:von|/|aus)\\s*${NUM}\\s*(?:punkten?|pkt\\.?)\\s*(?:in|als|=)\\s*(?:eine\\s+)?note(?:\\s*(?:nach|mit)\\s*(ihk|linear))?$`, 'i')))) {
      const got = toNum(m[1]);
      const max = toNum(m[2]);
      if (max <= 0 || got < 0) return null;
      const pct = got / max * 100;
      const [ihk, ihkWord] = gradeFor(pct, IHK);
      const [lin, linWord] = gradeFor(pct, LINEAR);
      const decimal = Math.max(1, Math.min(6, 1 + (100 - pct) / 100 * 5 * (pct >= 50 ? 0.6 : 1)));
      const pointsUpper = pct >= 50 ? Math.min(15, Math.round(5 + (pct - 50) / 50 * 10)) : Math.round(pct / 50 * 4.49);
      const rows = IHK.map(([min, grade, word]) => `| ${grade} (${word}) | ab ${min} % | ab ${fmtN(Math.ceil(min / 100 * max * 2) / 2)} |`);
      return {
        text: `**${fmtN(got)} von ${fmtN(max)} Punkten = ${fmtN(pct, 1)} % → Note ${ihk} (${ihkWord})**\n\n- IHK-Schlüssel: ${ihk} · linearer Schlüssel (50 % = 4): ${lin} (${linWord}) · Oberstufe: ≈ ${pointsUpper} Punkte\n- Fehlende Punkte: ${fmtN(max - got)} (${fmtN(100 - pct, 1)} %)\n\n| Note | IHK | Punkte dafür |\n|---|---|---|\n${rows.join('\n')}\n\n_Schulen und Länder nutzen verschiedene Schlüssel – der Lehrkraft-Schlüssel gilt. Dezimalnote (grob): ${fmtGrade(decimal)}._`,
        source: 'grades',
        val: ihk,
      };
    }
    if ((m = s.match(/^(?:noten(?:durch)?schnitt|durchschnittsnote|notendurchschnitt|schnitt|durchschnitt\s+(?:der\s+)?noten|zeugnisschnitt|mittelwert\s+noten)\s*(?:von|aus|berechnen|:)?\s*([1-6][+\-−]?(?:\s*[,;]?\s*(?:und\s+)?[1-6](?:[.,]\d)?[+\-−]?)+)$/i))) {
      const tokens = m[1].replace(/−/g, '-').split(/\s*[,;]\s*|\s+und\s+|\s+/).filter(Boolean);
      const grades = tokens.map(parseGrade);
      if (grades.some((g) => g == null) || grades.length < 2) return null;
      const list = grades as number[];
      const avg = list.reduce((a, b) => a + b, 0) / list.length;
      const rounded = Math.round(avg);
      const best = Math.min(...list);
      const worst = Math.max(...list);
      const sum = list.reduce((a, b) => a + b, 0);
      const betterTarget = rounded - 1;
      let needLine = '';
      if (betterTarget >= 1) {
        const needed = (betterTarget + 0.49) * (list.length + 1) - sum;
        needLine = needed >= 1
          ? `- Für eine gerundete ${betterTarget} müsste die nächste Note höchstens ${fmtGrade(Math.min(6, needed))} sein.`
          : `- Eine gerundete ${betterTarget} ist mit einer weiteren Note nicht mehr erreichbar.`;
      }
      return {
        text: `**Durchschnitt: ${fmtGrade(avg)}** (${list.length} Noten: ${tokens.join(', ')}) → gerundet **${rounded} (${WORDS[rounded]})**\n\n- Beste ${fmtGrade(best)} · schlechteste ${fmtGrade(worst)} · Summe ${fmtGrade(sum)}\n- Tendenzen zählen ±0,3 (2+ = 1,7; 2− = 2,3)\n${needLine}`,
        source: 'grades',
        val: Math.round(avg * 100) / 100,
      };
    }
    if ((m = s.match(/^(\d{1,2})\s*(?:punkte?|pkt\.?|np)\s*(?:in|als|=|entsprechen|entspricht|sind)\s*(?:eine\s+)?(?:note|zensur|schulnote)?$/i)) || (m = s.match(/^(?:note\s+(?:für|fuer|bei|von)\s+)(\d{1,2})\s*(?:punkten?|pkt\.?|np)$/i))) {
      const points = Number(m[1]);
      if (points > 15) return { text: 'Das Oberstufen-Punktesystem reicht von 0 bis 15 Punkten.', source: 'grades' };
      const grade = pointsToGrade(points);
      const base = Number(grade[0]);
      return { text: `**${points} Punkte = Note ${grade} (${WORDS[base]})**\n\n| Punkte | 15 | 14 | 13 | 12 | 11 | 10 | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n| Note | 1+ | 1 | 1− | 2+ | 2 | 2− | 3+ | 3 | 3− | 4+ | 4 | 4− | 5+ | 5 | 5− | 6 |\n\n_Ab 5 Punkten gilt ein Kurs als bestanden; unter 5 Punkten ist er „unterpunktet“._`, source: 'grades', val: base };
    }
    if ((m = s.match(/^(?:note\s+)?([1-6]\s*[+\-−]?)\s*(?:in|als|=|entspricht|sind)\s*(?:oberstufen)?punkte?n?$/i))) {
      const points = gradeToPoints(m[1]);
      if (points == null) return null;
      return { text: `**Note ${m[1].replace(/\s+/g, '').replace('-', '−')} = ${points} Punkte** (Oberstufe, 0–15).`, source: 'grades', val: points };
    }
    if ((m = s.match(new RegExp(`^(?:welche\\s+note\\s+(?:brauche|benötige|benoetige)\\s+ich|was\\s+brauche\\s+ich|wie\\s+gut\\s+muss\\s+ich\\s+sein)\\s+(?:für|fuer|um)\\s+(?:einen\\s+|eine\\s+)?(?:schnitt|durchschnitt|note)?\\s*(?:von\\s+)?${NUM}\\s*(?:zu\\s+(?:bekommen|erreichen|haben|schaffen))?\\s*(?:bei|mit|wenn\\s+ich)\\s*(?:(?:einem\\s+|aktuellem\\s+|aktuellen\\s+|bisher\\s+)?(?:schnitt|durchschnitt)\\s*(?:von\\s+)?)?${NUM}\\s*(?:habe\\s+)?(?:aus|bei|nach|mit|von)\\s*(\\d{1,3})\\s*noten?(?:\\s+habe)?$`, 'i')))) {
      const target = toNum(m[1]);
      const current = toNum(m[2]);
      const count = Number(m[3]);
      const needed = target * (count + 1) - current * count;
      const verdict = needed < 1 ? `**nicht erreichbar** – selbst eine 1,0 ergibt nur ${fmtGrade((current * count + 1) / (count + 1))}.` : needed > 6 ? `**locker** – selbst eine 6 ergibt noch ${fmtGrade((current * count + 6) / (count + 1))}.` : `die nächste Note muss **${fmtGrade(needed)} oder besser** sein.`;
      return {
        text: `Für einen Schnitt von ${fmtGrade(target)} (bisher ${fmtGrade(current)} aus ${count} Noten): ${verdict}\n\n- Mit zwei weiteren Noten müssten beide im Schnitt ${fmtGrade((target * (count + 2) - current * count) / 2)} sein.\n- Formel: Zielnote × (n + 1) − Schnitt × n`,
        source: 'grades',
        val: Math.round(needed * 100) / 100,
      };
    }
    return null;
  },
};
