import type { Tool, ToolResult } from './types';
import { clean, fmtN } from './shared';

/* ---------------- Schaltjahr ---------------- */

export const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

function leapReason(year: number): string {
  if (year % 400 === 0) return `${year} ist durch 400 teilbar – also ein Schaltjahr, obwohl es durch 100 teilbar ist.`;
  if (year % 100 === 0) return `${year} ist durch 100, aber nicht durch 400 teilbar – deshalb **kein** Schaltjahr (Ausnahme der Jahrhundertregel).`;
  if (year % 4 === 0) return `${year} ist durch 4 teilbar und kein Jahrhundertjahr.`;
  return `${year} ist nicht durch 4 teilbar.`;
}

function leapYear(s: string, now: Date): ToolResult | null {
  let m: RegExpMatchArray | null;
  const current = now.getFullYear();
  if ((m = s.match(/^(?:wann\s+ist\s+(?:das\s+)?|das\s+)?(?:nächste[s]?|naechste[s]?|kommende[s]?)\s+schaltjahr$/i))) {
    let year = current;
    while (!isLeapYear(year)) year += 1;
    const after: number[] = [];
    for (let y = year + 1; after.length < 3; y += 1) if (isLeapYear(y)) after.push(y);
    return { text: `Das nächste Schaltjahr ist **${year}**${year === current ? ' – also dieses Jahr' : ''}. Danach: ${after.join(', ')}.`, source: 'numbers', val: year };
  }
  if ((m = s.match(/^(?:ist|war|wird)\s+(?:das\s+jahr\s+)?(\d{1,4}|dieses\s+jahr|nächstes\s+jahr|naechstes\s+jahr|letztes\s+jahr)\s+(?:ein\s+)?schaltjahr(?:\s+sein|\s+gewesen)?$/i))
    || (m = s.match(/^schaltjahr\s*:?\s*(\d{1,4}|dieses\s+jahr)$/i))
    || (m = s.match(/^(?:hat|hatte)\s+(?:das\s+jahr\s+)?(\d{1,4})\s+(?:einen\s+)?29\.?\s*februar$/i))) {
    const word = m[1].toLowerCase();
    const year = /^\d+$/.test(word) ? +word : word.startsWith('nächstes') || word.startsWith('naechstes') ? current + 1 : word.startsWith('letztes') ? current - 1 : current;
    const leap = isLeapYear(year);
    return {
      text: `**${year} ist ${leap ? 'ein Schaltjahr' : 'kein Schaltjahr'}.** ${leapReason(year)}\n\n` +
        `Regel: Schaltjahr, wenn durch 4 teilbar – außer durch 100 teilbar – es sei denn, durch 400 teilbar. ${leap ? `Der Februar ${year} hat 29 Tage, das Jahr 366.` : `Der Februar ${year} hat 28 Tage, das Jahr 365.`}`,
      source: 'numbers',
      val: year,
    };
  }
  if ((m = s.match(/^(?:welche\s+)?schaltjahre\s+(?:gibt\s+es\s+|liegen\s+)?(?:zwischen|von)\s+(\d{1,4})\s+(?:und|bis)\s+(\d{1,4})$/i))) {
    const a = Math.min(+m[1], +m[2]);
    const b = Math.max(+m[1], +m[2]);
    if (b - a > 400) return { text: 'Bitte einen Zeitraum von höchstens 400 Jahren wählen.', source: 'numbers' };
    const years: number[] = [];
    for (let y = a; y <= b; y += 1) if (isLeapYear(y)) years.push(y);
    return { text: `Schaltjahre zwischen ${a} und ${b} (${years.length}): ${years.join(', ') || 'keine'}.`, source: 'numbers', val: years.length };
  }
  return null;
}

/* ---------------- Römische Zahlen ---------------- */

const ROMAN: Array<[number, string]> = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

export function toRoman(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 3999) return null;
  let rest = value;
  let out = '';
  for (const [n, sym] of ROMAN) while (rest >= n) { out += sym; rest -= n; }
  return out;
}

export function fromRoman(text: string): number | null {
  const s = text.toUpperCase().trim();
  if (!/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(s) || !s) return null;
  const values: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i += 1) {
    const v = values[s[i]];
    const next = values[s[i + 1]] || 0;
    total += v < next ? -v : v;
  }
  return total;
}

function romanSteps(value: number): string {
  const parts: string[] = [];
  let rest = value;
  for (const [n, sym] of ROMAN) {
    while (rest >= n) { parts.push(`${sym} = ${fmtN(n)}`); rest -= n; }
  }
  return parts.join(' · ');
}

