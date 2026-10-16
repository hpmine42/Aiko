import type { Tool } from './types';
import { fence } from './shared';

/* Classic ciphers and spelling alphabets: Caesar/ROT13 (incl. cracking), Vigenère, Atbash, A1Z26, DIN 5009 & NATO spelling. */

const A = 'A'.charCodeAt(0);
const a = 'a'.charCodeAt(0);

export function caesar(text: string, shift: number): string {
  const k = ((shift % 26) + 26) % 26;
  return text.replace(/[a-z]/g, (ch) => String.fromCharCode(((ch.charCodeAt(0) - a + k) % 26) + a))
    .replace(/[A-Z]/g, (ch) => String.fromCharCode(((ch.charCodeAt(0) - A + k) % 26) + A));
}

export function vigenere(text: string, key: string, decrypt = false): string {
  const k = key.toUpperCase().replace(/[^A-Z]/g, '');
  if (!k) return text;
  let i = 0;
  return text.replace(/[A-Za-z]/g, (ch) => {
    const shift = k.charCodeAt(i++ % k.length) - A;
    return caesar(ch, decrypt ? -shift : shift);
  });
}

export const atbash = (text: string): string => text.replace(/[a-z]/g, (ch) => String.fromCharCode(a + 25 - (ch.charCodeAt(0) - a))).replace(/[A-Z]/g, (ch) => String.fromCharCode(A + 25 - (ch.charCodeAt(0) - A)));

/** German letter frequencies (percent) used to score Caesar candidates. */
const FREQ: Record<string, number> = { e: 17.4, n: 9.8, i: 7.6, s: 7.3, r: 7.0, a: 6.5, t: 6.2, d: 5.1, h: 4.8, u: 4.4, l: 3.4, c: 3.1, g: 3.0, m: 2.5, o: 2.5, b: 1.9, w: 1.9, f: 1.7, k: 1.2, z: 1.1, p: 0.8, v: 0.7, j: 0.3, y: 0.04, x: 0.03, q: 0.02 };

/** Mean log-likelihood of the letters under German unigram frequencies, plus a bonus for common German bigrams. */
export function scoreGerman(text: string): number {
  const letters = text.toLowerCase().replace(/[^a-z]/g, '');
  if (!letters) return 0;
  let logSum = 0;
  for (const ch of letters) logSum += Math.log((FREQ[ch] ?? 0) + 0.05);
  const bigrams = (letters.match(/en|er|ch|de|ei|nd|te|in|ie|ge|un|st/g) || []).length;
  return logSum / letters.length + (0.3 * bigrams) / letters.length;
}

export function crackCaesar(text: string): Array<{ shift: number; text: string; score: number }> {
  return Array.from({ length: 26 }, (_, shift) => ({ shift, text: caesar(text, -shift), score: scoreGerman(caesar(text, -shift)) }))
    .sort((x, y) => y.score - x.score);
}

