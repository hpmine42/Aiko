import type { Tool } from './types';
import { clean, fmtN, parseNumberList, reorder } from './shared';

/* Number theory & combinatorics: gcd/lcm for lists, divisors, Fibonacci, binomials, Collatz, digit sums. */

const gcd2 = (a: bigint, b: bigint): bigint => { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a; };
export const gcd = (values: bigint[]): bigint => values.reduce((acc, v) => gcd2(acc, v));
export const lcm = (values: bigint[]): bigint => values.reduce((acc, v) => (acc / gcd2(acc, v)) * v);

export function divisors(n: number): number[] {
  const small: number[] = [];
  const large: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) { small.push(d); if (d !== n / d) large.unshift(n / d); }
  }
  return [...small, ...large];
}

export function fibonacci(count: number): bigint[] {
  const out: bigint[] = [];
  let a = 0n;
  let b = 1n;
  for (let i = 0; i < count; i++) { out.push(a); [a, b] = [b, a + b]; }
  return out;
}

export function binomial(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  k = Math.min(k, n - k);
  let r = 1n;
  for (let i = 1; i <= k; i++) r = (r * BigInt(n - k + i)) / BigInt(i);
  return r;
}

export function factorial(n: number): bigint {
  let r = 1n;
  for (let i = 2; i <= n; i++) r *= BigInt(i);
  return r;
}

export function collatz(n: number): { steps: number; peak: number; sequence: number[] } {
  const sequence = [n];
  let peak = n;
  let steps = 0;
  while (n !== 1 && steps < 10000) {
    n = n % 2 === 0 ? n / 2 : 3 * n + 1;
    sequence.push(n);
    peak = Math.max(peak, n);
    steps += 1;
  }
  return { steps, peak, sequence };
}

const big = (v: bigint): string => (v > BigInt(Number.MAX_SAFE_INTEGER) || v < -BigInt(Number.MAX_SAFE_INTEGER) ? v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : fmtN(Number(v)));

const ints = (raw: string): number[] | null => {
  const list = parseNumberList(raw);
  if (!list || list.some((v) => !Number.isInteger(v))) return null;
  return list;
};

