import type { Tool } from './types';
import { NUM, clean, fmtN, toNum } from './shared';

/* Schuh- und Kleidungsgrößen (EU ⇄ US ⇄ UK) – kuratierte Offline-Tabellen.
   Größen sind Durchschnittswerte: Marken fallen teils eine halbe Nummer anders aus. */

type ShoeRow = { eu: number; uk: number; usMen: number; usWomen: number };
type System = 'eu' | 'uk' | 'us';

const SHOES: ShoeRow[] = [
  { eu: 35, uk: 2.5, usMen: 3.5, usWomen: 4.5 },
  { eu: 36, uk: 3.5, usMen: 4.5, usWomen: 5.5 },
  { eu: 37, uk: 4.5, usMen: 5.5, usWomen: 6.5 },
  { eu: 38, uk: 5.5, usMen: 6.5, usWomen: 7.5 },
  { eu: 39, uk: 6, usMen: 7, usWomen: 8 },
  { eu: 40, uk: 6.5, usMen: 7.5, usWomen: 8.5 },
  { eu: 41, uk: 7.5, usMen: 8.5, usWomen: 9.5 },
  { eu: 42, uk: 8, usMen: 9, usWomen: 10 },
  { eu: 43, uk: 9, usMen: 10, usWomen: 11 },
  { eu: 44, uk: 9.5, usMen: 10.5, usWomen: 11.5 },
  { eu: 45, uk: 10.5, usMen: 11.5, usWomen: 12.5 },
  { eu: 46, uk: 11, usMen: 12, usWomen: 13 },
  { eu: 47, uk: 12, usMen: 13, usWomen: 14 },
  { eu: 48, uk: 12.5, usMen: 13.5, usWomen: 14.5 },
];

/** Kinderschuhe (EU, gerade Werte) – ab EU 32/33 folgen Jugendgrößen (US 1, 2, 3 …). */
const KID_SHOES: Array<[number, number, number]> = [
  [22, 5.5, 6.5], [24, 7, 8], [26, 8.5, 9.5], [28, 10, 11], [30, 11.5, 12.5], [32, 13, 1], [34, 2, 3], [36, 3.5, 4.5], [38, 5, 6],
];

/** Damengrößen (Konfektion): EU, US, UK, international. */
const WOMEN: Array<[number, number, number, string]> = [
  [32, 2, 4, 'XXS'], [34, 4, 6, 'XS'], [36, 6, 8, 'S'], [38, 8, 10, 'M'], [40, 10, 12, 'L'],
  [42, 12, 14, 'XL'], [44, 14, 16, 'XXL'], [46, 16, 18, '3XL'], [48, 18, 20, '4XL'],
];

/** Herrengrößen (Oberbekleidung): EU, US/UK (Brustumfang in Zoll), international, Brustumfang cm. */
const MEN: Array<[number, number, string, number]> = [
  [44, 34, 'XXS', 86], [46, 36, 'XS', 90], [48, 38, 'S', 94], [50, 40, 'M', 98], [52, 42, 'L', 102],
  [54, 44, 'XL', 106], [56, 46, 'XXL', 110], [58, 48, '3XL', 114], [60, 50, '4XL', 118],
];

/** Kinderkleidung: Größe = Körpergröße in cm. */
const KIDS: Array<[number, string]> = [
  [86, 'ca. 1 Jahr'], [92, '1–1,5 Jahre'], [98, '2–3 Jahre'], [104, '3–4 Jahre'], [110, '4–5 Jahre'],
  [116, '5–6 Jahre'], [122, '6–7 Jahre'], [128, '7–8 Jahre'], [134, '8–9 Jahre'], [140, '9–10 Jahre'],
  [146, '10–11 Jahre'], [152, '11–12 Jahre'], [158, '12–13 Jahre'], [164, '13–14 Jahre'], [176, 'ab ca. 15 Jahren'],
];

/** EU-Schuhgröße → Fußlänge (EU-Größe = 1,5 × (Fußlänge + 1,5 cm)). */
const footCm = (eu: number): number => eu / 1.5 - 1.5;
const half = (value: number): string => fmtN(value).replace(/,0$/, '');
const SYSTEM_NAME: Record<System, string> = { eu: 'EU', uk: 'UK', us: 'US' };