function roman(s: string): ToolResult | null {
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(?:schreibe\s+|wandle\s+|konvertiere\s+)?(\d{1,5})\s+(?:in|als|zu)\s+(?:eine\s+)?römisch(?:e|en|er)?(?:\s+(?:zahl|zahlen|ziffern|schreibweise))?$/i))
    || (m = s.match(/^römisch(?:e\s+zahl)?\s*(?:von|für|fuer|:)?\s*(\d{1,5})$/i))
    || (m = s.match(/^(\d{1,5})\s+römisch$/i))) {
    const value = +m[1];
    const out = toRoman(value);
    if (!out) return { text: 'Römische Zahlen schreibe ich von 1 bis 3999 – dafür gab es keine größeren Standardzeichen.', source: 'numbers' };
    return { text: `**${fmtN(value)} = ${out}**\n\nZerlegung: ${romanSteps(value)}`, source: 'numbers', val: value };
  }
  if ((m = s.match(/^(?:was\s+(?:ist|bedeutet|heißt|heisst)\s+)?(?:die\s+)?(?:römische\s+zahl\s+)?([MDCLXVI]{1,15})\s+(?:in|als|zu)\s+(?:dezimal|arabisch(?:e|en)?(?:\s+(?:zahl|zahlen|ziffern))?|zahl|dezimalzahl)$/i))
    || (m = s.match(/^(?:was\s+(?:ist|bedeutet|heißt|heisst)\s+)?(?:die\s+)?römische\s+zahl\s+([MDCLXVI]{1,15})$/i))
    || (m = s.match(/^römisch\s+([MDCLXVI]{1,15})$/i))
    || (m = s.match(/^([MDCLXVI]{1,15})\s+römisch$/i))
    || (m = s.match(/^(?:was\s+(?:bedeutet|heißt|heisst)|welche\s+zahl\s+ist)\s+([MDCLXVI]{2,15})$/i))) {
    const value = fromRoman(m[1]);
    if (value == null) return { text: `„${m[1].toUpperCase()}“ ist keine gültige römische Zahl (erlaubt sind I, V, X, L, C, D, M in der üblichen Schreibweise).`, source: 'numbers' };
    return { text: `**${m[1].toUpperCase()} = ${fmtN(value)}**\n\nZerlegung: ${romanSteps(value)}`, source: 'numbers', val: value };
  }
  return null;
}

/* ---------------- Zahl in Worten ---------------- */

const ONES = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
const BIG: Array<[bigint, string, string]> = [
  [1_000_000_000_000_000n, 'Billiarde', 'Billiarden'],
  [1_000_000_000_000n, 'Billion', 'Billionen'],
  [1_000_000_000n, 'Milliarde', 'Milliarden'],
  [1_000_000n, 'Million', 'Millionen'],
];

function below1000(n: number): string {
  let out = '';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) out += `${ONES[h]}hundert`;
  if (rest < 20) out += ONES[rest];
  else {
    const one = rest % 10;
    out += `${one ? `${ONES[one]}und` : ''}${TENS[Math.floor(rest / 10)]}`;
  }
  return out;
}

/** German number words for integers up to 10^18 − 1 („eintausendzweihundertvierunddreißig“). */
export function numberWords(value: bigint): string {
  if (value === 0n) return 'null';
  if (value < 0n) return `minus ${numberWords(-value)}`;
  if (value >= 1_000_000_000_000_000_000n) throw new Error('zu groß');
  const parts: string[] = [];
  let rest = value;
  for (const [unit, one, many] of BIG) {
    const count = rest / unit;
    if (count) {
      parts.push(count === 1n ? `eine ${one}` : `${numberWords(count)} ${many}`);
      rest %= unit;
    }
  }
  const small = Number(rest);
  const thousands = Math.floor(small / 1000);
  const below = small % 1000;
  let tail = '';
  if (thousands) tail += `${below1000(thousands)}tausend`;
  if (below) tail += below1000(below);
  if (tail) parts.push(tail);
  let text = parts.join(' ');
  // A standalone „ein“ at the end becomes „eins“ (eins, hunderteins, eine Million eins).
  if (/(?:^|[\s]|hundert|tausend)ein$/.test(text)) text = `${text}s`;
  return text;
}

function wordsFor(raw: string, euro: boolean): string {
  const s = raw.replace(/\./g, '').replace(',', '.');
  const negative = s.startsWith('-');
  const [whole, dec = ''] = s.replace(/^[+-]/, '').split('.');
  const base = numberWords(BigInt(whole || '0'));
  if (euro) {
    const cents = Number((dec + '00').slice(0, 2));
    const euroWord = BigInt(whole || '0') === 1n ? 'ein Euro' : `${base} Euro`;
    const centWord = cents ? ` und ${cents === 1 ? 'ein Cent' : `${numberWords(BigInt(cents))} Cent`}` : '';
    return `${negative ? 'minus ' : ''}${euroWord}${centWord}`;
  }
  if (!dec) return `${negative ? 'minus ' : ''}${base}`;
  const digits = dec.split('').map((d) => (d === '0' ? 'null' : d === '1' ? 'eins' : ONES[+d])).join(' ');
  return `${negative ? 'minus ' : ''}${base} Komma ${digits}`;
}

function inWords(s: string): ToolResult | null {
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(?:schreib(?:e)?\s+(?:mir\s+)?|wie\s+schreibt\s+man\s+)?(?:die\s+zahl\s+)?([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+-]?\d{1,18}(?:,\d+)?)\s*(€|euro|eur)?\s+(?:in\s+worten|in\s+wörtern|in\s+woertern|als\s+wort|als\s+zahlwort|ausgeschrieben|aus|in\s+buchstaben)$/i))
    || (m = s.match(/^(?:zahl\s+in\s+worten|zahlwort|in\s+worten|ausschreiben)\s*:?\s*([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+-]?\d{1,18}(?:,\d+)?)\s*(€|euro|eur)?$/i))) {
    const raw = m[1];
    const euro = Boolean(m[2]);
    const words = wordsFor(raw, euro);
    const value = Number(raw.replace(/\./g, '').replace(',', '.'));
    return {
      text: `**${raw}${euro ? ' €' : ''}** in Worten:\n\n**${words}**${euro ? '' : '\n\n_Zahlwörter unter einer Million werden im Deutschen zusammengeschrieben._'}`,
      source: 'numbers',
      val: Number.isFinite(value) ? value : null,
    };
  }
  return null;
}

export const numbersTool: Tool = {
  id: 'numbers',
  label: 'Schaltjahr, Römisch & Zahlwörter',
  help: '- **Zahlen:** „Ist 2100 ein Schaltjahr?“, „2026 in römisch“, „MMXXVI in dezimal“, „1234 in Worten“, „1234,56 € in Worten“',
  run(input, context) {
    const s = clean(input);
    return leapYear(s, context.now()) || roman(s) || inWords(s);
  },
};