export const numberTheoryTool: Tool = {
  id: 'numtheory',
  label: 'Zahlentheorie & Kombinatorik',
  help: '- **Zahlentheorie:** „ggT von 48, 36 und 120“, „Teiler von 360“, „Fibonacci bis 20“, „49 über 6“, „Wie viele Möglichkeiten 6 aus 49?“, „Collatz 27“, „Quersumme 98765“',
  run(input) {
    const s = clean(input).replace(/\s+/g, ' ');
    let m: RegExpMatchArray | null;

    if ((m = s.match(/^(?:was\s+ist\s+)?(?:der\s+|das\s+)?(ggt|größter?\s+gemeinsamer?\s+teiler|groesster?\s+gemeinsamer?\s+teiler|kgv|kleinstes?\s+gemeinsames?\s+vielfaches?)\s*(?:von|für|fuer|aus|:)?\s*\(?\s*([\d.,;\s]+(?:und\s+[\d.]+)?)\s*\)?\s*\??$/i))) {
      const list = ints(m[2].replace(/\s+und\s+/gi, ', '));
      if (!list || list.length < 2 || list.some((v) => v <= 0)) return { text: 'Bitte mindestens zwei positive ganze Zahlen, z. B. „ggT von 48 und 36“.', source: 'numtheory' };
      const isGcd = /ggt|teiler/i.test(m[1]);
      const values = list.map((v) => BigInt(v));
      const result = isGcd ? gcd(values) : lcm(values);
      const g = gcd(values);
      const l = lcm(values);
      return {
        text: `**${isGcd ? 'ggT' : 'kgV'}(${list.map((v) => fmtN(v)).join(', ')}) = ${big(result)}**\n\n- ggT = ${big(g)} · kgV = ${big(l)}${list.length === 2 ? ` · Probe: ggT × kgV = ${big(g * l)} = ${fmtN(list[0])} × ${fmtN(list[1])}` : ''}\n- ${g === 1n ? 'Die Zahlen sind teilerfremd.' : `Gekürzt durch den ggT: ${list.map((v) => big(BigInt(v) / g)).join(' : ')}`}`,
        source: 'numtheory',
        val: Number(result),
      };
    }
    if ((m = s.match(/^(?:alle\s+|die\s+)?teiler\s+(?:von|der\s+zahl)\s+(\d{1,12})\s*\??$/i)) || (m = s.match(/^(?:wie\s*viele\s+teiler\s+hat\s+(?:die\s+)?)(\d{1,12})\s*\??$/i))) {
      const n = Number(m[1]);
      if (n < 1) return null;
      const list = divisors(n);
      const sum = list.reduce((a, b) => a + b, 0) - n;
      const kind = sum === n ? 'eine vollkommene Zahl (Teilersumme = Zahl)' : sum > n ? 'abundant (Teilersumme > Zahl)' : 'defizient (Teilersumme < Zahl)';
      return {
        text: `**${fmtN(n)} hat ${list.length} Teiler:** ${list.length > 60 ? `${list.slice(0, 30).map((v) => fmtN(v)).join(', ')}, … , ${list.slice(-10).map((v) => fmtN(v)).join(', ')}` : list.map((v) => fmtN(v)).join(', ')}\n\n- Echte Teilersumme: ${fmtN(sum)} → ${kind}\n- ${list.length === 2 ? 'Primzahl ✔️' : `Teilerpaare: ${list.slice(0, Math.ceil(list.length / 2)).slice(0, 8).map((d) => `${fmtN(d)}×${fmtN(n / d)}`).join(', ')}${list.length > 16 ? ', …' : ''}`}`,
        source: 'numtheory',
        val: list.length,
      };
    }
    if ((m = s.match(/^(?:die\s+ersten\s+)?(\d{1,3})\s*fibonacci(?:[-\s]?zahlen)?$/i)) || (m = s.match(/^fibonacci(?:[-\s]?(?:zahlen|folge|reihe))?\s*(?:bis|die\s+ersten|:)?\s*(\d{1,3})?$/i))) {
      const count = Math.min(Math.max(Number(m[1] || 20), 1), 300);
      const list = fibonacci(count);
      return { text: `**Die ersten ${count} Fibonacci-Zahlen:**\n\n${list.map((v) => big(v)).join(', ')}\n\n- F(${count}) = ${big(list[count - 1])}${count > 2 ? ` · Verhältnis der letzten beiden ≈ ${fmtN(Number(list[count - 1]) / Number(list[count - 2]), 6)} (→ goldener Schnitt 1,618034)` : ''}\n\n_Jede Zahl ist die Summe der beiden vorherigen: 0, 1, 1, 2, 3, 5, …_`, source: 'numtheory', val: Number(list[count - 1]) };
    }
    if ((m = s.match(/^(?:binomialkoeffizient\s*|binom\s*)?\(?\s*(\d{1,4})\s*(?:über|ueber|choose|nCr|ncr)\s*(\d{1,4})\s*\)?\s*\??$/i))
      || (m = reorder(s.match(/^(?:wie\s*viele\s+)?(?:möglichkeiten|moeglichkeiten|kombinationen|kombis|lottokombinationen|tipps)\s*(?:gibt\s+es\s+)?(?:bei|für|fuer|beim\s+lotto|im\s+lotto)?\s*(\d{1,4})\s+aus\s+(\d{1,4})\s*\??$/i), 0, 2, 1))
      || (m = reorder(s.match(/^(?:lotto|lottozahlen)\s+(\d{1,4})\s+aus\s+(\d{1,4})$/i), 0, 2, 1))) {
      const n = Number(m[1]);
      const k = Number(m[2]);
      if (n > 1000) return { text: 'Bitte n ≤ 1000.', source: 'numtheory' };
      const c = binomial(n, k);
      const ordered = k <= n ? factorial(n) / factorial(n - k) : 0n;
      return {
        text: `**${fmtN(n)} über ${fmtN(k)} = ${big(c)}**\n\n- Kombinationen (Reihenfolge egal, ohne Zurücklegen): ${big(c)}${k <= n && c > 0n ? ` → Chance 1 : ${big(c)}` : ''}\n- Variationen (Reihenfolge wichtig, ohne Zurücklegen): ${big(ordered)}\n- Mit Zurücklegen: ${big(binomial(n + k - 1, k))} Kombinationen · ${big(BigInt(n) ** BigInt(k))} Variationen\n\n_Formel: n! ÷ (k! · (n−k)!)${n === 49 && k === 6 ? ' – Lotto „6 aus 49“: 1 : 13.983.816 für sechs Richtige, mit Superzahl 1 : 139.838.160.' : ''}_`,
        source: 'numtheory',
        val: Number(c),
      };
    }
    if ((m = s.match(/^(?:wie\s*viele\s+)?(?:permutationen|anordnungen|reihenfolgen)\s*(?:von|für|fuer|bei|gibt\s+es\s+(?:für|bei))?\s*(\d{1,3})\s*(?:elementen?|dingen|personen|objekten|buchstaben|zahlen)?\s*\??$/i))) {
      const n = Number(m[1]);
      if (n > 170) return { text: 'Bitte n ≤ 170.', source: 'numtheory' };
      return { text: `**${fmtN(n)}! = ${big(factorial(n))} Anordnungen** von ${fmtN(n)} verschiedenen Elementen.${n >= 5 ? `\n\n_Bei ${fmtN(n)} Personen am runden Tisch (Drehungen gleich): (n−1)! = ${big(factorial(n - 1))}._` : ''}`, source: 'numtheory', val: Number(factorial(n)) };
    }
    if ((m = s.match(/^collatz(?:[-\s]?(?:folge|problem|vermutung|zahl))?\s*(?:von|für|fuer|:)?\s*(\d{1,12})$/i))) {
      const n = Number(m[1]);
      if (n < 1) return null;
      const { steps, peak, sequence } = collatz(n);
      return { text: `**Collatz-Folge von ${fmtN(n)}: ${steps} Schritte bis zur 1**, höchster Wert ${fmtN(peak)}.\n\n${sequence.length > 40 ? `${sequence.slice(0, 25).map((v) => fmtN(v)).join(' → ')} → … → ${sequence.slice(-8).map((v) => fmtN(v)).join(' → ')}` : sequence.map((v) => fmtN(v)).join(' → ')}\n\n_Regel: gerade → halbieren, ungerade → ×3 + 1. Dass jede Startzahl bei 1 landet, ist bis heute unbewiesen._`, source: 'numtheory', val: steps };
    }
    if ((m = s.match(/^(?:die\s+)?(?:quersumme|ziffernsumme)\s*(?:von|der\s+zahl|:)?\s*(\d{1,40})$/i))) {
      const digits = m[1].split('').map(Number);
      const sum = digits.reduce((a, b) => a + b, 0);
      let iterated = sum;
      const chain = [sum];
      while (iterated >= 10) { iterated = String(iterated).split('').reduce((a, b) => a + Number(b), 0); chain.push(iterated); }
      const alternating = digits.reverse().reduce((acc, d, i) => acc + (i % 2 === 0 ? d : -d), 0);
      return { text: `**Quersumme von ${m[1]} = ${fmtN(sum)}** (${digits.reverse().join(' + ')})\n\n- Einstellige Quersumme: ${chain.join(' → ')}\n- Alternierende Quersumme: ${fmtN(alternating)} → ${alternating % 11 === 0 ? 'durch 11 teilbar' : 'nicht durch 11 teilbar'}\n- Teilbar durch 3: ${sum % 3 === 0 ? 'ja' : 'nein'} · durch 9: ${sum % 9 === 0 ? 'ja' : 'nein'}`, source: 'numtheory', val: sum };
    }
    if ((m = s.match(/^(?:ist\s+)?(\d{1,15})\s+(?:eine\s+)?(?:durch\s+)?(\d{1,9})\s*(?:teilbar|ohne\s+rest\s+teilbar)\s*\??$/i)) || (m = s.match(/^(?:ist\s+)?(\d{1,15})\s+(?:durch\s+)(\d{1,9})\s+teilbar\??$/i))) {
      const n = Number(m[1]);
      const d = Number(m[2]);
      if (!d) return null;
      const rest = n % d;
      return { text: rest === 0 ? `**Ja**, ${fmtN(n)} ist durch ${fmtN(d)} teilbar: ${fmtN(n)} ÷ ${fmtN(d)} = ${fmtN(n / d)}.` : `**Nein**, ${fmtN(n)} ÷ ${fmtN(d)} = ${fmtN(Math.floor(n / d))} Rest ${fmtN(rest)}. Nächste teilbare Zahlen: ${fmtN(n - rest)} und ${fmtN(n - rest + d)}.`, source: 'numtheory', val: rest };
    }
    return null;
  },
};
