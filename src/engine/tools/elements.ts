import type { Tool } from './types';
import { clean, fmtN } from './shared';

/* Periodic table (118 elements): symbol, name, atomic mass, group/period, category – plus molar-mass calculation for formulas. */

type Row = [number, string, string, number, string];       // Z, symbol, German name, mass, category
const RAW: Row[] = [
  [1, 'H', 'Wasserstoff', 1.008, 'Nichtmetall'], [2, 'He', 'Helium', 4.0026, 'Edelgas'], [3, 'Li', 'Lithium', 6.94, 'Alkalimetall'], [4, 'Be', 'Beryllium', 9.0122, 'Erdalkalimetall'], [5, 'B', 'Bor', 10.81, 'Halbmetall'], [6, 'C', 'Kohlenstoff', 12.011, 'Nichtmetall'], [7, 'N', 'Stickstoff', 14.007, 'Nichtmetall'], [8, 'O', 'Sauerstoff', 15.999, 'Nichtmetall'], [9, 'F', 'Fluor', 18.998, 'Halogen'], [10, 'Ne', 'Neon', 20.180, 'Edelgas'],
  [11, 'Na', 'Natrium', 22.990, 'Alkalimetall'], [12, 'Mg', 'Magnesium', 24.305, 'Erdalkalimetall'], [13, 'Al', 'Aluminium', 26.982, 'Metall'], [14, 'Si', 'Silicium', 28.085, 'Halbmetall'], [15, 'P', 'Phosphor', 30.974, 'Nichtmetall'], [16, 'S', 'Schwefel', 32.06, 'Nichtmetall'], [17, 'Cl', 'Chlor', 35.45, 'Halogen'], [18, 'Ar', 'Argon', 39.948, 'Edelgas'], [19, 'K', 'Kalium', 39.098, 'Alkalimetall'], [20, 'Ca', 'Calcium', 40.078, 'Erdalkalimetall'],
  [21, 'Sc', 'Scandium', 44.956, 'Übergangsmetall'], [22, 'Ti', 'Titan', 47.867, 'Übergangsmetall'], [23, 'V', 'Vanadium', 50.942, 'Übergangsmetall'], [24, 'Cr', 'Chrom', 51.996, 'Übergangsmetall'], [25, 'Mn', 'Mangan', 54.938, 'Übergangsmetall'], [26, 'Fe', 'Eisen', 55.845, 'Übergangsmetall'], [27, 'Co', 'Cobalt', 58.933, 'Übergangsmetall'], [28, 'Ni', 'Nickel', 58.693, 'Übergangsmetall'], [29, 'Cu', 'Kupfer', 63.546, 'Übergangsmetall'], [30, 'Zn', 'Zink', 65.38, 'Übergangsmetall'],
  [31, 'Ga', 'Gallium', 69.723, 'Metall'], [32, 'Ge', 'Germanium', 72.630, 'Halbmetall'], [33, 'As', 'Arsen', 74.922, 'Halbmetall'], [34, 'Se', 'Selen', 78.971, 'Nichtmetall'], [35, 'Br', 'Brom', 79.904, 'Halogen'], [36, 'Kr', 'Krypton', 83.798, 'Edelgas'], [37, 'Rb', 'Rubidium', 85.468, 'Alkalimetall'], [38, 'Sr', 'Strontium', 87.62, 'Erdalkalimetall'], [39, 'Y', 'Yttrium', 88.906, 'Übergangsmetall'], [40, 'Zr', 'Zirconium', 91.224, 'Übergangsmetall'],
  [41, 'Nb', 'Niob', 92.906, 'Übergangsmetall'], [42, 'Mo', 'Molybdän', 95.95, 'Übergangsmetall'], [43, 'Tc', 'Technetium', 98, 'Übergangsmetall'], [44, 'Ru', 'Ruthenium', 101.07, 'Übergangsmetall'], [45, 'Rh', 'Rhodium', 102.91, 'Übergangsmetall'], [46, 'Pd', 'Palladium', 106.42, 'Übergangsmetall'], [47, 'Ag', 'Silber', 107.87, 'Übergangsmetall'], [48, 'Cd', 'Cadmium', 112.41, 'Übergangsmetall'], [49, 'In', 'Indium', 114.82, 'Metall'], [50, 'Sn', 'Zinn', 118.71, 'Metall'],
  [51, 'Sb', 'Antimon', 121.76, 'Halbmetall'], [52, 'Te', 'Tellur', 127.60, 'Halbmetall'], [53, 'I', 'Iod', 126.90, 'Halogen'], [54, 'Xe', 'Xenon', 131.29, 'Edelgas'], [55, 'Cs', 'Caesium', 132.91, 'Alkalimetall'], [56, 'Ba', 'Barium', 137.33, 'Erdalkalimetall'], [57, 'La', 'Lanthan', 138.91, 'Lanthanoid'], [58, 'Ce', 'Cer', 140.12, 'Lanthanoid'], [59, 'Pr', 'Praseodym', 140.91, 'Lanthanoid'], [60, 'Nd', 'Neodym', 144.24, 'Lanthanoid'],
  [61, 'Pm', 'Promethium', 145, 'Lanthanoid'], [62, 'Sm', 'Samarium', 150.36, 'Lanthanoid'], [63, 'Eu', 'Europium', 151.96, 'Lanthanoid'], [64, 'Gd', 'Gadolinium', 157.25, 'Lanthanoid'], [65, 'Tb', 'Terbium', 158.93, 'Lanthanoid'], [66, 'Dy', 'Dysprosium', 162.50, 'Lanthanoid'], [67, 'Ho', 'Holmium', 164.93, 'Lanthanoid'], [68, 'Er', 'Erbium', 167.26, 'Lanthanoid'], [69, 'Tm', 'Thulium', 168.93, 'Lanthanoid'], [70, 'Yb', 'Ytterbium', 173.05, 'Lanthanoid'],
  [71, 'Lu', 'Lutetium', 174.97, 'Lanthanoid'], [72, 'Hf', 'Hafnium', 178.49, 'Übergangsmetall'], [73, 'Ta', 'Tantal', 180.95, 'Übergangsmetall'], [74, 'W', 'Wolfram', 183.84, 'Übergangsmetall'], [75, 'Re', 'Rhenium', 186.21, 'Übergangsmetall'], [76, 'Os', 'Osmium', 190.23, 'Übergangsmetall'], [77, 'Ir', 'Iridium', 192.22, 'Übergangsmetall'], [78, 'Pt', 'Platin', 195.08, 'Übergangsmetall'], [79, 'Au', 'Gold', 196.97, 'Übergangsmetall'], [80, 'Hg', 'Quecksilber', 200.59, 'Übergangsmetall'],
  [81, 'Tl', 'Thallium', 204.38, 'Metall'], [82, 'Pb', 'Blei', 207.2, 'Metall'], [83, 'Bi', 'Bismut', 208.98, 'Metall'], [84, 'Po', 'Polonium', 209, 'Metall'], [85, 'At', 'Astat', 210, 'Halogen'], [86, 'Rn', 'Radon', 222, 'Edelgas'], [87, 'Fr', 'Francium', 223, 'Alkalimetall'], [88, 'Ra', 'Radium', 226, 'Erdalkalimetall'], [89, 'Ac', 'Actinium', 227, 'Actinoid'], [90, 'Th', 'Thorium', 232.04, 'Actinoid'],
  [91, 'Pa', 'Protactinium', 231.04, 'Actinoid'], [92, 'U', 'Uran', 238.03, 'Actinoid'], [93, 'Np', 'Neptunium', 237, 'Actinoid'], [94, 'Pu', 'Plutonium', 244, 'Actinoid'], [95, 'Am', 'Americium', 243, 'Actinoid'], [96, 'Cm', 'Curium', 247, 'Actinoid'], [97, 'Bk', 'Berkelium', 247, 'Actinoid'], [98, 'Cf', 'Californium', 251, 'Actinoid'], [99, 'Es', 'Einsteinium', 252, 'Actinoid'], [100, 'Fm', 'Fermium', 257, 'Actinoid'],
  [101, 'Md', 'Mendelevium', 258, 'Actinoid'], [102, 'No', 'Nobelium', 259, 'Actinoid'], [103, 'Lr', 'Lawrencium', 266, 'Actinoid'], [104, 'Rf', 'Rutherfordium', 267, 'Übergangsmetall'], [105, 'Db', 'Dubnium', 268, 'Übergangsmetall'], [106, 'Sg', 'Seaborgium', 269, 'Übergangsmetall'], [107, 'Bh', 'Bohrium', 270, 'Übergangsmetall'], [108, 'Hs', 'Hassium', 269, 'Übergangsmetall'], [109, 'Mt', 'Meitnerium', 278, 'unbekannt'], [110, 'Ds', 'Darmstadtium', 281, 'unbekannt'],
  [111, 'Rg', 'Roentgenium', 282, 'unbekannt'], [112, 'Cn', 'Copernicium', 285, 'Übergangsmetall'], [113, 'Nh', 'Nihonium', 286, 'unbekannt'], [114, 'Fl', 'Flerovium', 289, 'unbekannt'], [115, 'Mc', 'Moscovium', 290, 'unbekannt'], [116, 'Lv', 'Livermorium', 293, 'unbekannt'], [117, 'Ts', 'Tenness', 294, 'unbekannt'], [118, 'Og', 'Oganesson', 294, 'unbekannt'],
];