const DIN: Record<string, string> = {
  A: 'Aachen', B: 'Berlin', C: 'Chemnitz', D: 'Düsseldorf', E: 'Essen', F: 'Frankfurt', G: 'Goslar', H: 'Hamburg', I: 'Ingelheim', J: 'Jena', K: 'Köln', L: 'Leipzig', M: 'München', N: 'Nürnberg', O: 'Offenbach', P: 'Potsdam', Q: 'Quickborn', R: 'Rostock', S: 'Salzwedel', T: 'Tübingen', U: 'Unna', V: 'Völklingen', W: 'Wuppertal', X: 'Xanten', Y: 'Ypsilon', Z: 'Zwickau',
  Ä: 'Umlaut Aachen', Ö: 'Umlaut Offenbach', Ü: 'Umlaut Unna', ẞ: 'Eszett',
};
const OLD: Record<string, string> = {
  A: 'Anton', B: 'Berta', C: 'Cäsar', D: 'Dora', E: 'Emil', F: 'Friedrich', G: 'Gustav', H: 'Heinrich', I: 'Ida', J: 'Julius', K: 'Kaufmann', L: 'Ludwig', M: 'Martha', N: 'Nordpol', O: 'Otto', P: 'Paula', Q: 'Quelle', R: 'Richard', S: 'Samuel', T: 'Theodor', U: 'Ulrich', V: 'Viktor', W: 'Wilhelm', X: 'Xanthippe', Y: 'Ypsilon', Z: 'Zacharias',
  Ä: 'Ärger', Ö: 'Ökonom', Ü: 'Übermut', ẞ: 'Eszett',
};
const NATO: Record<string, string> = {
  A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu',
};
const DIGITS = ['Null', 'Eins', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun'];
const NATO_DIGITS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

export function spell(text: string, table: Record<string, string>, digits: string[]): string {
  return Array.from(text).map((ch) => {
    const upper = ch === 'ß' ? 'ẞ' : ch.toUpperCase();
    if (table[upper]) return table[upper];
    if (/\d/.test(ch)) return digits[Number(ch)];
    if (ch === ' ') return '·';
    if (ch === '-') return 'Bindestrich';
    if (ch === '.') return 'Punkt';
    if (ch === '@') return 'At-Zeichen';
    if (ch === '_') return 'Unterstrich';
    return ch;
  }).join(' ');
}

export const cipherTool: Tool = {
  id: 'cipher',
  label: 'Verschlüsseln & Buchstabieren',
  help: '- **Chiffren:** „Caesar 3: Hallo Welt“, „ROT13: Uryyb“, „Caesar knacken: Kdoor Zhow“, „Vigenère mit Schlüssel LEMON: Angriff“, „Atbash: Hallo“, „Buchstabiere Müller“, „NATO: Aiko“, „A1Z26: Hallo“',
  run(input) {
    const raw = input.trim();
    let m: RegExpMatchArray | null;
    if ((m = raw.match(/^rot\s*13\s*[:\s]\s*([\s\S]+)$/i))) return { text: `${fence(caesar(m[1], 13))}\n\n_ROT13 ist seine eigene Umkehrung – noch einmal anwenden ergibt den Klartext._`, source: 'cipher' };
    if ((m = raw.match(/^rot\s*(-?\d{1,3})\s*[:\s]\s*([\s\S]+)$/i))) return { text: fence(caesar(m[2], Number(m[1]))), source: 'cipher' };
    if ((m = raw.match(/^(?:caesar|cäsar|caesar-?(?:chiffre|verschlüsselung|verschluesselung))\s+(?:knacken|brechen|entschlüsseln|entschluesseln|lösen|loesen|ohne\s+schlüssel|ohne\s+schluessel)\s*[:\s]\s*([\s\S]+)$/i))
      || (m = raw.match(/^(?:knacke|entschlüssele|entschluessele|löse|loese)\s+(?:den\s+|die\s+)?(?:caesar|cäsar)(?:-?(?:code|chiffre|text))?\s*[:\s]\s*([\s\S]+)$/i))) {
      const candidates = crackCaesar(m[1]);
      const best = candidates[0];
      return {
        text: `**Wahrscheinlich Verschiebung ${best.shift}:**\n\n${fence(best.text)}\n\nWeitere Kandidaten:\n${candidates.slice(1, 6).map((c) => `- Verschiebung ${c.shift}: ${c.text.length > 60 ? `${c.text.slice(0, 60)}…` : c.text}`).join('\n')}\n\n_Bewertet nach deutscher Buchstabenhäufigkeit – bei sehr kurzen Texten lieber alle 25 Verschiebungen prüfen („Caesar alle: …“)._`,
        source: 'cipher',
        val: best.shift,
      };
    }
    if ((m = raw.match(/^(?:caesar|cäsar)\s+alle\s*[:\s]\s*([\s\S]+)$/i))) {
      return { text: Array.from({ length: 25 }, (_, i) => `| ${i + 1} | ${caesar(m![1], -(i + 1)).replace(/\|/g, '\\|')} |`).reduce((acc, row) => `${acc}\n${row}`, '| Verschiebung | Entschlüsselt |\n|---:|---|'), source: 'cipher' };
    }
    if ((m = raw.match(/^(?:caesar|cäsar)(?:-?(?:chiffre|verschlüsselung|verschluesselung|code))?\s*(?:mit\s+)?(?:verschiebung\s+|schlüssel\s+|schluessel\s+|shift\s+)?(-?\d{1,3})?\s*(?:entschlüsseln|entschluesseln|dekodieren|decode|rückwärts|rueckwaerts)?\s*[:\s]\s*([\s\S]+)$/i)) && /^(?:caesar|cäsar)/i.test(raw)) {
      const shift = m[1] != null ? Number(m[1]) : 3;
      const decrypt = /entschlüsseln|entschluesseln|dekodieren|decode|rückwärts|rueckwaerts/i.test(raw.slice(0, raw.indexOf(m[2])));
      const text = m[2].trim();
      if (!text) return null;
      return { text: `${fence(caesar(text, decrypt ? -shift : shift))}\n\n_Caesar-Verschiebung ${decrypt ? '−' : '+'}${Math.abs(shift)} (nur A–Z; Umlaute und Satzzeichen bleiben). Zurück: „Caesar ${shift} entschlüsseln: …“_`, source: 'cipher', val: shift };
    }
    if ((m = raw.match(/^vigen[eè]re\s*(?:verschlüsseln|verschluesseln|entschlüsseln|entschluesseln|dekodieren|decode)?\s*(?:mit\s+)?(?:schlüssel|schluessel|key|passwort)\s*[:=]?\s*([A-Za-zÄÖÜäöü]+)\s*(?:verschlüsseln|verschluesseln|entschlüsseln|entschluesseln|dekodieren|decode)?\s*[:\s]\s*([\s\S]+)$/i))) {
      const decrypt = /entschlüsseln|entschluesseln|dekodieren|decode/i.test(raw.slice(0, raw.length - m[2].length));
      return { text: `${fence(vigenere(m[2].trim(), m[1], decrypt))}\n\n_Vigenère mit Schlüssel „${m[1].toUpperCase()}“ ${decrypt ? 'entschlüsselt' : 'verschlüsselt'} (nur A–Z). Zurück: „Vigenère entschlüsseln mit Schlüssel ${m[1].toUpperCase()}: …“_`, source: 'cipher' };
    }
    if ((m = raw.match(/^atbash\s*[:\s]\s*([\s\S]+)$/i))) return { text: `${fence(atbash(m[1]))}\n\n_Atbash spiegelt das Alphabet (A↔Z, B↔Y …) und ist seine eigene Umkehrung._`, source: 'cipher' };
    if ((m = raw.match(/^(?:a1z26|buchstabenwerte?|buchstaben\s+(?:in|als|zu)\s+zahlen|zahlencode)\s*[:\s]\s*([\s\S]+)$/i))) {
      const words = m[1].trim().split(/\s+/);
      const encoded = words.map((w) => Array.from(w.toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS')).filter((ch) => /[A-Z]/.test(ch)).map((ch) => ch.charCodeAt(0) - A + 1).join('-')).join(' / ');
      const total = Array.from(m[1].toUpperCase()).filter((ch) => /[A-Z]/.test(ch)).reduce((acc, ch) => acc + ch.charCodeAt(0) - A + 1, 0);
      return { text: `${fence(encoded)}\n\n_A = 1 … Z = 26; Buchstabensumme: ${total}. Zurück: „Zahlen in Buchstaben: 8-1-12-12-15“._`, source: 'cipher', val: total };
    }
    if ((m = raw.match(/^(?:zahlen\s+(?:in|als|zu)\s+buchstaben|a1z26\s+(?:dekodieren|decode|rückwärts|rueckwaerts))\s*[:\s]\s*([\d\s\-,./]+)$/i))) {
      const decoded = m[1].trim().split(/\s*\/\s*|\s{2,}/).map((word) => word.split(/[\s\-,.]+/).filter(Boolean).map((n) => (Number(n) >= 1 && Number(n) <= 26 ? String.fromCharCode(A + Number(n) - 1) : '?')).join('')).join(' ');
      return { text: fence(decoded), source: 'cipher' };
    }
    if ((m = raw.match(/^(?:buchstabier(?:e|en)?|buchstabieralphabet|buchstabiertafel|wie\s+buchstabiert\s+man)\s*(?:mir\s+)?(?:das\s+wort\s+|bitte\s+)?(?:nach\s+din(?:\s*5009)?\s*)?(?:(alt|klassisch|din|international|nato|icao|englisch|funk)\s*)?[:\s]\s*([\s\S]+?)\s*(?:\((alt|klassisch|din|international|nato|icao|englisch|funk)\))?\s*\??$/i))) {
      const mode = (m[1] || m[3] || '').toLowerCase();
      const text = m[2].trim();
      if (!text || text.length > 200) return null;
      if (/nato|icao|international|englisch|funk/.test(mode)) return { text: `**${text}** – NATO/ICAO:\n\n${fence(spell(text, NATO, NATO_DIGITS))}`, source: 'cipher' };
      if (/alt|klassisch/.test(mode)) return { text: `**${text}** – klassische deutsche Buchstabiertafel:\n\n${fence(spell(text, OLD, DIGITS))}`, source: 'cipher' };
      return { text: `**${text}** – DIN 5009 (Städtenamen, seit 2022):\n\n${fence(spell(text, DIN, DIGITS))}\n\nKlassisch: ${spell(text, OLD, DIGITS)}\nNATO/ICAO: ${spell(text, NATO, NATO_DIGITS)}`, source: 'cipher' };
    }
    if ((m = raw.match(/^(?:nato|icao|nato-?alphabet|funkalphabet|international\s+buchstabieren)\s*[:\s]\s*([\s\S]+)$/i))) {
      const text = m[1].trim();
      if (!text || text.length > 200) return null;
      return { text: `**${text}** – NATO/ICAO:\n\n${fence(spell(text, NATO, NATO_DIGITS))}`, source: 'cipher' };
    }
    return null;
  },
};
