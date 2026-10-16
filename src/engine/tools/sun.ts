import type { Tool, ToolResult } from './types';
import { DAY_MS, clean, fmtDay, fmtN, parseDate, todayUTC } from './shared';
import { findCity, parseCoords, type City } from './cities';

/* Sunrise/sunset from the classic sunrise equation (Meeus/NOAA style, accurate to a few minutes). */

const RAD = Math.PI / 180;
const sin = (deg: number): number => Math.sin(deg * RAD);
const cos = (deg: number): number => Math.cos(deg * RAD);
const asin = (v: number): number => Math.asin(v) / RAD;
const acos = (v: number): number => Math.acos(v) / RAD;
const J2000 = 2451545;
const jdToMs = (jd: number): number => (jd - 2440587.5) * DAY_MS;

export interface SunTimes {
  rise: number | null;
  set: number | null;
  noon: number;
  dawn: number | null;
  dusk: number | null;
  /** Length of daylight in minutes (0 in polar night, 1440 under the midnight sun). */
  dayMinutes: number;
  polar: 'day' | 'night' | null;
  /** Solar declination in degrees. */
  declination: number;
}

/** `dayUtc` is 00:00 UTC of the calendar date; `lon` is east-positive. */
export function sunTimes(dayUtc: number, lat: number, lon: number): SunTimes {
  const jd0 = dayUtc / DAY_MS + 2440587.5;
  const n = Math.round(jd0 - J2000 + 0.5);
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = J2000 + jStar + 0.0053 * sin(M) - 0.0069 * sin(2 * lambda);
  const declination = asin(sin(lambda) * sin(23.4397));
  const hourAngle = (altitude: number): number | null => {
    const v = (sin(altitude) - sin(lat) * sin(declination)) / (cos(lat) * cos(declination));
    if (v > 1) return -1;          // never above that altitude
    if (v < -1) return 361;        // never below
    return acos(v);
  };
  const w0 = hourAngle(-0.833);
  const w6 = hourAngle(-6);
  const noon = jdToMs(jTransit);
  const polar = w0 === -1 ? 'night' : w0 === 361 ? 'day' : null;
  const rise = polar ? null : jdToMs(jTransit - w0! / 360);
  const set = polar ? null : jdToMs(jTransit + w0! / 360);
  const dawn = w6 === -1 || w6 === 361 ? null : jdToMs(jTransit - w6! / 360);
  const dusk = w6 === -1 || w6 === 361 ? null : jdToMs(jTransit + w6! / 360);
  const dayMinutes = polar === 'night' ? 0 : polar === 'day' ? 1440 : Math.round((w0! * 2) / 360 * 1440);
  return { rise, set, noon, dawn, dusk, dayMinutes, polar, declination };
}

export function fmtTimeIn(ms: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(ms));
  } catch {
    return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
  }
}

export const fmtMinutes = (minutes: number): string => `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, '0')} min`;

const LOCAL_TZ = (): string => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'; } catch { return 'Europe/Berlin'; } };

interface Place { label: string; lat: number; lon: number; tz: string }

function resolvePlace(raw: string | null, home: string | undefined): Place | null | 'ask' {
  const text = (raw || '').trim();
  if (text) {
    const city = findCity(text);
    if (city) return { label: city.name, lat: city.lat, lon: city.lon, tz: city.tz };
    const coords = parseCoords(text.replace(/^(?:bei|an|auf)\s+/i, ''));
    if (coords) return { label: `${fmtN(Math.abs(coords.lat), 2)}° ${coords.lat < 0 ? 'S' : 'N'}, ${fmtN(Math.abs(coords.lon), 2)}° ${coords.lon < 0 ? 'W' : 'O'}`, lat: coords.lat, lon: coords.lon, tz: LOCAL_TZ() };
    return null;
  }
  const city: City | null = home ? findCity(home) : null;
  if (city) return { label: city.name, lat: city.lat, lon: city.lon, tz: city.tz };
  return 'ask';
}

function report(place: Place, dayUtc: number, today: number, focus: 'rise' | 'set' | 'length' | 'all'): ToolResult {
  const t = sunTimes(dayUtc, place.lat, place.lon);
  const before = sunTimes(dayUtc - DAY_MS, place.lat, place.lon);
  const delta = t.dayMinutes - before.dayMinutes;
  const when = dayUtc === today ? 'heute' : dayUtc === today + DAY_MS ? 'morgen' : `am ${fmtDay(dayUtc)}`;
  const head = `${t.polar === 'night' ? '🌑' : t.polar === 'day' ? '🌞' : focus === 'set' ? '🌇' : '🌅'} **Sonne in ${place.label} – ${fmtDay(dayUtc)}**`;
  const lines: string[] = [head, ''];
  if (t.polar === 'night') lines.push(`- **Polarnacht:** Die Sonne geht ${when} nicht über den Horizont.`);
  else if (t.polar === 'day') lines.push(`- **Mitternachtssonne:** Die Sonne geht ${when} nicht unter.`);
  else {
    lines.push(`- Sonnenaufgang: **${fmtTimeIn(t.rise!, place.tz)} Uhr**`);
    lines.push(`- Sonnenhöchststand: ${fmtTimeIn(t.noon, place.tz)} Uhr`);
    lines.push(`- Sonnenuntergang: **${fmtTimeIn(t.set!, place.tz)} Uhr**`);
  }
  lines.push(`- Tageslänge: **${fmtMinutes(t.dayMinutes)}**${delta ? ` (${delta > 0 ? '+' : '−'}${Math.abs(delta)} min gegenüber dem Vortag)` : ''}`);
  if (t.dawn != null && t.dusk != null) lines.push(`- Bürgerliche Dämmerung: ${fmtTimeIn(t.dawn, place.tz)} – ${fmtTimeIn(t.dusk, place.tz)} Uhr`);
  if (focus === 'length' || focus === 'all') {
    const solstice = sunTimes(Date.UTC(new Date(dayUtc).getUTCFullYear(), 5, 21), place.lat, place.lon).dayMinutes;
    const winter = sunTimes(Date.UTC(new Date(dayUtc).getUTCFullYear(), 11, 21), place.lat, place.lon).dayMinutes;
    lines.push('', `Zum Vergleich: längster Tag etwa ${fmtMinutes(Math.max(solstice, winter))}, kürzester etwa ${fmtMinutes(Math.min(solstice, winter))}.`);
  }
  lines.push('', `_Berechnet aus den Koordinaten (${fmtN(Math.abs(place.lat), 2)}° ${place.lat < 0 ? 'S' : 'N'}, ${fmtN(Math.abs(place.lon), 2)}° ${place.lon < 0 ? 'W' : 'O'}), Zeiten in der Zeitzone ${place.tz} – auf wenige Minuten genau, ohne Horizont und Wetter._`);
  return { text: lines.join('\n'), source: 'sun', val: t.dayMinutes };
}

