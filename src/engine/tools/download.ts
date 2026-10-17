import type { Tool } from './types';
import { NUM, clean, fmtN, toNum } from './shared';

/* Download-Zeit und Datenvolumen – komplett offline.
   Größen sind SI-basiert wie beim Einheiten-Werkzeug: 1 GB = 1.000 MB (Angaben der Anbieter). */

const KEY = /\b(?:download(?:s|zeit|dauer|en)?|ladedauer|datenvolumen|bandbreite|internetgeschwindigkeit|mbit|gbit|kbit|mbps|gbps|kbps)\b/i;

/** Zahl + Einheit; Gruppe 2 = optionales „/s“. Bit-Einheiten und „…/s“ sind Geschwindigkeiten. */
const TOKEN_RE = new RegExp(NUM + '\\s*(tib|gib|mib|kib|gbps|mbps|kbps|gbit|mbit|kbit|tb|gb|mb|kb|b|terabytes?|gigabytes?|megabytes?|kilobytes?|bytes?|gbyte|mbyte|kbyte)(\\s*(?:/|pro)\\s*s)?\\b', 'gi');
const BIT_FACTOR: Record<string, number> = { gbps: 1e9, gbit: 1e9, mbps: 1e6, mbit: 1e6, kbps: 1e3, kbit: 1e3, bit: 1 };
const BYTE_FACTOR: Record<string, number> = { tib: 1024 ** 4, gib: 1024 ** 3, mib: 1024 ** 2, kib: 1024, tb: 1e12, gb: 1e9, mb: 1e6, kb: 1e3, b: 1 };
const BYTE_ALIASES: Array<[RegExp, string]> = [
  [/^terabytes?$/, 'tb'], [/^gigabytes?|gbyte$/, 'gb'], [/^megabytes?|mbyte$/, 'mb'],
  [/^kilobytes?|kbyte$/, 'kb'], [/^bytes?$/, 'b'],
];
const DURATION_RE = new RegExp('(?:^|\\s)' + NUM + '\\s*(stunden?|std\\.?|h|min(?:uten)?|m|sek(?:unden)?|s)(?:\\s|\\b)', 'i');

function byteUnitKey(unit: string): string {
  const key = unit.toLowerCase();
  return BYTE_FACTOR[key] != null ? key : (BYTE_ALIASES.find(([re]) => re.test(key))?.[1] ?? '');
}

/** Klassifiziert alle Zahl+Einheit-Treffer: `/s`-Suffix und Bit-Einheiten sind Bandbreiten. */
function parseTokens(text: string): { sizeBytes: number | null; bitsPerSecond: number | null } {
  let sizeBytes: number | null = null;
  let bitsPerSecond: number | null = null;
  const before = (index: number) => text.slice(Math.max(0, index - 14), index);
  for (const m of text.matchAll(TOKEN_RE)) {
    const value = toNum(m[1]);
    if (!(value > 0)) continue;
    const unit = m[2].toLowerCase();
    const perSecond = Boolean(m[3]);
    const bitKey = BIT_FACTOR[unit] != null ? unit : '';
    const byteKey = byteUnitKey(unit);
    if (bitKey) bitsPerSecond = value * BIT_FACTOR[bitKey];            // „50 Mbit“ = 50 Mbit/s
    else if (perSecond) bitsPerSecond = value * BYTE_FACTOR[byteKey] * 8; // „10 MB/s“
    else if (/\b(?:bei|mit|ueber|über)\s*$/i.test(before(m.index || 0))) bitsPerSecond = value * BYTE_FACTOR[byteKey] * 8; // „bei 10 MB“ ohne /s
    else if (sizeBytes == null) sizeBytes = value * BYTE_FACTOR[byteKey];
  }
  return { sizeBytes, bitsPerSecond };
}

function parseDurationSeconds(text: string): number | null {
  const m = text.match(DURATION_RE);
  if (!m) return null;
  const value = toNum(m[1]);
  if (!(value > 0)) return null;
  const unit = m[2].toLowerCase();
  if (/^(stunde|std|h)/.test(unit)) return value * 3600;
  if (/^(min|m)/.test(unit)) return value * 60;
  return value;
}

/** „752“ → „12 min 32 s“; „4.980“ → „1 h 23 min“; „7.200“ → „2 h“. */
function fmtSeconds(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h) {
    if (!min && !sec) return `${h} h`;
    if (!sec) return `${h} h ${String(min).padStart(2, '0')} min`;
    return `${h} h ${String(min).padStart(2, '0')} min ${String(sec).padStart(2, '0')} s`;
  }
  return sec ? `${min} min ${String(sec).padStart(2, '0')} s` : `${min} min`;
}

