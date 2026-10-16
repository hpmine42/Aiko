import type { Tool } from './types';
import { clean, fmtDay, parseDate, todayUTC } from './shared';

/* Western zodiac (fixed date ranges) and the Chinese zodiac (with the New Year caveat). */

const SIGNS: Array<{ name: string; emoji: string; from: [number, number]; to: [number, number]; element: string }> = [
  { name: 'Steinbock', emoji: '♑', from: [12, 22], to: [1, 19], element: 'Erde' },
  { name: 'Wassermann', emoji: '♒', from: [1, 20], to: [2, 18], element: 'Luft' },
  { name: 'Fische', emoji: '♓', from: [2, 19], to: [3, 20], element: 'Wasser' },
  { name: 'Widder', emoji: '♈', from: [3, 21], to: [4, 19], element: 'Feuer' },
  { name: 'Stier', emoji: '♉', from: [4, 20], to: [5, 20], element: 'Erde' },
  { name: 'Zwillinge', emoji: '♊', from: [5, 21], to: [6, 20], element: 'Luft' },
  { name: 'Krebs', emoji: '♋', from: [6, 21], to: [7, 22], element: 'Wasser' },
  { name: 'Löwe', emoji: '♌', from: [7, 23], to: [8, 22], element: 'Feuer' },
  { name: 'Jungfrau', emoji: '♍', from: [8, 23], to: [9, 22], element: 'Erde' },
  { name: 'Waage', emoji: '♎', from: [9, 23], to: [10, 22], element: 'Luft' },
  { name: 'Skorpion', emoji: '♏', from: [10, 23], to: [11, 21], element: 'Wasser' },
  { name: 'Schütze', emoji: '♐', from: [11, 22], to: [12, 21], element: 'Feuer' },
];

export function zodiacSign(month: number, day: number): typeof SIGNS[number] {
  const v = month * 100 + day;
  return SIGNS.find((sign) => {
    const a = sign.from[0] * 100 + sign.from[1];
    const b = sign.to[0] * 100 + sign.to[1];
    return a <= b ? v >= a && v <= b : v >= a || v <= b;
  }) || SIGNS[0];
}

const ANIMALS = ['Affe', 'Hahn', 'Hund', 'Schwein', 'Ratte', 'Büffel', 'Tiger', 'Hase', 'Drache', 'Schlange', 'Pferd', 'Ziege'];
const ANIMAL_EMOJI = ['🐒', '🐓', '🐕', '🐖', '🐀', '🐂', '🐅', '🐇', '🐉', '🐍', '🐎', '🐐'];
const GENITIVE: Record<string, string> = { Affe: 'des Affen', Hahn: 'des Hahns', Hund: 'des Hundes', Schwein: 'des Schweins', Ratte: 'der Ratte', Büffel: 'des Büffels', Tiger: 'des Tigers', Hase: 'des Hasen', Drache: 'des Drachen', Schlange: 'der Schlange', Pferd: 'des Pferdes', Ziege: 'der Ziege' };
const ELEMENTS = ['Metall', 'Metall', 'Wasser', 'Wasser', 'Holz', 'Holz', 'Feuer', 'Feuer', 'Erde', 'Erde'];
/** Approximate Chinese New Year dates (month, day) for the caveat; years 1990–2035. */
const CNY: Record<number, [number, number]> = {
  1990: [1, 27], 1991: [2, 15], 1992: [2, 4], 1993: [1, 23], 1994: [2, 10], 1995: [1, 31], 1996: [2, 19], 1997: [2, 7], 1998: [1, 28], 1999: [2, 16],
  2000: [2, 5], 2001: [1, 24], 2002: [2, 12], 2003: [2, 1], 2004: [1, 22], 2005: [2, 9], 2006: [1, 29], 2007: [2, 18], 2008: [2, 7], 2009: [1, 26],
  2010: [2, 14], 2011: [2, 3], 2012: [1, 23], 2013: [2, 10], 2014: [1, 31], 2015: [2, 19], 2016: [2, 8], 2017: [1, 28], 2018: [2, 16], 2019: [2, 5],
  2020: [1, 25], 2021: [2, 12], 2022: [2, 1], 2023: [1, 22], 2024: [2, 10], 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13],
  2030: [2, 3], 2031: [1, 23], 2032: [2, 11], 2033: [1, 31], 2034: [2, 19], 2035: [1, 28],
};

export function chineseZodiac(year: number, month?: number, day?: number): { animal: string; emoji: string; element: string; year: number; shifted: boolean } {
  let y = year;
  let shifted = false;
  if (month != null && day != null && CNY[year]) {
    const [cm, cd] = CNY[year];
    if (month * 100 + day < cm * 100 + cd) { y = year - 1; shifted = true; }
  }
  const index = ((y - 1900) % 12 + 12) % 12;        // 1900 = Ratte → ANIMALS index 4
  const animal = ANIMALS[(index + 4) % 12];
  const emoji = ANIMAL_EMOJI[(index + 4) % 12];
  const element = ELEMENTS[((y % 10) + 10) % 10];
  return { animal, emoji, element, year: y, shifted };
}

