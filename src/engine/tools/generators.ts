import type { Tool, ToolResult } from './types';
import { clean, fence, fmtN, pick, randomInt } from './shared';

/* ---------------- UUID v4 ---------------- */

export function uuid(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/* ---------------- Lorem ipsum ---------------- */

const LOREM_WORDS = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua '
  + 'enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit '
  + 'voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit '
  + 'anim id est laborum at vero eos accusamus iusto odio dignissimos ducimus blanditiis praesentium voluptatum deleniti atque corrupti quos '
  + 'dolores quas molestias excepturi occaecati cupiditate provident similique mollitia animi perferendis doloribus asperiores repellat').split(' ');
const LOREM_START = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

function loremSentence(): string {
  const length = 6 + randomInt(10);
  const words: string[] = [];
  for (let i = 0; i < length; i += 1) words.push(pick(LOREM_WORDS));
  let sentence = words.join(' ');
  if (length > 9) {
    const comma = 3 + randomInt(length - 6);
    sentence = words.slice(0, comma).join(' ') + ', ' + words.slice(comma).join(' ');
  }
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
}

export function lorem(paragraphs: number, words: number | null): string {
  if (words != null) {
    const out = LOREM_START.split(' ');
    while (out.length < words) out.push(pick(LOREM_WORDS));
    return (out.slice(0, words).join(' ').replace(/[.,]$/, '') + '.').replace(/\.\s+([a-z])/g, (_all, first: string) => `. ${first.toUpperCase()}`);
  }
  const parts: string[] = [];
  for (let p = 0; p < paragraphs; p += 1) {
    const count = 3 + randomInt(4);
    const sentences: string[] = [];
    for (let i = 0; i < count; i += 1) sentences.push(p === 0 && i === 0 ? LOREM_START : loremSentence());
    parts.push(sentences.join(' '));
  }
  return parts.join('\n\n');
}

/* ---------------- Morse ---------------- */

const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  Ä: '.-.-', Ö: '---.', Ü: '..--', ß: '...--..', CH: '----',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.', "'": '.----.',
};
const MORSE_REVERSE = Object.fromEntries(Object.entries(MORSE).filter(([k]) => k !== 'CH').map(([k, v]) => [v, k]));

export function toMorse(text: string): { code: string; unknown: string[] } {
  const unknown: string[] = [];
  const words = text.trim().toUpperCase().split(/\s+/);
  const code = words.map((word) => Array.from(word).map((ch) => {
    if (MORSE[ch]) return MORSE[ch];
    unknown.push(ch);
    return '?';
  }).join(' ')).join(' / ');
  return { code, unknown: [...new Set(unknown)] };
}

export function fromMorse(code: string): string {
  return code.trim().replace(/[·•]/g, '.').replace(/[–—_]/g, '-').split(/\s*(?:\/|\||\s{3,})\s*/).map((word) => word.trim().split(/\s+/).map((letter) => (letter ? (MORSE_REVERSE[letter] ?? '?') : '')).join('')).join(' ');
}

/* ---------------- Random names ---------------- */

const FIRST_NAMES = ('Anna Ben Clara David Emma Felix Greta Hannah Ida Jonas Klara Leon Mia Noah Paula Quentin Rosa Samuel Tilda Ulrich Vera Wim Xenia Yannick Zoe '
  + 'Lena Max Nele Oskar Pia Rafael Sophie Theo Johanna Karl Marie Moritz Lotte Henri Frieda Anton Mathilda Elias Charlotte Jakob Luisa Finn Emilia Paul').split(' ');
const LAST_NAMES = ('Müller Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Hoffmann Koch Richter Klein Wolf Schröder Neumann Schwarz Braun Zimmermann Krüger '
  + 'Hartmann Lange Werner Krause Lehmann Köhler Herrmann König Walter Huber Kaiser Fuchs Peters Lang Scholz Möller Weiß Jung Hahn Vogel').split(' ');