function fmtRate(bitsPerSecond: number): string {
  const units: Array<[number, string]> = [[1e9, 'Gbit/s'], [1e6, 'Mbit/s'], [1e3, 'kbit/s']];
  for (const [factor, name] of units) if (bitsPerSecond >= factor) return `${fmtN(bitsPerSecond / factor, bitsPerSecond / factor >= 100 ? 0 : 1)} ${name}`;
  return `${fmtN(bitsPerSecond, 0)} bit/s`;
}

function fmtVolume(bytes: number): string {
  const units: Array<[number, string]> = [[1e12, 'TB'], [1e9, 'GB'], [1e6, 'MB'], [1e3, 'KB']];
  for (const [factor, name] of units) if (bytes >= factor) return `${fmtN(bytes / factor, bytes / factor >= 100 ? 0 : 1)} ${name}`;
  return `${fmtN(bytes, 0)} Byte`;
}

const fmtBits = (bits: number): string => fmtRate(bits).replace('/s', '');

export const downloadTool: Tool = {
  id: 'download',
  label: 'Download-Zeit & Datenvolumen',
  help: '- **Download & Volumen:** „Wie lange dauert 4,7 GB bei 50 Mbit/s?“, „Wie viel Datenvolumen bei 10 Mbit/s in 2 Stunden?“',
  run(input) {
    const s = clean(input).replace(/\s+/g, ' ');
    if (!KEY.test(s)) return null;
    const { sizeBytes, bitsPerSecond } = parseTokens(s);
    const seconds = parseDurationSeconds(s);
    const wantsVolume = /datenvolumen|wie\s+viel\s+volumen/i.test(s);

    // Richtung 2: Bandbreite × Dauer → Datenvolumen
    if (bitsPerSecond && seconds && (wantsVolume || !sizeBytes)) {
      const bits = bitsPerSecond * seconds;
      return {
        text: `**≈ ${fmtVolume(bits / 8)}** Datenvolumen bei ${fmtRate(bitsPerSecond)} in ${fmtSeconds(seconds)}\n\n- ${fmtBits(bitsPerSecond)} ÷ s × ${fmtN(seconds)} s = ${fmtBits(bits)} = ${fmtVolume(bits / 8)}\n- Pro Stunde: ${fmtVolume(bitsPerSecond * 3600 / 8)} · pro Minute: ${fmtVolume(bitsPerSecond * 60 / 8)}\n\n_Tipp: „Wie lange dauert 2 GB bei 50 Mbit/s?“ rechnet die andere Richtung._`,
        source: 'download',
        val: Math.round(bits / 8 / 1e9 * 100) / 100,
      };
    }

    // Richtung 1: Datenmenge ÷ Bandbreite → Dauer
    if (sizeBytes && bitsPerSecond) {
      const ideal = sizeBytes * 8 / bitsPerSecond;
      if (ideal > 0 && Number.isFinite(ideal)) {
        return {
          text: `**${fmtVolume(sizeBytes)} bei ${fmtRate(bitsPerSecond)}: rund ${fmtSeconds(ideal)}**\n\n- ${fmtVolume(sizeBytes)} = ${fmtBits(sizeBytes * 8)} ÷ ${fmtBits(bitsPerSecond)}/s = ${fmtN(ideal, 0)} s\n- Realistisch (≈ 90 % der Bandbreite kommen an): ${fmtSeconds(ideal / 0.9)}\n- Zum Vergleich: ${fmtRate(bitsPerSecond / 2)} → ${fmtSeconds(ideal * 2)} · ${fmtRate(bitsPerSecond * 2)} → ${fmtSeconds(ideal / 2)}\n\n_Rechnet mit 1 GB = 1.000 MB wie die Anbieter; Windows zeigt 1 GiB = 1.024 MiB an._`,
          source: 'download',
          val: Math.round(ideal),
        };
      }
    }

    // Richtung 3: Datenmenge ÷ Dauer → nötige Bandbreite
    if (sizeBytes && seconds && !wantsVolume) {
      const needed = sizeBytes * 8 / seconds;
      return {
        text: `**${fmtVolume(sizeBytes)} in ${fmtSeconds(seconds)} braucht ≈ ${fmtRate(needed)}**\n\n- ${fmtBits(sizeBytes * 8)} ÷ ${fmtN(seconds)} s = ${fmtRate(needed)}\n- Mit Reserve (× 1,2): ${fmtRate(needed * 1.2)}`,
        source: 'download',
        val: Math.round(needed / 1e6 * 100) / 100,
      };
    }

    return {
      text: 'Ich rechne Download-Zeiten und Datenvolumen komplett offline durch:\n\n- **„Wie lange dauert 4,7 GB bei 50 Mbit/s?“** – Dauer einer Übertragung\n- **„Wie viel Datenvolumen bei 10 Mbit/s in 2 Stunden?“** – Volumen aus Bandbreite und Zeit\n- **„Download 5 GB in 20 Minuten?“** – nötige Bandbreite\n\nGrößen gelten wie bei Anbietern: 1 GB = 1.000 MB.',
      source: 'download',
    };
  },
};
