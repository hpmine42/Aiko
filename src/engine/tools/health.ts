import type { Tool, ToolResult } from './types';
import { NUM, clean, fmtN, toNum } from './shared';

const WEIGHT = new RegExp(NUM + '\\s*(kg|kilo|kilogramm|lbs?|pfund)\\b', 'i');
const HEIGHT = new RegExp(NUM + '\\s*(m|meter|cm|zentimeter)\\b', 'i');

function weightKg(s: string): number | null {
  const m = s.match(WEIGHT);
  if (!m) return null;
  const v = toNum(m[1]);
  return /^lb|pfund/i.test(m[2]) ? v * 0.45359237 : v;
}

function heightM(s: string): number | null {
  const m = s.match(HEIGHT);
  if (m) {
    const v = toNum(m[1]);
    return /^c/i.test(m[2]) ? v / 100 : v;
  }
  // „1,75“ or „175“ without unit after the weight
  const rest = s.replace(WEIGHT, ' ');
  const bare = rest.match(new RegExp('(?:^|[\\s,;:])' + NUM + '(?=$|[\\s,;?!.])'));
  if (!bare) return null;
  const v = toNum(bare[1]);
  if (v >= 1 && v <= 2.6) return v;
  if (v >= 100 && v <= 260) return v / 100;
  return null;
}

export function bmiCategory(bmi: number): string {
  if (bmi < 16) return 'starkes Untergewicht';
  if (bmi < 18.5) return 'Untergewicht';
  if (bmi < 25) return 'Normalgewicht';
  if (bmi < 30) return 'Übergewicht (Präadipositas)';
  if (bmi < 35) return 'Adipositas Grad I';
  if (bmi < 40) return 'Adipositas Grad II';
  return 'Adipositas Grad III';
}

function bmi(s: string): ToolResult | null {
  if (!/\bbmi\b|body[\s-]?mass[\s-]?index|körpermasseindex|koerpermasseindex/i.test(s)) return null;
  const kg = weightKg(s);
  const m = heightM(s);
  if (kg == null || m == null) {
    return { text: 'Für den BMI brauche ich Gewicht und Größe, z. B. „BMI bei 70 kg und 1,75 m“.', source: 'health' };
  }
  if (!(kg > 0 && kg < 700) || !(m > 0.5 && m < 2.8)) return { text: 'Diese Werte sehen nicht nach Gewicht in kg und Größe in m/cm aus.', source: 'health' };
  const value = kg / (m * m);
  const low = 18.5 * m * m;
  const high = 24.9 * m * m;
  return {
    text: `**BMI = ${fmtN(value, 1)}** – ${bmiCategory(value)}\n\n` +
      `Rechnung: ${fmtN(kg, 1)} kg ÷ (${fmtN(m, 2)} m)² = ${fmtN(value, 2)}\n\n` +
      `| BMI | Einordnung (WHO, Erwachsene) |\n|---|---|\n| unter 18,5 | Untergewicht |\n| 18,5 – 24,9 | Normalgewicht |\n| 25 – 29,9 | Übergewicht |\n| ab 30 | Adipositas |\n\n` +
      `Normalgewicht bei ${fmtN(m, 2)} m: etwa ${fmtN(low, 0)} – ${fmtN(high, 0)} kg.\n\n` +
      '_Der BMI ist eine grobe Orientierung: Er unterscheidet nicht zwischen Muskel- und Fettmasse und gilt nicht für Kinder, Schwangere oder Leistungssportler. Keine medizinische Bewertung._',
    source: 'health',
    val: Math.round(value * 10) / 10,
  };
}

