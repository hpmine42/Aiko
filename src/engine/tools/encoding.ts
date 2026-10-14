import type { Tool, ToolResult } from './types';
import { fence, fmtN } from './shared';

/* ---------------- SHA-256 (FIPS 180-4), synchronous and dependency-free ---------------- */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

export function sha256(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(padded.length - 4, bitLength >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return Array.from(h, (v) => v.toString(16).padStart(8, '0')).join('');
}

/* ---------------- Base64 / URL encoding (UTF-8 aware) ---------------- */

export function base64Encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

export function base64Decode(text: string): string {
  const cleaned = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) throw new Error('Das ist kein gültiges Base64 (erlaubt sind A–Z, a–z, 0–9, +, / und = am Ende).');
  const padded = cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

const MAX_INPUT = 5_000;

function tooLong(): ToolResult {
  return { text: `Bitte höchstens ${fmtN(MAX_INPUT)} Zeichen auf einmal.`, source: 'encode' };
}

export const encodingTool: Tool = {
  id: 'encode',
  label: 'Base64, URL & SHA-256',
  help: '- **Codieren & Hash:** „Base64: Hallo Welt“, „Base64 dekodieren: SGFsbG8=“, „URL-encode: a b&c“, „SHA-256 von Hallo“',
  run(input) {
    const s = String(input || '').trim();
    let m: RegExpMatchArray | null;
    if ((m = s.match(/^(?:base\s?64\s+(?:dekodieren|decodieren|decode|entschlüsseln|entschluesseln|zurück|zurueck)|(?:dekodiere|decodiere|decode|entschlüssele|entschluessele)\s+(?:das\s+|den\s+)?base\s?64|aus\s+base\s?64|von\s+base\s?64)\s*[:\n]\s*([\s\S]+)$/i))
      || (m = s.match(/^([A-Za-z0-9+/=_-]{4,})\s+(?:aus|von)\s+base\s?64(?:\s+dekodieren)?\s*[.!?]?$/i))) {
      if (m[1].length > MAX_INPUT * 2) return tooLong();
      try {
        const out = base64Decode(m[1]);
        return { text: `**Base64 dekodiert:**\n\n${fence(out)}`, source: 'encode' };
      } catch (error) {
        return { text: error instanceof Error && error.message.startsWith('Das ist') ? error.message : 'Das lässt sich nicht als Base64 mit UTF-8-Text dekodieren (ungültige Zeichen oder Binärdaten).', source: 'encode' };
      }
    }
    if ((m = s.match(/^(?:base\s?64(?:\s+(?:kodieren|codieren|encode|verschlüsseln|verschluesseln|von|für|fuer))?|(?:kodiere|codiere|encode|wandle)\s+(?:in|als|zu|nach)\s+base\s?64|in\s+base\s?64|als\s+base\s?64)\s*[:\n]\s*([\s\S]+)$/i))
      || (m = s.match(/^([\s\S]+?)\s+(?:in|als|zu|nach)\s+base\s?64(?:\s+(?:kodieren|codieren|umwandeln))?\s*[.!?]?$/i))) {
      if (m[1].length > MAX_INPUT) return tooLong();
      const out = base64Encode(m[1]);
      return { text: `**Base64:**\n\n${fence(out)}\n\n_${fmtN(new TextEncoder().encode(m[1]).length)} Bytes → ${fmtN(out.length)} Zeichen. Base64 ist eine Kodierung, keine Verschlüsselung._`, source: 'encode' };
    }
    if ((m = s.match(/^(?:url[\s-]?(?:dekodieren|decodieren|decode|entschlüsseln)|(?:dekodiere|decodiere|decode)\s+(?:die\s+)?url|prozentkodierung\s+(?:auflösen|aufloesen|dekodieren)|urldecode)\s*[:\n]\s*([\s\S]+)$/i))) {
      try {
        return { text: `**URL dekodiert:**\n\n${fence(decodeURIComponent(m[1].trim().replace(/\+/g, '%20')))}`, source: 'encode' };
      } catch {
        return { text: 'Das ist keine gültige Prozentkodierung (z. B. unvollständige %-Sequenz).', source: 'encode' };
      }
    }
    if ((m = s.match(/^(?:url[\s-]?(?:kodieren|codieren|encode|encoden)|(?:kodiere|codiere|encode)\s+(?:als|für|fuer|die)\s+url|prozentkodierung|urlencode|url)\s*[:\n]\s*([\s\S]+)$/i))) {
      if (m[1].length > MAX_INPUT) return tooLong();
      const text = m[1].trim();
      return { text: `**URL-kodiert (encodeURIComponent):**\n\n${fence(encodeURIComponent(text))}${/^https?:\/\//i.test(text) ? `\n\nNur Sonderzeichen innerhalb einer Adresse (encodeURI):\n\n${fence(encodeURI(text))}` : ''}`, source: 'encode' };
    }
    if ((m = s.match(/^(?:(sha[\s-]?256|sha[\s-]?2|hash|hashwert|prüfsumme|pruefsumme|checksumme|md5|sha[\s-]?1)\s*(?:wert)?\s*(?:von|für|fuer|berechnen|erzeugen)?\s*[:\n]\s*([\s\S]+)|(sha[\s-]?256|sha[\s-]?2|hash|hashwert|prüfsumme|pruefsumme|md5|sha[\s-]?1)\s+(?:von|für|fuer)\s+([\s\S]+))$/i))) {
      const algo = (m[1] || m[3]).toLowerCase().replace(/[\s-]/g, '');
      const text = (m[2] || m[4]).trim();
      if (text.length > MAX_INPUT) return tooLong();
      const hash = sha256(text);
      const note = algo === 'md5' || algo === 'sha1'
        ? `\n\n_${algo.toUpperCase()} ist eingebaut nicht verfügbar – und als Prüfsumme veraltet. Oben steht stattdessen SHA-256._`
        : '';
      return { text: `**SHA-256** von „${text.length > 60 ? `${text.slice(0, 57)}…` : text}“ (${fmtN(new TextEncoder().encode(text).length)} Bytes, UTF-8):\n\n${fence(hash)}${note}`, source: 'encode' };
    }
    return null;
  },
};