interface ShoeQuery { value: number; from: System; to: System | null; kids: boolean }

function parseShoeQuery(s: string): ShoeQuery | null {
  let m: RegExpMatchArray | null;
  const kids = /kinder/i.test(s);
  const genderPrefix = '(?:(damen|herren|kinder)\\s+)?';
  if ((m = s.match(new RegExp(`^(?:kinder\\s*)?(?:damen|herren)?schuhgröße\\s+${genderPrefix}(?:(eu|uk|us)\\s+)?${NUM}(?:\\s+in\\s+(eu|uk|us))?$`, 'i')))) {
    return { value: toNum(m[3]), from: (m[2] || 'eu').toLowerCase() as System, to: (m[4] || '').toLowerCase() as System | '' || null, kids: kids || /kinder/i.test(m[1] || '') };
  }
  if ((m = s.match(new RegExp(`^${NUM}\\s+in\\s+(?:der\\s+)?(eu|uk|us)-?\\s*(?:damen|herren)?schuhgröße$`, 'i')))) {
    return { value: toNum(m[1]), from: 'eu', to: m[2].toLowerCase() as System, kids };
  }
  if ((m = s.match(new RegExp(`^(eu|uk|us)\\s+${NUM}\\s+in\\s+(?:der\\s+)?(eu|uk|us)-?\\s*(?:damen|herren)?schuhgröße$`, 'i')))) {
    return { value: toNum(m[2]), from: m[1].toLowerCase() as System, to: m[3].toLowerCase() as System, kids };
  }
  return null;
}

function findShoe(query: ShoeQuery, women: boolean): ShoeRow | null {
  if (query.kids) return null;
  if (query.from === 'eu') return SHOES.find((row) => row.eu === query.value) ?? null;
  const column: Record<System, (row: ShoeRow) => number> = {
    eu: (row) => row.eu,
    uk: (row) => row.uk,
    us: (row) => (women ? row.usWomen : row.usMen),
  };
  const read = column[query.from];
  const exact = SHOES.find((row) => read(row) === query.value);
  if (exact) return exact;
  // Halbgrößen (z. B. US Damen 9) liegen zwischen zwei Tabellenzeilen -> nachste Zeile als Näherung
  const nearest = SHOES.find((row) => Math.abs(read(row) - query.value) <= 0.5);
  return nearest ?? null;
}

function shoeAnswer(row: ShoeRow, to: System | null): string {
  const foot = `Fußlänge ≈ ${fmtN(footCm(row.eu), 1)} cm`;
  if (to === 'uk') return `**EU ${row.eu} ≈ UK ${half(row.uk)}** (US ${half(row.usMen)} Herren / ${half(row.usWomen)} Damen) · ${foot}`;
  if (to === 'us') return `**EU ${row.eu} ≈ US ${half(row.usMen)} (Herren) bzw. US ${half(row.usWomen)} (Damen)** · UK ${half(row.uk)} · ${foot}`;
  return `**Schuhgröße EU ${row.eu}** ≈ UK ${half(row.uk)} · US ${half(row.usMen)} (Herren) · US ${half(row.usWomen)} (Damen) · ${foot}`;
}

function womenLine(eu: number, to: System | null): string {
  const row = WOMEN.find(([size]) => size === eu)!;
  const [, us, uk, int] = row;
  const extra = `US ${us} · UK ${uk} · FR ${eu + 2} · IT ${eu + 4} · ${int}`;
  if (to === 'us') return `**Damengröße ${eu} (EU) ≈ US ${us}** · UK ${uk} · FR ${eu + 2} · IT ${eu + 4} · ${int}`;
  if (to === 'uk') return `**Damengröße ${eu} (EU) ≈ UK ${uk}** · ${extra}`;
  return `**Damengröße ${eu} (EU/${int})** ≈ ${extra}`;
}

function menLine(eu: number, to: System | null): string {
  const row = MEN.find(([size]) => size === eu)!;
  const [, inch, int, chest] = row;
  if (to === 'us' || to === 'uk') return `**Herrengröße ${eu} (EU) ≈ ${SYSTEM_NAME[to]} ${inch}** (${int}, Brustumfang ≈ ${chest} cm)`;
  return `**Herrengröße ${eu} (EU/${int})** ≈ US/UK ${inch} · Brustumfang ≈ ${chest} cm`;
}