const PLACE = '(?:\\s+(?:in|für|fuer|bei|auf)\\s+(?!am\\b)(.+?))?';
const DATE = '(?:\\s+(?:am|an|für|fuer)\\s+(.+?)|\\s+(heute|morgen|übermorgen|uebermorgen))?';

export const sunTool: Tool = {
  id: 'sun',
  label: 'Sonnenauf- & -untergang',
  help: '- **Sonne:** „Wann geht die Sonne unter?“, „Sonnenaufgang in Hamburg“, „Tageslänge in Tromsø am 21.12.“ – Heimatort in den Einstellungen',
  run(input, context) {
    const s = clean(input);
    const today = todayUTC(context.now());
    let m: RegExpMatchArray | null;
    let focus: 'rise' | 'set' | 'length' | 'all' = 'all';
    let placeText: string | null = null;
    let dateText: string | null = null;

    if ((m = s.match(new RegExp(`^(?:wann\\s+geht\\s+(?:heute\\s+|morgen\\s+)?die\\s+sonne\\s+(auf|unter)|um\\s+wie\\s*viel\\s+uhr\\s+geht\\s+die\\s+sonne\\s+(auf|unter))${PLACE}${DATE}$`, 'i')))) {
      focus = (m[1] || m[2]).toLowerCase() === 'auf' ? 'rise' : 'set';
      placeText = m[3] || null; dateText = m[4] || m[5] || null;
      if (/\bmorgen\b/i.test(s) && !dateText) dateText = 'morgen';
    } else if ((m = s.match(new RegExp(`^(?:der\\s+|die\\s+)?(sonnenaufgang|sonnenuntergang|tageslänge|tageslaenge|sonnenstand|sonnenzeiten|dämmerung|daemmerung|sonne)${PLACE}${DATE}$`, 'i')))) {
      const kind = m[1].toLowerCase();
      focus = kind === 'sonnenaufgang' ? 'rise' : kind === 'sonnenuntergang' ? 'set' : kind.startsWith('tagesl') ? 'length' : 'all';
      if (kind === 'sonne' && !m[2] && !m[3] && !m[4]) return null;
      placeText = m[2] || null; dateText = m[3] || m[4] || null;
    } else if ((m = s.match(new RegExp(`^wie\\s+lang(?:e)?\\s+ist\\s+der\\s+tag${PLACE}${DATE}$`, 'i')))) {
      focus = 'length'; placeText = m[1] || null; dateText = m[2] || m[3] || null;
    } else if ((m = s.match(new RegExp(`^wann\\s+wird\\s+es\\s+(hell|dunkel)${PLACE}${DATE}$`, 'i')))) {
      focus = m[1].toLowerCase() === 'hell' ? 'rise' : 'set'; placeText = m[2] || null; dateText = m[3] || m[4] || null;
    } else return null;

    // „Sonnenuntergang am 21.6. in Bonn“ – date and place may come in either order.
    if (placeText && !dateText) {
      const swap = placeText.match(/^(.+?)\s+am\s+(.+)$/i);
      if (swap) { placeText = swap[1]; dateText = swap[2]; }
    }
    if (dateText && !placeText) {
      const swap = dateText.match(/^(.+?)\s+(?:in|für|fuer)\s+(.+)$/i);
      if (swap) { dateText = swap[1]; placeText = swap[2]; }
    }
    const dayUtc = dateText ? parseDate(dateText, context.now()) : today;
    if (dayUtc == null) return { text: `Das Datum „${dateText}“ verstehe ich nicht – z. B. „Sonnenuntergang am 21.6.“ oder „… morgen“.`, source: 'sun' };
    const place = resolvePlace(placeText, context.config.homeCity);
    if (place === 'ask') return { text: 'Für welchen Ort? Zum Beispiel „Sonnenuntergang in Bonn“ oder „Sonnenaufgang bei 50,73 7,10“. Wenn du in den Einstellungen einen **Heimatort** einträgst, reicht künftig „Wann geht die Sonne unter?“.', source: 'sun' };
    if (!place) return { text: `„${placeText}“ kenne ich nicht. Ich habe die Koordinaten größerer Städte in Deutschland, Europa und weltweit gespeichert – oder du gibst Koordinaten an: „Sonnenuntergang bei 50,73 7,10“.`, source: 'sun' };
    return report(place, dayUtc, today, focus);
  },
};
