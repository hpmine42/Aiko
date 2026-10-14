import type { Tool, ToolResult } from './types';
import { clean, fmtN } from './shared';

/* Exact rational arithmetic with BigInt – no floating point until the very end. */

export interface Fraction { n: bigint; d: bigint }

const abs = (v: bigint): bigint => (v < 0n ? -v : v);
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a); b = abs(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}
const lcm = (a: bigint, b: bigint): bigint => abs(a * b) / gcd(a, b);

export function frac(n: bigint, d = 1n): Fraction {
  if (d === 0n) throw new Error('Division durch null ist nicht definiert.');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
}
export const add = (a: Fraction, b: Fraction): Fraction => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Fraction, b: Fraction): Fraction => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Fraction, b: Fraction): Fraction => frac(a.n * b.n, a.d * b.d);
export function div(a: Fraction, b: Fraction): Fraction {
  if (b.n === 0n) throw new Error('Division durch null ist nicht definiert.');
  return frac(a.n * b.d, a.d * b.n);
}

export function fromDecimal(text: string): Fraction {
  const s = text.replace(',', '.');
  const [whole, dec = ''] = s.split('.');
  const digits = dec.length;
  const n = BigInt((whole || '0') + dec);
  return frac(n, 10n ** BigInt(digits));
}

export const toNumber = (f: Fraction): number => Number(f.n) / Number(f.d);
export const show = (f: Fraction): string => (f.d === 1n ? String(f.n) : `${f.n}/${f.d}`);

export function mixed(f: Fraction): string | null {
  if (f.d === 1n || abs(f.n) < f.d) return null;
  const whole = f.n / f.d;
  const rest = abs(f.n % f.d);
  return `${whole} ${rest}/${f.d}`;
}

/** Best fraction with denominator ≤ maxDen (continued fractions). */
export function approximate(value: number, maxDen = 100): Fraction {
  let h1 = 1n; let h0 = 0n; let k1 = 0n; let k0 = 1n;
  let x = value;
  for (let i = 0; i < 64; i += 1) {
    const a = BigInt(Math.floor(x));
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > BigInt(maxDen)) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    const rest = x - Math.floor(x);
    if (rest < 1e-12) break;
    x = 1 / rest;
  }
  return frac(h1, k1);
}

/* ---------------- Parser ---------------- */

type Token = { kind: 'num'; value: Fraction; literal?: boolean } | { kind: 'op'; value: string };

/**
 * „1/2“ written with a slash is one fraction literal, so „1/2 : 1/4“ means (1/2) ÷ (1/4).
 * „:“ and „÷“ are always division operators.
 */
function tokenize(src: string): Token[] {
  const s = src.replace(/×|·|\*\*/g, '*').replace(/÷|:/g, '÷').replace(/−|–/g, '-').replace(/\s+/g, ' ');
  const tokens: Token[] = [];
  const re = /\s*(?:(\d+)\s*\/\s*(\d+)|(\d+(?:[.,]\d+)?)\s*%|(\d+(?:[.,]\d+)?)|([-+*/÷()]))/y;
  let pos = 0;
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) {
      if (/^\s*$/.test(s.slice(pos))) break;
      throw new Error(`Das Zeichen „${s.slice(pos).trim().charAt(0)}“ verstehe ich in einem Bruchterm nicht.`);
    }
    pos = re.lastIndex;
    if (m[1]) tokens.push({ kind: 'num', value: frac(BigInt(m[1]), BigInt(m[2])), literal: true });
    else if (m[3]) tokens.push({ kind: 'num', value: div(fromDecimal(m[3]), frac(100n)) });
    else if (m[4]) tokens.push({ kind: 'num', value: fromDecimal(m[4]) });
    else tokens.push({ kind: 'op', value: m[5] === '÷' ? '/' : m[5] });
  }
  return tokens;
}