export interface Element { z: number; symbol: string; name: string; mass: number; category: string; period: number; group: number | null }

const PERIOD_START = [1, 3, 11, 19, 37, 55, 87];
function groupOf(z: number): number | null {
  if (z === 1) return 1;
  if (z === 2) return 18;
  if ((z >= 57 && z <= 71) || (z >= 89 && z <= 103)) return null;
  const period = PERIOD_START.filter((start) => z >= start).length;
  const start = PERIOD_START[period - 1];
  const offset = z - start;
  if (period <= 3) return offset < 2 ? offset + 1 : offset + 11;
  if (period <= 5) return offset + 1;
  const adjusted = z > 71 && period === 6 ? offset - 14 : z > 103 && period === 7 ? offset - 14 : offset;
  return adjusted + 1;
}

export const ELEMENTS: Element[] = RAW.map(([z, symbol, name, mass, category]) => ({ z, symbol, name, mass, category, period: PERIOD_START.filter((start) => z >= start).length, group: groupOf(z) }));

const ALIASES: Record<string, string> = { silizium: 'Si', jod: 'I', kalzium: 'Ca', cäsium: 'Cs', zäsium: 'Cs', zirkonium: 'Zr', wismut: 'Bi', kobalt: 'Co', tennessin: 'Ts', 'sauerstoff': 'O' };

