import type { Tool } from './types';
import { clean, fmtN } from './shared';

/* WCAG contrast checker, colour mixing/lightening and palette helpers – works with hex, rgb() and German colour names. */

const NAMES: Record<string, string> = {
  schwarz: '000000', weiß: 'ffffff', weiss: 'ffffff', rot: 'ff0000', grün: '008000', gruen: '008000', blau: '0000ff', gelb: 'ffff00', orange: 'ffa500', lila: '800080', violett: '8a2be2', rosa: 'ffc0cb', pink: 'ff69b4', braun: '8b4513', grau: '808080', hellgrau: 'd3d3d3', dunkelgrau: '404040', türkis: '40e0d0', tuerkis: '40e0d0', cyan: '00ffff', magenta: 'ff00ff', navy: '000080', dunkelblau: '00008b', hellblau: 'add8e6', dunkelgrün: '006400', dunkelgruen: '006400', hellgrün: '90ee90', hellgruen: '90ee90', olive: '808000', gold: 'ffd700', silber: 'c0c0c0', beige: 'f5f5dc', creme: 'fffdd0', bordeaux: '800020', mint: '98ff98', lachs: 'fa8072', koralle: 'ff7f50', indigo: '4b0082', khaki: 'f0e68c', petrol: '006d77', anthrazit: '293133',
};

export type RGB = [number, number, number];