/** Evaluates integers, decimals, percentages, mixed numbers („1 1/2“) and + − × ÷ ( ). */
export function evaluate(src: string): Fraction {
  const t = tokenize(src);
  let i = 0;
  const peek = (): string | null => (t[i] && t[i].kind === 'op' ? (t[i] as { value: string }).value : null);
  const eat = (op: string): boolean => { if (peek() === op) { i += 1; return true; } return false; };
  function atom(): Fraction {
    if (eat('(')) {
      const v = expression();
      if (!eat(')')) throw new Error('Eine Klammer wurde nicht geschlossen.');
      return v;
    }
    if (eat('-')) return mul(atom(), frac(-1n));
    if (eat('+')) return atom();
    const tok = t[i];
    if (!tok || tok.kind !== 'num') throw new Error('Hier fehlt eine Zahl.');
    i += 1;
    // Mixed number: an integer directly followed by a fraction literal („1 1/2“)
    const next = t[i];
    if (!tok.literal && tok.value.d === 1n && next && next.kind === 'num' && next.literal) {
      i += 1;
      return tok.value.n < 0n ? sub(tok.value, next.value) : add(tok.value, next.value);
    }
    return tok.value;
  }
  function term(): Fraction {
    let v = atom();
    for (;;) {
      if (eat('*')) v = mul(v, atom());
      else if (eat('/')) v = div(v, atom());
      else return v;
    }
  }
  function expression(): Fraction {
    let v = term();
    for (;;) {
      if (eat('+')) v = add(v, term());
      else if (eat('-')) v = sub(v, term());
      else return v;
    }
  }
  if (!t.length) throw new Error('Der Term ist leer.');
  const result = expression();
  if (i < t.length) throw new Error('Den Term konnte ich nicht vollständig lesen.');
  return result;
}

/* ---------------- Explanation for the simple a ∘ b case ---------------- */