export function findElement(raw: string): Element | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{1,3}$/.test(s)) return ELEMENTS.find((e) => e.z === Number(s)) || null;
  const sym = s.length <= 2 ? ELEMENTS.find((e) => e.symbol.toLowerCase() === s.toLowerCase()) : null;
  if (sym) return sym;
  const lower = s.toLowerCase();
  if (ALIASES[lower]) return ELEMENTS.find((e) => e.symbol === ALIASES[lower]) || null;
  return ELEMENTS.find((e) => e.name.toLowerCase() === lower) || ELEMENTS.find((e) => lower.length >= 4 && e.name.toLowerCase().startsWith(lower)) || null;
}

/** Molar mass of a formula like „H2O“, „Ca(OH)2“, „CuSO4·5H2O“. */
export function molarMass(formula: string): { mass: number; parts: Array<[string, number]> } | null {
  const bySymbol = new Map(ELEMENTS.map((e) => [e.symbol, e]));
  const counts = new Map<string, number>();
  const segments = formula.replace(/\s+/g, '').split(/[·*.]/);
  for (const segment of segments) {
    const lead = segment.match(/^(\d+)(.*)$/);
    const factor = lead ? Number(lead[1]) : 1;
    const body = lead ? lead[2] : segment;
    const stack: Array<Map<string, number>> = [new Map()];
    let i = 0;
    while (i < body.length) {
      const ch = body[i];
      if (ch === '(' || ch === '[') { stack.push(new Map()); i++; continue; }
      if (ch === ')' || ch === ']') {
        const group = stack.pop();
        if (!group || !stack.length) return null;
        i++;
        const num = body.slice(i).match(/^\d+/);
        const mult = num ? Number(num[0]) : 1;
        if (num) i += num[0].length;
        for (const [sym, n] of group) stack[stack.length - 1].set(sym, (stack[stack.length - 1].get(sym) || 0) + n * mult);
        continue;
      }
      const m = body.slice(i).match(/^([A-Z][a-z]?)(\d*)/);
      if (!m || !bySymbol.has(m[1])) return null;
      i += m[0].length;
      stack[stack.length - 1].set(m[1], (stack[stack.length - 1].get(m[1]) || 0) + (m[2] ? Number(m[2]) : 1));
    }
    if (stack.length !== 1) return null;
    for (const [sym, n] of stack[0]) counts.set(sym, (counts.get(sym) || 0) + n * factor);
  }
  if (!counts.size) return null;
  let mass = 0;
  const parts: Array<[string, number]> = [];
  for (const [sym, n] of counts) { mass += bySymbol.get(sym)!.mass * n; parts.push([sym, n]); }
  return { mass, parts };
}