export const zodiacTool: Tool = {
  id: 'zodiac',
  label: 'Sternzeichen',
  help: '- **Sternzeichen:** „Sternzeichen am 14.3.“, „Welches Sternzeichen bin ich?“ (nach „Ich bin am … geboren“), „Chinesisches Tierkreiszeichen 1990“',
  run(input, context) {
    const s = clean(input);
    let m: RegExpMatchArray | null;
    if ((m = s.match(/^(?:welches\s+)?(?:chinesische[sn]?\s+)(?:sternzeichen|tierkreiszeichen|horoskop)(?:\s+(?:ist|hat|habe\s+ich|bin\s+ich|für|fuer|von|im\s+jahr|am))?\s*(.+)?$/i))
      || (m = s.match(/^(?:welches\s+)?(?:tierkreiszeichen|chinesisches\s+jahr)(?:\s+(?:ist|hat|für|fuer|von|im\s+jahr|am))?\s*(.+)?$/i))) {
      const rest = (m[1] || '').trim();
      let year: number | null = null;
      let month: number | undefined;
      let day: number | undefined;
      if (/^\d{4}$/.test(rest)) year = Number(rest);
      else if (rest) {
        const ts = parseDate(rest, context.now());
        if (ts == null) return { text: `„${rest}“ verstehe ich nicht – z. B. „Chinesisches Tierkreiszeichen 1990“ oder „… am 3.2.1992“.`, source: 'zodiac' };
        const d = new Date(ts);
        year = d.getUTCFullYear(); month = d.getUTCMonth() + 1; day = d.getUTCDate();
      } else year = context.now().getFullYear();
      const z = chineseZodiac(year, month, day);
      const upcoming = CNY[year] ? `Das chinesische Neujahr ${year} ${todayUTC(context.now()) < Date.UTC(year, CNY[year][0] - 1, CNY[year][1]) ? 'fällt' : 'fiel'} auf den ${CNY[year][1]}.${CNY[year][0]}.` : '';
      return {
        text: `${z.emoji} **${z.year}: Jahr ${GENITIVE[z.animal]}** – Element ${z.element}${z.shifted ? `\n\nDa das Datum vor dem chinesischen Neujahr ${year} liegt, zählt noch das Vorjahr.` : ''}${upcoming ? `\n\n_${upcoming}_` : ''}\n\n_Die zwölf Tiere wiederholen sich alle 12 Jahre; die fünf Elemente wechseln alle zwei Jahre. Ohne Tagesangabe gilt das Kalenderjahr._`,
        source: 'zodiac',
      };
    }
    if ((m = s.match(/^(?:welches\s+)?sternzeichen(?:\s+(?:ist|hat|habe\s+ich|bin\s+ich|hat\s+man|für|fuer|von|am|bei))?\s*(?:jemand\s+)?(?:geboren\s+)?(?:am\s+)?(.+)?$/i))
      || (m = s.match(/^(?:welches\s+sternzeichen\s+)?(?:ist|hat)\s+(?:man|jemand)\s+(?:am|mit\s+geburtstag\s+am)\s+(.+)$/i))) {
      const rest = (m[1] || '').replace(/\s+geboren$/i, '').trim();
      let ts: number | null = null;
      if (!rest || /^(?:ich|bin\s+ich|habe\s+ich)$/i.test(rest)) {
        const birthday = context.config.memory.map((note) => note.match(/geboren\s+am\s+(\d{1,2}\.\s*\d{1,2}\.?\s*(?:\d{2,4})?)/i) || note.match(/geburtstag\s*(?:ist|:)?\s*(?:am\s+)?(\d{1,2}\.\s*\d{1,2}\.?\s*(?:\d{2,4})?)/i)).find(Boolean);
        if (birthday) ts = parseDate(birthday[1], context.now());
        if (ts == null) return { text: 'Dafür brauche ich ein Datum – z. B. „Sternzeichen am 14.3.“. Mit „Merke dir: Ich bin am 14.3.1990 geboren“ weiß ich es künftig.', source: 'zodiac' };
      } else {
        ts = parseDate(rest, context.now());
        if (ts == null) return { text: `Das Datum „${rest}“ verstehe ich nicht – z. B. „Sternzeichen am 14.3.“.`, source: 'zodiac' };
      }
      const d = new Date(ts);
      const sign = zodiacSign(d.getUTCMonth() + 1, d.getUTCDate());
      const next = SIGNS[(SIGNS.indexOf(sign) + 1) % 12];
      const chinese = rest && /\d{4}/.test(rest) ? chineseZodiac(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) : null;
      return {
        text: `${sign.emoji} **${sign.name}** (${sign.from[1]}.${sign.from[0]}. – ${sign.to[1]}.${sign.to[0]}.) – Element ${sign.element}${chinese ? `\n\nChinesisch: ${chinese.emoji} ${chinese.animal} (${chinese.element})` : ''}\n\n_${fmtDay(ts)}: ${sign.name} geht am ${sign.to[1]}.${sign.to[0]}. in ${next.name} über. Die Grenztage können je nach Jahr um einen Tag schwanken._`,
        source: 'zodiac',
      };
    }
    return null;
  },
};