const ACTIVITY: Array<[RegExp, number, string]> = [
  [/\b(?:sitzend|kaum\s+aktiv|wenig\s+(?:aktiv|bewegung)|keine?\s+sport|inaktiv|büro)\b/i, 1.2, 'sitzend / kaum Bewegung'],
  [/\b(?:leicht\s+aktiv|1\s*[-–]\s*3\s*(?:mal|x)|etwas\s+sport|leichte\s+bewegung)\b/i, 1.375, 'leicht aktiv (1–3× Sport pro Woche)'],
  [/\b(?:moderat|mäßig|maessig|mittel|normal\s+aktiv|3\s*[-–]\s*5\s*(?:mal|x))\b/i, 1.55, 'moderat aktiv (3–5× Sport pro Woche)'],
  [/\b(?:sehr\s+aktiv|sportlich|6\s*[-–]\s*7\s*(?:mal|x)|viel\s+sport)\b/i, 1.725, 'sehr aktiv (6–7× Sport pro Woche)'],
  [/\b(?:extrem\s+aktiv|leistungssport|körperlich\s+schwer|schwere\s+arbeit|profisport)\b/i, 1.9, 'extrem aktiv (schwere Arbeit / Leistungssport)'],
];

function calories(s: string): ToolResult | null {
  if (!/kalorienbedarf|kalorien(?:ver)?brauch|grundumsatz|gesamtumsatz|energiebedarf|kcal\s+bedarf|wie\s+viele?\s+kalorien\s+(?:brauche|benötige|darf)/i.test(s)) return null;
  const female = /\b(?:frau|weiblich|w)\b/i.test(s);
  const male = /\b(?:mann|männlich|maennlich|m)\b/i.test(s) && !female;
  const ageMatch = s.match(/(\d{1,3})\s*(?:jahre?|j\.?|jährig|jaehrig)\b/i);
  const kg = weightKg(s);
  const m = heightM(s);
  const missing: string[] = [];
  if (!female && !male) missing.push('Geschlecht (Mann/Frau)');
  if (!ageMatch) missing.push('Alter („30 Jahre“)');
  if (kg == null) missing.push('Gewicht („80 kg“)');
  if (m == null) missing.push('Größe („180 cm“)');
  if (missing.length) {
    return { text: `Für den Kalorienbedarf brauche ich noch: ${missing.join(', ')}.\n\nBeispiel: „Kalorienbedarf Mann, 30 Jahre, 80 kg, 180 cm, moderat aktiv“.`, source: 'health' };
  }
  const age = +ageMatch![1];
  if (!(age >= 10 && age <= 120) || !(kg! > 0 && kg! < 700) || !(m! > 0.5 && m! < 2.8)) return { text: 'Diese Werte sehen nicht plausibel aus (Alter in Jahren, Gewicht in kg, Größe in m/cm).', source: 'health' };
  const bmr = 10 * kg! + 6.25 * m! * 100 - 5 * age + (female ? -161 : 5);
  const activity = ACTIVITY.find(([re]) => re.test(s));
  const rows = ACTIVITY.map(([, factor, label]) => `| ${label} | ${fmtN(Math.round(bmr * factor))} kcal |${activity && activity[1] === factor ? ' ◀︎' : ''}`);
  const chosen = activity ? Math.round(bmr * activity[1]) : null;
  return {
    text: `**Grundumsatz ≈ ${fmtN(Math.round(bmr))} kcal pro Tag**${chosen ? ` · Gesamtumsatz ≈ **${fmtN(chosen)} kcal** (${activity![2]})` : ''}\n\n` +
      `| Aktivität | Gesamtumsatz |\n|---|---|\n${rows.join('\n')}\n\n` +
      `Formel (Mifflin-St Jeor): 10 × ${fmtN(kg!, 1)} kg + 6,25 × ${fmtN(m! * 100, 0)} cm − 5 × ${age} Jahre ${female ? '− 161' : '+ 5'}.\n\n` +
      '_Schätzwerte für gesunde Erwachsene; der tatsächliche Bedarf hängt von Muskelmasse, Gesundheit und Alltag ab. Keine Ernährungsberatung._',
    source: 'health',
    val: chosen ?? Math.round(bmr),
  };
}

export const healthTool: Tool = {
  id: 'health',
  label: 'BMI & Kalorienbedarf',
  help: '- **BMI & Kalorien:** „BMI bei 70 kg und 1,75 m“, „Kalorienbedarf Frau, 28 Jahre, 62 kg, 168 cm, sportlich“',
  run(input) {
    const s = clean(input);
    return bmi(s) || calories(s);
  },
};