export function parseColor(raw: string): RGB | null {
  const s = raw.trim().toLowerCase().replace(/^#/, '');
  if (/^[0-9a-f]{6}$/.test(s)) return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  if (/^[0-9a-f]{3}$/.test(s)) return [parseInt(s[0] + s[0], 16), parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16)];
  const rgb = s.match(/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map((v) => Math.min(255, v)) as RGB;
  if (NAMES[s]) return parseColor(NAMES[s]);
  return null;
}

export const toHex = ([r, g, b]: RGB): string => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

export function luminance([r, g, b]: RGB): number {
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const COLOR = '(#?[0-9a-f]{6}|#?[0-9a-f]{3}|rgba?\\([^)]*\\)|[a-zäöüß]+)';

function ratingLines(ratio: number): string[] {
  const check = (min: number) => (ratio >= min ? '✅' : '❌');
  return [
    `- Normaler Text (AA, ≥ 4,5:1): ${check(4.5)} · AAA (≥ 7:1): ${check(7)}`,
    `- Großer Text ab 18 pt / 14 pt fett (AA, ≥ 3:1): ${check(3)} · AAA (≥ 4,5:1): ${check(4.5)}`,
    `- Grafiken & Bedienelemente (≥ 3:1): ${check(3)}`,
  ];
}

export const contrastTool: Tool = {
  id: 'contrast',
  label: 'Kontrast & Farben',
  help: '- **Kontrast:** „Kontrast #ffffff auf #336699“, „Kontrast weiß auf blau“, „Mische rot und blau“, „#336699 heller“, „Palette zu #336699“',
  run(input) {
    const s = clean(input);
    let m: RegExpMatchArray | null;
    if ((m = s.match(new RegExp(`^(?:kontrast(?:verhältnis|verhaeltnis|-?check|-?prüfung)?|wcag|lesbarkeit|barrierefrei(?:heit)?)\\s*(?:von|zwischen|prüfen|pruefen|:)?\\s*${COLOR}\\s*(?:auf|und|zu|vs\\.?|gegen|/|,|mit)\\s*${COLOR}\\s*\\??$`, 'i')))) {
      const fg = parseColor(m[1]);
      const bg = parseColor(m[2]);
      if (!fg || !bg) return { text: `Farben bitte als Hex (#336699), rgb(51, 102, 153) oder Name (${Object.keys(NAMES).slice(0, 8).join(', ')} …) angeben.`, source: 'contrast' };
      const ratio = contrastRatio(fg, bg);
      const verdict = ratio >= 7 ? 'ausgezeichnet' : ratio >= 4.5 ? 'gut lesbar' : ratio >= 3 ? 'nur für große Schrift' : 'zu schwach';
      let suggestion = '';
      if (ratio < 4.5) {
        const dark = luminance(bg) > luminance(fg);
        for (let t = 0.1; t <= 1; t += 0.1) {
          const candidate = mix(fg, dark ? [0, 0, 0] : [255, 255, 255], t);
          if (contrastRatio(candidate, bg) >= 4.5) { suggestion = `\n\nVorschlag: Text ${toHex(candidate)} auf ${toHex(bg)} erreicht ${fmtN(contrastRatio(candidate, bg), 2)}:1.`; break; }
        }
      }
      return {
        text: `**Kontrast ${toHex(fg)} auf ${toHex(bg)}: ${fmtN(ratio, 2)}:1 – ${verdict}**\n\n${ratingLines(ratio).join('\n')}${suggestion}\n\n_WCAG 2.x: relative Leuchtdichte (L₁ + 0,05) ÷ (L₂ + 0,05). Leuchtdichte Text ${fmtN(luminance(fg), 3)}, Hintergrund ${fmtN(luminance(bg), 3)}._`,
        source: 'contrast',
        widget: { type: 'color', hex: toHex(bg).slice(1).toLowerCase() },
        val: Math.round(ratio * 100) / 100,
      };
    }
    if ((m = s.match(new RegExp(`^(?:misch(?:e|en|ung)|mix)\\s*(?:von\\s+)?${COLOR}\\s*(?:und|mit|\\+|,)\\s*${COLOR}(?:\\s*(?:zu|im\\s+verhältnis|im\\s+verhaeltnis|:)?\\s*(\\d{1,3})\\s*(?:%|:|zu)\\s*(\\d{1,3})?\\s*%?)?\\s*$`, 'i')))) {
      const a = parseColor(m[1]);
      const b = parseColor(m[2]);
      if (!a || !b) return null;
      let t = 0.5;
      if (m[3]) { const x = Number(m[3]); const y = m[4] != null ? Number(m[4]) : 100 - x; t = y / (x + y); }
      const result = mix(a, b, t);
      const steps = [0, 0.25, 0.5, 0.75, 1].map((p) => toHex(mix(a, b, p)));
      return { text: `**${toHex(a)} + ${toHex(b)} = ${toHex(result)}** (${fmtN((1 - t) * 100, 0)} % : ${fmtN(t * 100, 0)} %)\n\n- Verlauf: ${steps.join(' → ')}\n- rgb(${result.map((v) => Math.round(v)).join(', ')})\n\n_Additive Mischung im RGB-Raum – Pigmente (Farbkasten) mischen sich anders._`, source: 'contrast', widget: { type: 'color', hex: toHex(result).slice(1).toLowerCase() } };
    }
    if ((m = s.match(new RegExp(`^${COLOR}\\s+(?:um\\s+)?(\\d{1,3})?\\s*%?\\s*(heller|dunkler|aufhellen|abdunkeln)\\s*$`, 'i'))) || (m = s.match(new RegExp(`^(?:mach(?:e)?\\s+)?${COLOR}\\s+(\\d{1,3})?\\s*%?\\s*(heller|dunkler)$`, 'i')))) {
      const base = parseColor(m[1]);
      if (!base) return null;
      const amount = (m[2] ? Number(m[2]) : 20) / 100;
      const lighter = /hell|aufhell/i.test(m[3]);
      const result = mix(base, lighter ? [255, 255, 255] : [0, 0, 0], Math.min(1, amount));
      const scale = [10, 20, 30, 40, 50].map((p) => `${p} %: ${toHex(mix(base, lighter ? [255, 255, 255] : [0, 0, 0], p / 100))}`);
      return { text: `**${toHex(base)} um ${fmtN(amount * 100, 0)} % ${lighter ? 'heller' : 'dunkler'}: ${toHex(result)}**\n\n- Stufen: ${scale.join(' · ')}\n- Kontrast zum Original: ${fmtN(contrastRatio(base, result), 2)}:1`, source: 'contrast', widget: { type: 'color', hex: toHex(result).slice(1).toLowerCase() } };
    }
    if ((m = s.match(new RegExp(`^(?:palette|farbpalette|farbschema|passende\\s+farben|komplementärfarbe|komplementaerfarbe|komplement)\\s*(?:zu|für|fuer|von|aus|:)?\\s*${COLOR}\\s*$`, 'i')))) {
      const base = parseColor(m[1]);
      if (!base) return null;
      const [r, g, b] = base.map((v) => v / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const d = max - min;
      const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      let h = 0;
      if (d) { h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
      const hslToRgb = (hh: number, ss: number, ll: number): RGB => {
        const c = (1 - Math.abs(2 * ll - 1)) * ss;
        const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
        const mm = ll - c / 2;
        const [r1, g1, b1] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
        return [(r1 + mm) * 255, (g1 + mm) * 255, (b1 + mm) * 255];
      };
      const rot = (deg: number) => toHex(hslToRgb((h + deg + 360) % 360, sat, l));
      const onWhite = contrastRatio(base, [255, 255, 255]);
      const onBlack = contrastRatio(base, [0, 0, 0]);
      return {
        text: `**Palette zu ${toHex(base)}** (HSL ${Math.round(h)}°, ${Math.round(sat * 100)} %, ${Math.round(l * 100)} %)\n\n- Komplementär: ${rot(180)}\n- Analog: ${rot(-30)} · ${rot(30)}\n- Triade: ${rot(120)} · ${rot(240)}\n- Split-Komplementär: ${rot(150)} · ${rot(210)}\n- Heller/dunkler: ${toHex(mix(base, [255, 255, 255], 0.3))} · ${toHex(mix(base, [0, 0, 0], 0.3))}\n- Text darauf: ${onWhite >= onBlack ? 'weiß' : 'schwarz'} (${fmtN(Math.max(onWhite, onBlack), 2)}:1)`,
        source: 'contrast',
        widget: { type: 'color', hex: toHex(base).slice(1).toLowerCase() },
      };
    }
    return null;
  },
};