export const sizesTool: Tool = {
  id: 'sizes',
  label: 'Kleidungs- & Schuhgrößen',
  help: '- **Größen:** „Schuhgröße 42 in US“, „Kleidungsgröße 38 in US“, „Hosengröße 32/34“, „Kindergröße 104“, „Größentabelle Schuhe“',
  run(input) {
    const s = clean(input).replace(/\s+/g, ' ');
    let m: RegExpMatchArray | null;
    const women = /damen|weiblich|frauen/i.test(s);
    const men = /herren|männlich|maennlich|männer|maenner/i.test(s);

    // Größentabellen
    if ((m = s.match(/^größen-?tabelle(?:n)?(?:\s+(schuhe?|kleidung|damen|herren|kinder))?$/i))) {
      const what = (m[1] || '').toLowerCase();
      const parts: string[] = [];
      if (!what || /kleidung|damen|herren/.test(what)) {
        parts.push(`**Damen (Konfektion)**\n\n| EU/DE | US | UK | INT |\n|---|---|---|---|\n${WOMEN.map(([eu, us, uk, int]) => `| ${eu} | ${us} | ${uk} | ${int} |`).join('\n')}`);
        parts.push(`**Herren (Oberbekleidung)**\n\n| EU/DE | US/UK | INT | Brustumfang |\n|---|---|---|---|\n${MEN.map(([eu, inch, int, chest]) => `| ${eu} | ${inch} | ${int} | ${chest} cm |`).join('\n')}`);
      }
      if (!what || /schuh/.test(what)) parts.push(`**Schuhe${what === 'kinder' ? ' (Kinder)' : ' (Erwachsene)'}**\n\n${shoeTable(what === 'kinder')}`);
      return { text: `${parts.join('\n\n')}\n\n_Größen sind Durchschnittswerte – Hersteller fallen teils eine halbe Nummer ab. Am zuverlässigsten: messen und Maßtabelle der Marke prüfen._`, source: 'sizes' };
    }

    // Schuhgrößen
    const shoeQuery = parseShoeQuery(s);
    if (shoeQuery) {
      const { value, from, to, kids } = shoeQuery;
      if (kids) {
        const row = KID_SHOES.find(([eu]) => eu === value) ?? (from === 'eu' && value >= 21 && value <= 39 && value % 2 === 0 ? [value, 0, 0] : null);
        if (row && (row[1] || !to)) {
          return {
            text: `**Kinderschuhgröße EU ${row[0]}** ≈ UK ${half(row[1])} · US ${half(row[2])}${row[2] < 13.5 ? ' (Kinder)' : ' (Jugend)'} · Fußlänge ≈ ${fmtN(footCm(row[0]), 1)} cm\n\n_Ab EU 32/33 folgen US-Jugendgrößen (1, 2, 3 …). Fußlänge messen ist auch hier am zuverlässigsten._`,
            source: 'sizes',
            val: Math.round(footCm(row[0]) * 10) / 10,
          };
        }
      }
      const row = findShoe(shoeQuery, women);
      if (row) {
        const idx = SHOES.indexOf(row);
        const columnValue = from === 'uk' ? row.uk : from === 'us' ? (women ? row.usWomen : row.usMen) : row.eu;
        const approx = columnValue !== value;
        const neighbours = idx > 0 && idx < SHOES.length - 1
          ? `- Nachbargrößen: EU ${SHOES[idx - 1].eu} ≈ US ${half(SHOES[idx - 1].usMen)} · EU ${SHOES[idx + 1].eu} ≈ US ${half(SHOES[idx + 1].usMen)} (Herren)`
          : `- Am Rand meiner Tabelle (EU ${SHOES[0].eu}–${SHOES[SHOES.length - 1].eu}).`;
        const approxNote = approx ? `- **${SYSTEM_NAME[from]} ${fmtN(value)}** liegt zwischen zwei Größen – ich zeige die nächstliegende (EU ${row.eu}).\n` : '';
        return {
          text: `${approxNote}${shoeAnswer(row, to)}\n\n${neighbours}\n- Die Größe passt, wenn Fußlänge + 1–1,5 cm Spielraum der Innenlänge entspricht.\n\n_${from === 'eu' ? `Eingegeben als ${SYSTEM_NAME[from]}-Größe. ` : ''}Größen sind Durchschnittswerte – Marken fallen teils eine halbe Nummer anders aus._`,
          source: 'sizes',
          val: Math.round(footCm(row.eu) * 10) / 10,
        };
      }
      return { text: `Die Schuhgröße ${fmtN(value)} (${SYSTEM_NAME[from]}) habe ich nicht in der Tabelle – ich kenne EU ${SHOES[0].eu}–${SHOES[SHOES.length - 1].eu} (Erwachsene) und EU ${KID_SHOES[0][0]}–${KID_SHOES[KID_SHOES.length - 1][0]} (Kinder, gerade Werte).`, source: 'sizes' };
    }

    if (/schuhgröße/i.test(s)) {
      return {
        text: `So fragst du mich nach Schuhgrößen:\n\n- „Schuhgröße 42“ – alle Systeme für eine EU-Größe\n- „Schuhgröße 42 in US“ / „US 9 in EU-Schuhgröße“ – gezielt umrechnen\n- „Kinderschuhgröße 30“ – Kindergrößen\n- „Größentabelle Schuhe“ – die ganze Übersicht`,
        source: 'sizes',
      };
    }

    // Hosengrößen: „Hosengröße 32/34“, „Jeansgröße W32 L34“, „W32 L32“
    if ((m = s.match(/^(?:hosen|jeans|bundweite)-?größe?\s*(?:w\s*)?(\d{2})\s*(?:\/|\s*l\s*)\s*(?:l\s*)?(\d{2})$/i)) ||
        (m = s.match(/^(?:hose|jeans|hosen|jeansgröße|hosengröße)\s+(?:w\s*)?(\d{2})\s*(?:\/|\s*l\s*)\s*(?:l\s*)?(\d{2})$/i)) ||
        (m = s.match(/^w(\d{2})\s*l(\d{2})$/i))) {
      const w = toNum(m[1]);
      const l = toNum(m[2]);
      if (w >= 24 && w <= 60 && l >= 26 && l <= 40) {
        return {
          text: `**Hosengröße ${fmtN(w)}/${fmtN(l)}** ≈ EU ${fmtN(w + 16)} (Herren)\n\n- W = Weite: ${fmtN(w)} Zoll = ${fmtN(w * 2.54, 1)} cm Bundumfang\n- L = Länge: ${fmtN(l)} Zoll = ${fmtN(l * 2.54, 1)} cm Innenbein\n- Faustregel Herren: **EU ≈ W + 16** (z. B. W32 → EU 48); die Länge bleibt in Zoll.\n\n_Für Damenhosen gilt die Konfektionsgröße – frag z. B. „Kleidungsgröße 38 in US“._`,
          source: 'sizes',
          val: w + 16,
        };
      }
    }

    // Kinderkleidung: „Kindergröße 104“
    if ((m = s.match(new RegExp(`^(?:kindergröße|kinder\\s+kleidungsgröße|kleidungsgröße\\s+kinder?)\\s+${NUM}$`, 'i'))) ||
        (m = s.match(new RegExp(`^${NUM}\\s+in\\s+kindergröße$`, 'i')))) {
      const size = toNum(m[1]);
      const row = KIDS.find(([cm]) => cm === size);
      if (row) {
        const neighbours = KIDS.filter(([cm]) => Math.abs(cm - size) <= 12 && cm !== size).map(([cm, age]) => `${cm} (${age})`).join(' · ');
        return {
          text: `**Kindergröße ${fmtN(size)}** = Kleidung für ${fmtN(size)} cm Körpergröße (≈ ${row[1]})\n\n- Nachbargrößen: ${neighbours}\n- US-Kindersizes richten sich eher nach dem Alter (z. B. „4T“, „Youth M“) – die Körpergröße in cm ist zuverlässiger.`,
          source: 'sizes',
        };
      }
      return { text: `Die Kindergröße ${fmtN(size)} kenne ich nicht – üblich sind 86–176 in 6er-Schritten (Körpergröße in cm).`, source: 'sizes' };
    }

    // Konfektion: „Kleidungsgröße 38 [in US]“, „Konfektionsgröße Herren 52“, „US 8 in Kleidungsgröße“
    let cloth: { value: number; from: System; to: System | null; gender: 'men' | 'women' | null } | null = null;
    if ((m = s.match(new RegExp(`^(?:kleidungsgröße|konfektionsgröße|konfektion|damengröße|herrengröße)(?:\\s+für)?(?:\\s+(damen|herren))?\\s+(?:(eu|uk|us)\\s+)?${NUM}(?:\\s+in\\s+(eu|uk|us))?$`, 'i')))) {
      cloth = { value: toNum(m[3]), from: (m[2] || 'eu').toLowerCase() as System, to: (m[4] || '').toLowerCase() as System | '' || null, gender: m[1] ? (/herren/i.test(m[1]) ? 'men' : 'women') : null };
    } else if ((m = s.match(new RegExp(`^${NUM}\\s+in\\s+(?:der\\s+)?(eu|uk|us)-?\\s*(?:kleidungsgröße|konfektionsgröße|damengröße|herrengröße)$`, 'i')))) {
      cloth = { value: toNum(m[1]), from: 'eu', to: m[2].toLowerCase() as System, gender: null };
    }
    if (cloth) {
      const { value, from, to, gender } = cloth;
      let eu: number | null = null;
      let resolved: 'men' | 'women' | null = gender;
      if (from === 'eu') eu = value;
      else {
        // US/UK: Damen UK = US + 2, Herren UK = US (Brustumfang in Zoll). US-Damen 2–18, US-Herren 34–50.
        const usValue = value - (from === 'uk' ? 2 : 0);
        const womenEu = WOMEN.find(([, us]) => us === usValue)?.[0];
        const menEu = MEN.find(([, inch]) => inch === value)?.[0];
        if (gender === 'men') eu = menEu ?? null;
        else if (gender === 'women') eu = womenEu ?? null;
        else if (womenEu != null) { eu = womenEu; resolved = 'women'; }
        else { eu = menEu ?? null; resolved = menEu != null ? 'men' : null; }
      }
      if (eu != null) {
        const inWomen = WOMEN.some(([size]) => size === eu);
        const inMen = MEN.some(([size]) => size === eu);
        const lines: string[] = [];
        if (resolved === 'men' || (inMen && !inWomen)) lines.push(menLine(eu, to));
        else if (resolved === 'women' || (inWomen && !inMen)) lines.push(womenLine(eu, to));
        else if (inWomen && inMen) {
          // EU 44–48 gibt es in beiden Tabellen → beide Deutungen zeigen
          lines.push(womenLine(eu, to), `_${menLine(eu, to)}_`);
        }
        if (lines.length) {
          return {
            text: `${lines.join('\n\n')}\n\n_Größen sind Durchschnittswerte; FR (+2) und IT (+4) beziehen sich auf Damenkonfektion. „Größentabelle Kleidung“ zeigt alles auf einen Blick._`,
            source: 'sizes',
          };
        }
      }
      return { text: `Die Größe ${fmtN(value)} habe ich in meiner Tabelle nicht – ich kenne Damen ${WOMEN[0][0]}–${WOMEN[WOMEN.length - 1][0]}, Herren ${MEN[0][0]}–${MEN[MEN.length - 1][0]} und Schuhe EU ${SHOES[0].eu}–${SHOES[SHOES.length - 1].eu}.`, source: 'sizes' };
    }

    return null;
  },
};

function shoeTable(kids: boolean): string {
  if (kids) {
    return `| EU | UK | US (Kinder) | Fuß cm |\n|---|---|---|---|\n${KID_SHOES.map(([eu, uk, us]) => `| ${eu} | ${half(uk)} | ${half(us)} | ${fmtN(footCm(eu), 1)} |`).join('\n')}`;
  }
  return `| EU | UK | US Herren | US Damen | Fuß cm |\n|---|---|---|---|---|\n${SHOES.map((row) => `| ${row.eu} | ${half(row.uk)} | ${half(row.usMen)} | ${half(row.usWomen)} | ${fmtN(footCm(row.eu), 1)} |`).join('\n')}`;
}