function steps(src: string): string | null {
  const m = src.trim().replace(/×|·/g, '*').replace(/÷|:/g, '/').replace(/−|–/g, '-').match(/^(\d+)\s*\/\s*(\d+)\s*([-+*/])\s*(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  const a = frac(BigInt(m[1]), BigInt(m[2]));
  const b = frac(BigInt(m[4]), BigInt(m[5]));
  const op = m[3];
  if (op === '+' || op === '-') {
    const common = lcm(BigInt(m[2]), BigInt(m[5]));
    const an = BigInt(m[1]) * (common / BigInt(m[2]));
    const bn = BigInt(m[4]) * (common / BigInt(m[5]));
    const raw = op === '+' ? an + bn : an - bn;
    const reduced = frac(raw, common);
    return `Hauptnenner kgV(${m[2]}, ${m[5]}) = ${common}: ${an}/${common} ${op} ${bn}/${common} = ${raw}/${common}${show(reduced) !== `${raw}/${common}` ? ` = ${show(reduced)} (gekürzt)` : ''}`;
  }
  if (op === '*') {
    const raw = `${BigInt(m[1]) * BigInt(m[4])}/${BigInt(m[2]) * BigInt(m[5])}`;
    const reduced = mul(a, b);
    return `Zähler mal Zähler, Nenner mal Nenner: (${m[1]}·${m[4]})/(${m[2]}·${m[5]}) = ${raw}${show(reduced) !== raw ? ` = ${show(reduced)} (gekürzt)` : ''}`;
  }
  const raw = `${BigInt(m[1]) * BigInt(m[5])}/${BigInt(m[2]) * BigInt(m[4])}`;
  const reduced = div(a, b);
  return `Mit dem Kehrwert multiplizieren: ${m[1]}/${m[2]} · ${m[5]}/${m[4]} = ${raw}${show(reduced) !== raw ? ` = ${show(reduced)} (gekürzt)` : ''}`;
}

function answer(expr: string, result: Fraction, extra?: string): ToolResult {
  const value = toNumber(result);
  const lines = [`**${expr.trim()} = ${show(result)}**`];
  const asMixed = mixed(result);
  if (asMixed) lines.push(`Als gemischte Zahl: ${asMixed}`);
  if (result.d !== 1n) lines.push(`Als Dezimalzahl: ≈ ${fmtN(value, 6)}`);
  if (extra) lines.push(extra);
  return { text: lines.join('\n\n'), source: 'fraction', val: value };
}

const FRACTION = /\d+\s*\/\s*\d+/;
const IMPLICIT_CHARS = /^[\d\s+\-*/:×÷·()−–]+$/;

export const fractionTool: Tool = {
  id: 'fraction',
  label: 'Bruchrechnung',
  help: '- **Brüche (exakt):** `1/3 + 1/4`, `2/3 · 3/4`, „kürze 12/18“, „0,75 als Bruch“',
  run(input) {
    let s = clean(input).replace(/\s*=\s*$/, '');
    s = s.replace(/^(?:was\s+(?:ist|ergibt)|wie\s*viel\s+(?:ist|ergibt)|berechne(?:\s+mir)?|rechne(?:\s+mir)?(?:\s+aus)?|bitte)\s+/i, '');
    let m: RegExpMatchArray | null;
    try {
      if ((m = s.match(/^(?:kürze|kuerze|vereinfache)\s*(?:den\s+bruch|bruch)?\s*:?\s*(\d+)\s*\/\s*(\d+)$/i))
        || (m = s.match(/^(?:bruch\s+)?(\d+)\s*\/\s*(\d+)\s+(?:kürzen|kuerzen|vereinfachen|gekürzt)$/i))) {
        const n = BigInt(m[1]); const d = BigInt(m[2]);
        const reduced = frac(n, d);
        const g = gcd(n, d);
        const extra = g === 1n ? `${m[1]}/${m[2]} ist bereits vollständig gekürzt (ggT = 1).` : `Gekürzt mit dem ggT ${g}: ${m[1]} ÷ ${g} = ${reduced.n}, ${m[2]} ÷ ${g} = ${reduced.d}.`;
        return answer(`${m[1]}/${m[2]}`, reduced, extra);
      }
      let expr: string | null = null;
      if ((m = s.match(/^(?:bruch(?:rechnung)?|als\s+bruch|brüche?|brueche?)\s*:\s*(.+)$/i))) expr = m[1];
      else if ((m = s.match(/^(.+?)\s+(?:als|in)\s+(?:einen\s+|ein\s+)?bruch(?:\s+(?:umwandeln|schreiben|darstellen))?$/i))) expr = m[1];
      if (expr != null) {
        const result = evaluate(expr);
        const decimal = /^[+-]?\d+[.,]\d+$/.test(expr.trim()) || /%\s*$/.test(expr.trim());
        let extra: string | undefined = steps(expr) ?? undefined;
        if (decimal && result.d > 100n) {
          const near = approximate(toNumber(result));
          extra = `Exakt ist das ${show(result)}; die einfachste Näherung mit Nenner ≤ 100 ist **${show(near)}** (≈ ${fmtN(toNumber(near), 6)}).`;
        }
        return answer(expr, result, extra);
      }
      // Implicit: an arithmetic term made of integers and at least one fraction combined with another operation.
      if (!IMPLICIT_CHARS.test(s) || !FRACTION.test(s)) return null;
      const stripped = s.replace(/\s+/g, '');
      const fractions = stripped.match(/\d+\/\d+/g) || [];
      const operators = stripped.replace(/\d+\/\d+/g, '#').replace(/[^+\-*×·:÷/]/g, '').length;
      if (fractions.length < 2 && operators === 0) return null;
      if (!/\d/.test(stripped) || /^[-+]?\d+$/.test(stripped)) return null;
      return answer(s, evaluate(s), steps(s) ?? undefined);
    } catch (error) {
      if (expr(s)) return { text: error instanceof Error ? error.message : 'Diesen Bruchterm konnte ich nicht auswerten.', source: 'fraction' };
      return null;
    }
  },
};

/** Explicit fraction requests should surface parser errors instead of falling through. */
function expr(s: string): boolean {
  return /^(?:bruch|kürze|kuerze|vereinfache)/i.test(s) || /\bbruch\b/i.test(s);
}
