import type { Tool, ToolResult } from './types';
import { clean } from './shared';

/* ---------------- IBAN (ISO 13616, mod 97-10) ---------------- */

const IBAN_LENGTH: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24,
  DE: 22, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
  HR: 21, HU: 28, IE: 22, IL: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27,
  MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22,
  SA: 24, SE: 24, SI: 19, SK: 24, SM: 27, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
};
const COUNTRY: Record<string, string> = { DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', FR: 'Frankreich', NL: 'Niederlande', BE: 'Belgien', IT: 'Italien', ES: 'Spanien', LU: 'Luxemburg', PL: 'Polen', GB: 'Vereinigtes Königreich', DK: 'Dänemark', SE: 'Schweden', NO: 'Norwegen', FI: 'Finnland', IE: 'Irland', PT: 'Portugal', CZ: 'Tschechien', HU: 'Ungarn', LI: 'Liechtenstein', GR: 'Griechenland', HR: 'Kroatien', SI: 'Slowenien', SK: 'Slowakei', EE: 'Estland', LV: 'Lettland', LT: 'Litauen', RO: 'Rumänien', BG: 'Bulgarien', MT: 'Malta', CY: 'Zypern', TR: 'Türkei', IS: 'Island', MC: 'Monaco', SM: 'San Marino', VA: 'Vatikanstadt', UA: 'Ukraine' };

export function mod97(digits: string): number {
  let rest = 0;
  for (let i = 0; i < digits.length; i += 7) rest = Number(`${rest}${digits.slice(i, i + 7)}`) % 97;
  return rest;
}

export interface IbanCheck { ok: boolean; iban: string; country: string; reason?: string; blz?: string; account?: string }

export function checkIban(raw: string): IbanCheck {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  const country = iban.slice(0, 2);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return { ok: false, iban, country, reason: 'Aufbau stimmt nicht: zwei Buchstaben (Land), zwei Prüfziffern, dann 11–30 Zeichen.' };
  const expected = IBAN_LENGTH[country];
  if (!expected) return { ok: false, iban, country, reason: `Das Länderkürzel „${country}“ kenne ich nicht.` };
  if (iban.length !== expected) return { ok: false, iban, country, reason: `Für ${COUNTRY[country] || country} muss eine IBAN ${expected} Zeichen haben, diese hat ${iban.length}.` };
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  if (mod97(numeric) !== 1) return { ok: false, iban, country, reason: 'Die Prüfziffern passen nicht (Modulo-97-Test schlägt fehl) – vermutlich ein Zahlendreher oder Tippfehler.' };
  const result: IbanCheck = { ok: true, iban, country };
  if (country === 'DE') { result.blz = iban.slice(4, 12); result.account = iban.slice(12).replace(/^0+/, '') || '0'; }
  return result;
}

const groupIban = (iban: string): string => iban.replace(/(.{4})/g, '$1 ').trim();

/* ---------------- ISBN-10 / ISBN-13 ---------------- */

export function isbn10Check(digits: string): string | null {
  if (!/^\d{9}[\dX]$/i.test(digits)) return null;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += (10 - i) * Number(digits[i]);
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? 'X' : String(check);
}

/** EAN/GTIN check digit for 7, 11, 12 or 13 payload digits. */
export function eanCheckDigit(payload: string): string {
  let sum = 0;
  const digits = payload.split('').reverse();
  digits.forEach((d, i) => { sum += Number(d) * (i % 2 === 0 ? 3 : 1); });
  return String((10 - (sum % 10)) % 10);
}

export function isbn10to13(digits: string): string {
  const payload = `978${digits.slice(0, 9)}`;
  return payload + eanCheckDigit(payload);
}

function isbnReply(raw: string): ToolResult {
  const cleaned = raw.replace(/[\s-]/g, '').toUpperCase().replace(/^ISBN:?/, '');
  if (/^\d{9}[\dX]$/.test(cleaned)) {
    const check = isbn10Check(cleaned)!;
    const ok = check === cleaned[9];
    return {
      text: ok
        ? `✔️ **${raw.trim()} ist eine gültige ISBN-10.**\n\n- Prüfziffer: ${check} (Summe der gewichteten Ziffern mod 11)\n- Als ISBN-13: **${isbn10to13(cleaned).replace(/^(\d{3})(\d{9})(\d)$/, '$1-$2-$3')}**`
        : `✘ **${raw.trim()} ist keine gültige ISBN-10.** Die Prüfziffer müsste ${check} sein, nicht ${cleaned[9]}.`,
      source: 'check',
    };
  }
  if (/^\d{13}$/.test(cleaned)) {
    const check = eanCheckDigit(cleaned.slice(0, 12));
    const ok = check === cleaned[12];
    const prefix = cleaned.startsWith('978') || cleaned.startsWith('979');
    return {
      text: ok
        ? `✔️ **${raw.trim()} ist eine gültige ISBN-13**${prefix ? '' : ' (formal – allerdings ohne das Buch-Präfix 978/979)'}.\n\n- Prüfziffer: ${check} (EAN-13-Verfahren, Gewichte 1 und 3)${cleaned.startsWith('978') ? `\n- Entspricht der ISBN-10: ${(() => { const core = cleaned.slice(3, 12); return core + isbn10Check(`${core}0`); })()}` : ''}`
        : `✘ **${raw.trim()} ist keine gültige ISBN-13.** Die Prüfziffer müsste ${check} sein, nicht ${cleaned[12]}.`,
      source: 'check',
    };
  }
  return { text: 'Eine ISBN hat 10 Ziffern (die letzte darf X sein) oder 13 Ziffern, z. B. „ISBN prüfen: 978-3-16-148410-0“.', source: 'check' };
}

function eanReply(raw: string): ToolResult {
  const digits = raw.replace(/[\s-]/g, '');
  if (!/^\d{8}$|^\d{12,14}$/.test(digits)) return { text: 'EAN/GTIN-Codes haben 8, 12, 13 oder 14 Ziffern, z. B. „EAN prüfen: 4006381333931“.', source: 'check' };
  const check = eanCheckDigit(digits.slice(0, -1));
  const ok = check === digits[digits.length - 1];
  const type = digits.length === 8 ? 'EAN-8' : digits.length === 12 ? 'UPC-A (GTIN-12)' : digits.length === 13 ? 'EAN-13 (GTIN-13)' : 'GTIN-14';
  const country = digits.length === 13 ? ganPrefix(digits.slice(0, 3)) : null;
  return {
    text: ok
      ? `✔️ **${digits} ist ein formal gültiger ${type}.**\n\n- Prüfziffer: ${check} (Gewichte 3 und 1 von rechts, auf volle Zehner ergänzt)${country ? `\n- Präfix ${digits.slice(0, 3)}: ${country}` : ''}\n\n_Der Test sagt nur, dass die Prüfziffer stimmt – nicht, welches Produkt dahintersteckt._`
      : `✘ **${digits} ist kein gültiger ${type}.** Die Prüfziffer müsste ${check} sein, nicht ${digits[digits.length - 1]}.`,
    source: 'check',
  };
}

function ganPrefix(prefix: string): string | null {
  const p = Number(prefix);
  if (p >= 400 && p <= 440) return 'GS1 Germany (Deutschland)';
  if (p >= 900 && p <= 919) return 'GS1 Austria (Österreich)';
  if (p >= 760 && p <= 769) return 'GS1 Schweiz';
  if (p >= 300 && p <= 379) return 'GS1 France (Frankreich)';
  if (p >= 500 && p <= 509) return 'GS1 UK';
  if ((p >= 0 && p <= 139)) return 'GS1 US / Kanada';
  if (p >= 200 && p <= 299) return 'interne Nummern (z. B. Waage im Supermarkt)';
  if (p >= 978 && p <= 979) return 'Bücher (ISBN)';
  if (p === 977) return 'Zeitschriften (ISSN)';
  return null;
}

export const checkDigitTool: Tool = {
  id: 'check',
  label: 'IBAN, ISBN & EAN prüfen',
  help: '- **Prüfziffern:** „IBAN prüfen: DE89 3704 0044 0532 0130 00“, „ISBN prüfen: 978-3-16-148410-0“, „EAN prüfen: 4006381333931“',
  run(input) {
    const s = clean(input);
    let m: RegExpMatchArray | null;
    if ((m = s.match(/^(?:(?:prüf(?:e)?|pruef(?:e)?|check(?:e)?|validiere|teste)\s+(?:die\s+|diese\s+)?iban\s*[:\s]\s*|iban\s+(?:prüfen|pruefen|check|checken|validieren|testen|gültig|gueltig)\s*[:?]?\s*|iban\s*[:\s]\s*|ist\s+(?:die\s+iban\s+)?)([A-Za-z]{2}\s?\d{2}[\sA-Za-z0-9]{11,40}?)(?:\s+(?:eine\s+)?(?:gültige?|gueltige?|korrekte?|richtige?)\s+iban|\s+(?:gültig|gueltig|korrekt|richtig|ok))?$/i))) {
      const result = checkIban(m[1]);
      const lines = result.ok
        ? [`✔️ **${groupIban(result.iban)} ist formal gültig.**`, '', `- Land: ${COUNTRY[result.country] || result.country}`, `- Prüfziffern: ${result.iban.slice(2, 4)} (Modulo 97 = 1 ✔️)`]
        : [`✘ **${groupIban(result.iban)} ist nicht gültig.**`, '', `- ${result.reason}`];
      if (result.ok && result.blz) lines.push(`- Bankleitzahl: ${result.blz}`, `- Kontonummer: ${result.account}`);
      lines.push('', '_Die Prüfung ist rein rechnerisch und passiert nur auf deinem Gerät. Sie sagt nicht, ob das Konto existiert._');
      return { text: lines.join('\n'), source: 'check' };
    }
    if ((m = s.match(/^(?:(?:prüf(?:e)?|pruef(?:e)?|check(?:e)?|validiere|teste)\s+(?:die\s+)?isbn\s*[:\s]\s*|isbn\s+(?:prüfen|pruefen|check|checken|validieren|testen|gültig|gueltig)\s*[:?]?\s*|isbn\s*[:\s]\s*|ist\s+(?:die\s+isbn\s+)?)([\d\sXx-]{10,20}?)(?:\s+(?:eine\s+)?(?:gültige?|gueltige?|korrekte?|richtige?)\s+isbn|\s+(?:gültig|gueltig|korrekt|richtig|ok))?$/i))) {
      return isbnReply(m[1]);
    }
    if ((m = s.match(/^(?:(?:prüf(?:e)?|pruef(?:e)?|check(?:e)?|validiere|teste)\s+(?:den\s+|die\s+|diesen\s+)?(?:ean|gtin|barcode|strichcode|upc)\s*[:\s]\s*|(?:ean|gtin|barcode|strichcode|upc)\s+(?:prüfen|pruefen|check|checken|validieren|testen|gültig|gueltig)\s*[:?]?\s*|(?:ean|gtin|barcode|strichcode|upc)\s*[:\s]\s*|ist\s+(?:der\s+|die\s+)?(?:ean|gtin|barcode|strichcode)\s+)([\d\s-]{8,20}?)(?:\s+(?:ein\s+|eine\s+)?(?:gültige?[rs]?|gueltige?[rs]?|korrekte?[rs]?|richtige?[rs]?)\s+(?:ean|gtin|barcode|code)|\s+(?:gültig|gueltig|korrekt|richtig|ok))?$/i))) {
      return eanReply(m[1]);
    }
    if ((m = s.match(/^(?:prüfziffer|pruefziffer|prüfsumme)\s+(?:für|fuer|von|berechnen\s+für|berechnen\s+von)\s+(?:ean|gtin|barcode)?\s*[:\s]?\s*(\d[\d\s-]{6,16}\d)$/i))) {
      const digits = m[1].replace(/[\s-]/g, '');
      if (![7, 11, 12, 13].includes(digits.length)) return { text: 'Für die EAN/GTIN-Prüfziffer brauche ich 7, 11, 12 oder 13 Nutzziffern (EAN-8, UPC, EAN-13, GTIN-14).', source: 'check' };
      const check = eanCheckDigit(digits);
      return { text: `Prüfziffer für ${digits}: **${check}** → vollständiger Code **${digits}${check}**\n\n_Berechnung (EAN/GTIN): Ziffern von rechts abwechselnd mit 3 und 1 gewichten, summieren, Differenz zum nächsten Zehner._`, source: 'check', val: Number(check) };
    }
    if (/^(?:iban|isbn|ean|gtin)\s*(?:prüfen|pruefen|check)?$/i.test(s)) {
      return { text: `Schick mir die Nummer gleich mit, z. B. „${/iban/i.test(s) ? 'IBAN prüfen: DE89 3704 0044 0532 0130 00' : /isbn/i.test(s) ? 'ISBN prüfen: 978-3-16-148410-0' : 'EAN prüfen: 4006381333931'}“. Die Prüfung läuft komplett lokal – nichts verlässt das Gerät.`, source: 'check' };
    }
    return null;
  },
};