const ADJECTIVES = ('Flinker Mutiger Stiller Heiterer Kluger Wilder Sanfter Schlauer Bunter Flotter Tapferer Neugieriger Gelassener Frecher Treuer Wacher Listiger Munterer Kühner Rascher').split(' ');
const ANIMALS = ('Fuchs Dachs Otter Falke Luchs Igel Wal Hirsch Biber Kranich Wolf Panda Pinguin Kauz Marder Delfin Elch Koala Frosch Löwe').split(' ');

function names(kind: 'full' | 'first' | 'nick' | 'user', count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    if (kind === 'first') out.push(pick(FIRST_NAMES));
    else if (kind === 'nick') out.push(`${pick(ADJECTIVES)} ${pick(ANIMALS)}`);
    else if (kind === 'user') out.push(`${pick(ADJECTIVES).toLowerCase().replace(/er$/, '')}_${pick(ANIMALS).toLowerCase().replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ä/g, 'ae')}${10 + randomInt(90)}`);
    else out.push(`${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`);
  }
  return out;
}

const COUNT = '(?:(\\d{1,2})\\s*(?:x|mal|stück|stueck)?\\s+)?';

export const generatorTool: Tool = {
  id: 'generate',
  label: 'UUID, Blindtext, Morse & Namen',
  help: '- **Generatoren:** „UUID“, „Lorem ipsum 3 Absätze“, „SOS in Morse“, „Morse dekodieren: ... --- ...“, „Zufallsname“, „Nickname“',
  run(input) {
    const s = clean(input);
    const raw = input.trim();   // Morse code ends with dots – keep them
    let m: RegExpMatchArray | null;

    if ((m = s.match(new RegExp('^(?:(?:erzeuge|generiere|erstelle|gib\\s+mir|mach(?:e)?|neue?)\\s+)?' + COUNT + '(?:(?:neue|zufällige|zufaellige|eine|einen|ein)\\s+)?(?:uuids?|guids?|uuid\\s*v?4)(?:\\s+(?:generieren|erzeugen|erstellen))?$', 'i')))) {
      const count = Math.min(10, Math.max(1, Number(m[1]) || 1));
      const list = Array.from({ length: count }, () => uuid());
      const text = count === 1
        ? `**UUID v4** (zufällig, lokal erzeugt):\n\n${fence(list[0])}\n\n_122 Zufallsbits – praktisch kollisionsfrei._`
        : `**${count} UUIDs (v4):**\n\n${fence(list.join('\n'))}`;
      return { text, source: 'generate', widget: count === 1 ? { type: 'pw', text: list[0], label: 'UUID v4', req: 'uuid' } : null };
    }

    if ((m = s.match(new RegExp('^(?:(?:erzeuge|generiere|erstelle|gib\\s+mir|mach(?:e)?)\\s+)?' + COUNT + '(?:(?:absätze|absaetze|abschnitte|sätze|saetze|wörter|woerter|worte)\\s+)?(?:lorem\\s*ipsum|blindtext|fülltext|fuelltext|platzhaltertext|dummy[-\\s]?text)(?:\\s+(?:mit\\s+)?(\\d{1,3})\\s*(absätze|absaetze|abschnitte|absatz|wörter|woerter|worte|wörtern|woertern))?$', 'i')))) {
      const unit = (m[3] || '').toLowerCase();
      const n = Number(m[2] || m[1]) || 1;
      const wantsWords = /w(ö|oe)rt|worte/.test(unit) || /w(ö|oe)rter|worte/i.test(s.split(/lorem|blindtext|fülltext|fuelltext|platzhaltertext|dummy/i)[0] || '');
      if (wantsWords) {
        const words = Math.min(500, Math.max(3, n));
        return { text: `**Blindtext, ${fmtN(words)} Wörter:**\n\n${lorem(1, words)}`, source: 'generate' };
      }
      const paragraphs = Math.min(10, Math.max(1, n));
      return { text: `**Blindtext, ${paragraphs} ${paragraphs === 1 ? 'Absatz' : 'Absätze'}:**\n\n${lorem(paragraphs, null)}`, source: 'generate' };
    }

    if ((m = raw.match(/^(?:morse(?:code)?\s+(?:dekodieren|decodieren|decode|entschlüsseln|entschluesseln|übersetzen|uebersetzen|lesen)|(?:dekodiere|decodiere|entschlüssele|entschluessele|übersetze|uebersetze)\s+(?:den\s+|diesen\s+)?morse(?:code)?|aus\s+morse|von\s+morse)\s*[:\n]?\s*([.\-·•–—_/|\s]+)$/i))
      || (m = raw.match(/^(?:morse(?:code)?)\s*[:\n]\s*([.\-·•–—_/|\s]+)$/i))
      || (m = raw.match(/^([.\-·•–—_/|\s]{3,})\s+(?:in|als|aus|von)\s+(?:morse(?:code)?|text|klartext)[?!.]*$/i))) {
      const text = fromMorse(m[1]);
      return { text: `**Morse → Text:**\n\n${fence(text)}\n\n_Buchstaben durch Leerzeichen, Wörter durch „/“ trennen._`, source: 'generate' };
    }
    if ((m = s.match(/^(?:morse(?:code)?(?:\s+(?:für|fuer|von|kodieren|codieren|encode))?|(?:übersetze|uebersetze|kodiere|codiere|wandle)\s+(?:in|zu|nach)\s+morse(?:code)?|in\s+morse(?:code)?)\s*[:\n]\s*(.+)$/i))
      || (m = s.match(/^(?:übersetze|uebersetze|wandle|kodiere|codiere|schreibe)?\s*(.+?)\s+(?:in|als|zu|nach|auf)\s+morse(?:code)?(?:\s+(?:übersetzen|uebersetzen|umwandeln))?$/i))
      || (m = s.match(/^morse(?:code)?\s+(?:für|fuer|von)\s+(.+)$/i))) {
      const source = m[1].replace(/^[„"']+|[“"']+$/g, '').trim();
      if (!source) return null;
      if (source.length > 300) return { text: 'Bitte höchstens 300 Zeichen für Morsecode.', source: 'generate' };
      const { code, unknown } = toMorse(source);
      return {
        text: `**Morsecode für „${source}“:**\n\n${fence(code)}\n\n_Buchstaben durch Leerzeichen, Wörter durch „/“ getrennt._${unknown.length ? ` Kein Morsezeichen für: ${unknown.join(' ')}.` : ''}`,
        source: 'generate',
      };
    }

    if ((m = s.match(new RegExp('^(?:(?:erzeuge|generiere|erstelle|gib\\s+mir|nenn(?:e)?\\s+mir|schlag(?:e)?\\s+(?:mir\\s+)?vor|ich\\s+brauche|mach(?:e)?)\\s+)?' + COUNT + '(?:(?:einen|eine|ein|neue[rn]?|zufällige[rn]?|zufaellige[rn]?|coole[rn]?|lustige[rn]?)\\s+)*(zufallsnamen?|zufälliger?\\s+namen?|zufaelliger?\\s+namen?|namen?\\s*(?:generator|generieren|vorschlag)|fantasienamen?|vornamen?|spitznamen?|nickname[sn]?|benutzernamen?|username[sn]?|alias|pseudonym|künstlernamen?|deckname|tarnnamen?)(?:\\s+(?:generieren|erzeugen|vorschlagen|bitte))?$', 'i')))) {
      const count = Math.min(10, Math.max(1, Number(m[1]) || 1));
      const word = m[2].toLowerCase();
      const kind = /vorname/.test(word) ? 'first' : /benutzer|user/.test(word) ? 'user' : /spitz|nick|alias|pseudonym|künstler|deck|tarn|fantasie/.test(word) ? 'nick' : 'full';
      const list = names(kind, count);
      const title = kind === 'first' ? 'Zufälliger Vorname' : kind === 'user' ? 'Benutzername' : kind === 'nick' ? 'Spitzname' : 'Zufallsname';
      const result: ToolResult = {
        text: `**${title}${count > 1 ? 'n' : ''}:**\n\n${list.map((name) => `- **${name}**`).join('\n')}\n\n_Aus einer eingebauten Liste zufällig zusammengesetzt – Ähnlichkeiten mit echten Personen sind Zufall._`,
        source: 'generate',
      };
      return result;
    }
    return null;
  },
};