const card = (e: Element): string => `**${e.name} (${e.symbol})** – Ordnungszahl ${e.z}\n\n- Atommasse: ${fmtN(e.mass, 3)} u\n- Periode ${e.period}${e.group ? `, Gruppe ${e.group}` : ' (Lanthanoid/Actinoid, Gruppe 3)'} · ${e.category}\n- Protonen: ${e.z} · Elektronen (neutral): ${e.z} · Neutronen (häufigstes Isotop): ≈ ${Math.round(e.mass) - e.z}\n- Nachbarn: ${e.z > 1 ? `${ELEMENTS[e.z - 2].name} (${e.z - 1})` : '–'} · ${e.z < 118 ? `${ELEMENTS[e.z].name} (${e.z + 1})` : '–'}`;

export const elementTool: Tool = {
  id: 'elements',
  label: 'Periodensystem',
  help: '- **Chemie:** „Element Fe“, „Ordnungszahl 79“, „Was ist Wolfram?“, „Molare Masse von H2O“, „Molmasse Ca(OH)2“, „Edelgase“',
  run(input) {
    const s = clean(input).replace(/\?$/, '').trim();
    let m: RegExpMatchArray | null;
    if ((m = s.match(/^(?:molare\s+masse|molmasse|molekülmasse|molekuelmasse|molekulargewicht|molare\s+masse\s+von|formelmasse)\s*(?:von|für|fuer|:)?\s*([A-Za-z0-9()[\]·*.\s]+)$/i))) {
      const formula = m[1].trim();
      const result = molarMass(formula);
      if (!result) return { text: `„${formula}“ kann ich nicht als Summenformel lesen – Elementsymbole mit Groß-/Kleinschreibung, z. B. „H2O“, „NaCl“, „Ca(OH)2“ oder „CuSO4·5H2O“.`, source: 'elements' };
      const bySymbol = new Map(ELEMENTS.map((e) => [e.symbol, e]));
      const rows = result.parts.map(([sym, n]) => { const e = bySymbol.get(sym)!; const part = e.mass * n; return `| ${e.name} (${sym}) | ${n} | ${fmtN(e.mass, 3)} | ${fmtN(part, 3)} | ${fmtN(part / result.mass * 100, 1)} % |`; });
      return {
        text: `**M(${formula}) = ${fmtN(result.mass, 3)} g/mol**\n\n| Element | Anzahl | Atommasse | Anteil | Massen-% |\n|---|---:|---:|---:|---:|\n${rows.join('\n')}\n\n_1 mol ${formula} wiegt ${fmtN(result.mass, 2)} g; 100 g entsprechen ${fmtN(100 / result.mass, 3)} mol._`,
        source: 'elements',
        val: Math.round(result.mass * 1000) / 1000,
      };
    }
    if ((m = s.match(/^(?:element|chemisches\s+element|elementsymbol|ordnungszahl|periodensystem|pse)\s*(?:von|für|fuer|:|nr\.?|nummer)?\s*([A-Za-zäöü]{1,20}|\d{1,3})$/i))
      || (m = s.match(/^(?:was\s+ist|wofür\s+steht|wofuer\s+steht|welches\s+element\s+(?:ist|hat\s+das\s+symbol|hat\s+die\s+ordnungszahl))\s+(?:das\s+element\s+|das\s+symbol\s+|die\s+ordnungszahl\s+)?([A-Z][a-z]?|\d{1,3})$/))
      || (m = s.match(/^(?:atommasse|molmasse|atomgewicht|symbol|ordnungszahl)\s+(?:von|des|für|fuer)\s+([A-Za-zäöü]{1,20})$/i))) {
      const e = findElement(m[1]);
      if (!e) return /^(?:element|ordnungszahl|periodensystem|pse|atommasse)/i.test(s) ? { text: `„${m[1]}“ kenne ich nicht als Element – Symbol (Fe), Name (Eisen) oder Ordnungszahl (26) angeben.`, source: 'elements' } : null;
      return { text: card(e), source: 'elements', val: e.z };
    }
    if ((m = s.match(/^(?:was\s+ist|element)\s+([A-Za-zÄÖÜäöüß]{3,})$/i))) {
      const e = ELEMENTS.find((x) => x.name.toLowerCase() === m![1].toLowerCase());
      return e ? { text: card(e), source: 'elements', val: e.z } : null;
    }
    if ((m = s.match(/^(?:(?:alle|die|liste\s+der)\s+)?(edelgase|halogene|alkalimetalle|erdalkalimetalle|übergangsmetalle|uebergangsmetalle|lanthanoide|actinoide|halbmetalle|nichtmetalle)$/i))) {
      const key = m[1].toLowerCase().replace(/e$/, '').replace(/uebergang/, 'übergang');
      const list = ELEMENTS.filter((e) => e.category.toLowerCase().startsWith(key.replace(/metall$/, 'metall')));
      if (!list.length) return null;
      return { text: `**${list.length} ${m[1]}:**\n\n${list.map((e) => `- ${e.name} (${e.symbol}, ${e.z})`).join('\n')}`, source: 'elements', val: list.length };
    }
    if ((m = s.match(/^(?:periode|gruppe|hauptgruppe)\s+(\d{1,2})(?:\s+(?:des\s+)?periodensystems?)?$/i))) {
      const n = Number(m[1]);
      const byPeriod = /^periode/i.test(s);
      const main = /hauptgruppe/i.test(s);
      const group = main ? (n <= 2 ? n : n + 10) : n;
      const list = ELEMENTS.filter((e) => (byPeriod ? e.period === n : e.group === group));
      if (!list.length) return null;
      return { text: `**${byPeriod ? `Periode ${n}` : main ? `${n}. Hauptgruppe (Gruppe ${group})` : `Gruppe ${n}`}: ${list.length} Elemente**\n\n${list.map((e) => `- ${e.name} (${e.symbol}, ${e.z}) – ${e.category}`).join('\n')}`, source: 'elements', val: list.length };
    }
    return null;
  },
};
