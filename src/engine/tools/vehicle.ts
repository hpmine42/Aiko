import type { Tool } from './types';
import { NUM, clean, fmtEuro, fmtN, toNum } from './shared';
import { fmtDuration } from './timecalc';

/* Fuel consumption, trip costs, pace/speed for runners and cyclists, braking distance. */

const paceToText = (secPerKm: number): string => `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')} min/km`;

function parsePace(raw: string): number | null {
  const m = raw.match(/^(\d{1,2})[:.,](\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const DIST_RE = `${NUM}\\s*(km|kilometer|m|meter|mi|meilen?)`;
const KNOWN: Record<string, number> = { marathon: 42.195, halbmarathon: 21.0975, '10k': 10, '10km': 10, '5k': 5, '5km': 5 };

function parseDistanceKm(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (KNOWN[s] != null) return KNOWN[s];
  const m = s.match(new RegExp(`^${DIST_RE}$`, 'i'));
  if (!m) return null;
  const v = toNum(m[1]);
  return /^mi|meile/.test(m[2]) ? v * 1.609344 : /^m(?:eter)?$/.test(m[2]) ? v / 1000 : v;
}

function parseTimeSeconds(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  let m = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  m = s.match(/^(\d{1,3}):(\d{2})\s*(h|std|stunden)?$/);
  if (m) return m[3] ? Number(m[1]) * 3600 + Number(m[2]) * 60 : Number(m[1]) * 60 + Number(m[2]);
  let total = 0;
  let found = false;
  const re = /(\d+(?:[.,]\d+)?)\s*(stunden?|std\.?|h|minuten?|min\.?|m|sekunden?|sek\.?|s)(?=\s|$)/g;
  while ((m = re.exec(s))) {
    const v = toNum(m[1]);
    const unit = m[2];
    total += /^(stunde|std|h)/.test(unit) ? v * 3600 : /^(min|m)/.test(unit) ? v * 60 : v;
    found = true;
  }
  return found && !s.replace(re, '').trim() ? total : null;
}

export const vehicleTool: Tool = {
  id: 'vehicle',
  label: 'Fahrzeug & Sport',
  help: '- **Fahrt & Sport:** „Verbrauch 42 l auf 650 km“, „Spritkosten 300 km bei 6,5 l/100km und 1,75 €“, „Pace 10 km in 52:30“, „Bremsweg bei 100 km/h“, „Zeit für 120 km bei 80 km/h“',
  run(input) {
    const s = clean(input).replace(/\s+/g, ' ');
    let m: RegExpMatchArray | null;

    // „Verbrauch 42 l auf 650 km“ / „650 km mit 42 Litern“ / „Ich habe 42 Liter auf 650 km verbraucht“
    let amount: number | null = null;
    let km: number | null = null;
    if (/verbrauch|getankt|tank|liter|kwh/i.test(s) && !/kosten|preis|€|euro|cent/i.test(s)) {
      if ((m = s.match(new RegExp(`${NUM}\\s*(?:l|liter|kwh)\\b.*?(?:auf|für|fuer|pro|bei)\\s*${NUM}\\s*km`, 'i')))) { amount = toNum(m[1]); km = toNum(m[2]); }
      else if ((m = s.match(new RegExp(`${NUM}\\s*km\\s+(?:mit|bei|und)\\s+${NUM}\\s*(?:l|liter|kwh)\\b`, 'i')))) { km = toNum(m[1]); amount = toNum(m[2]); }
    }
    if (amount != null && km != null) {
      if (km <= 0 || amount <= 0) return null;
      const per100 = amount / km * 100;
      const electric = /kwh/i.test(s);
      return {
        text: `**Verbrauch: ${fmtN(per100, 2)} ${electric ? 'kWh' : 'l'}/100 km** (${fmtN(amount)} ${electric ? 'kWh' : 'Liter'} auf ${fmtN(km)} km)\n\n- Reichweite pro ${electric ? 'kWh' : 'Liter'}: ${fmtN(km / amount, 1)} km\n- Für 100 km: ${fmtN(per100, 2)} ${electric ? 'kWh' : 'l'} · für 1.000 km: ${fmtN(per100 * 10, 1)} ${electric ? 'kWh' : 'l'}${electric ? '' : `\n- Bei 1,75 €/l: ${fmtEuro(per100 * 1.75)} je 100 km · CO₂ ≈ ${fmtN(per100 * (/diesel/i.test(s) ? 2.65 : 2.37) * 10, 0)} g/km`}\n\n_Tipp: „Spritkosten 300 km bei ${fmtN(per100, 1)} l/100km und 1,75 €“ rechnet eine Fahrt durch._`,
        source: 'vehicle',
        val: Math.round(per100 * 100) / 100,
      };
    }
    // „Spritkosten 300 km bei 6,5 l/100km und 1,75 €“ / „Was kostet eine Fahrt von 450 km bei 7 Litern und 1,80 Euro?“
    if (/sprit|benzin|diesel|tank|kraftstoff|fahrtkosten|fahrt|strom(?:kosten)?|kostet/i.test(s)) {
      const km = s.match(new RegExp(`${NUM}\\s*km\\b`, 'i'));
      const cons = s.match(new RegExp(`${NUM}\\s*(?:l|liter|kwh)(?:\\s*(?:/|pro|auf)\\s*100\\s*km)?`, 'i'));
      const price = s.match(new RegExp(`${NUM}\\s*(?:€|euro|eur|ct|cent)(?:\\s*(?:/|pro|je)\\s*(?:l|liter|kwh))?`, 'i'));
      if (km && cons && price) {
        const distance = toNum(km[1]);
        const per100 = toNum(cons[1]);
        let unitPrice = toNum(price[1]);
        if (/ct|cent/i.test(price[0])) unitPrice /= 100;
        const amount = distance * per100 / 100;
        const cost = amount * unitPrice;
        const persons = s.match(/(\d+)\s*(?:personen|leute|mitfahrer)/i);
        const roundTrip = /hin\s*(?:und|&)\s*zurück|hin-?\s*und\s*rückfahrt/i.test(s);
        const electric = /kwh/i.test(cons[0]);
        const lines = [`**${roundTrip ? 'Hin und zurück' : 'Fahrt'}: ${fmtEuro(roundTrip ? cost * 2 : cost)}**`, '', `- Strecke: ${fmtN(roundTrip ? distance * 2 : distance)} km bei ${fmtN(per100)} ${electric ? 'kWh' : 'l'}/100 km → ${fmtN(roundTrip ? amount * 2 : amount, 1)} ${electric ? 'kWh' : 'Liter'}`, `- Preis: ${fmtN(unitPrice, 3)} €/${electric ? 'kWh' : 'l'} → ${fmtN(per100 * unitPrice / 100, 3)} € pro km`];
        if (persons) lines.push(`- Pro Person (${persons[1]}): ${fmtEuro((roundTrip ? cost * 2 : cost) / Number(persons[1]))}`);
        if (!electric) lines.push(`- CO₂ ≈ ${fmtN((roundTrip ? amount * 2 : amount) * (/diesel/i.test(s) ? 2.65 : 2.37), 1)} kg`);
        lines.push('', '_Pauschale zum Vergleich: 0,30 €/km Entfernungspauschale (ab dem 21. km 0,38 €) – für Steuer, nicht für echte Kosten._');
        return { text: lines.join('\n'), source: 'vehicle', val: Math.round((roundTrip ? cost * 2 : cost) * 100) / 100 };
      }
    }
    // „Zeit für 120 km bei 80 km/h“ / „Wie lange brauche ich für 450 km bei 110 km/h“
    if ((m = s.match(new RegExp(`(?:zeit|dauer|wie\\s+lange?)\\b.*?${NUM}\\s*km\\b.*?(?:bei|mit)\\s*${NUM}\\s*(?:km/h|kmh|km\\s*pro\\s*stunde|stundenkilometer)`, 'i')))) {
      const km = toNum(m[1]);
      const speed = toNum(m[2]);
      if (speed <= 0) return null;
      const minutes = km / speed * 60;
      return { text: `**${fmtN(km)} km bei ${fmtN(speed)} km/h dauern ${fmtDuration(minutes)}** (${fmtN(km / speed, 2)} h).\n\n- Mit 10 % Pausen/Stau: ${fmtDuration(minutes * 1.1)}\n- Bei ${fmtN(speed + 20)} km/h: ${fmtDuration(km / (speed + 20) * 60)} · bei ${fmtN(Math.max(speed - 20, 10))} km/h: ${fmtDuration(km / Math.max(speed - 20, 10) * 60)}`, source: 'vehicle', val: Math.round(minutes) };
    }
    // „Wie weit komme ich in 2,5 Stunden bei 90 km/h“ / „Strecke bei 25 km/h in 3 Stunden“
    if ((m = s.match(new RegExp(`(?:weit|strecke|distanz|entfernung)\\b.*?(?:${NUM}\\s*(?:km/h|kmh)\\b.*?in\\s+(.+)|in\\s+(.+?)\\s+(?:bei|mit)\\s+${NUM}\\s*(?:km/h|kmh))`, 'i')))) {
      const speed = toNum(m[1] || m[4]);
      const secs = parseTimeSeconds((m[2] || m[3]).replace(/\s*(?:km\/h|kmh).*$/i, ''));
      if (secs == null || speed <= 0) return null;
      const km = speed * secs / 3600;
      return { text: `**${fmtN(km, 1)} km** schaffst du bei ${fmtN(speed)} km/h in ${fmtDuration(secs / 60)}.`, source: 'vehicle', val: Math.round(km * 10) / 10 };
    }
    // „Bremsweg bei 100 km/h“ / „Anhalteweg 50 km/h“
    if ((m = s.match(new RegExp(`^(?:brems|anhalte|reaktions)weg\\s*(?:bei|mit|aus|für|fuer)?\\s*${NUM}\\s*(?:km/h|kmh)?(?:\\s*(?:bei\\s+)?(nässe|naesse|regen|gefahr(?:en)?bremsung|notbremsung))?$`, 'i')))) {
      const v = toNum(m[1]);
      const reaction = v / 10 * 3;
      const normal = (v / 10) ** 2;
      const emergency = normal / 2;
      const wet = normal * 2;
      const mod = (m[2] || '').toLowerCase();
      const stopping = reaction + (/nässe|naesse|regen/.test(mod) ? wet : /gefahr|not/.test(mod) ? emergency : normal);
      return {
        text: `**Anhalteweg bei ${fmtN(v)} km/h: ≈ ${fmtN(stopping, 0)} m** (Faustformel${mod ? `, ${mod}` : ''})\n\n- Reaktionsweg (1 s): (${fmtN(v)} ÷ 10) × 3 = ${fmtN(reaction, 0)} m\n- Bremsweg normal: (${fmtN(v)} ÷ 10)² = ${fmtN(normal, 0)} m\n- Gefahrenbremsung: ${fmtN(emergency, 0)} m · bei Nässe ≈ ${fmtN(wet, 0)} m\n- Geschwindigkeit: ${fmtN(v / 3.6, 1)} m/s\n\n_Faustformeln aus der Fahrschule – tatsächliche Werte hängen von Reifen, Straße und Fahrzeug ab._`,
        source: 'vehicle',
        val: Math.round(stopping),
      };
    }
    // „Pace 10 km in 52:30“ / „Pace für Halbmarathon in 1:45:00“ / „Tempo 5:30 min/km auf 10 km“
    if ((m = s.match(/^(?:pace|tempo|lauf(?:tempo|zeit)?|schnitt|durchschnitt(?:stempo|sgeschwindigkeit)?)\s*(?:für|fuer|bei|von|:)?\s*(.+?)\s+in\s+(.+)$/i))) {
      const km = parseDistanceKm(m[1]);
      const secs = parseTimeSeconds(m[2]);
      if (km == null || secs == null || km <= 0 || secs <= 0) return null;
      const pace = secs / km;
      const speed = km / (secs / 3600);
      const splits = [5, 10, 21.0975, 42.195].filter((d) => Math.abs(d - km) > 0.01).map((d) => `${d === 21.0975 ? 'Halbmarathon' : d === 42.195 ? 'Marathon' : `${d} km`}: ${fmtDuration(pace * d / 60)}`);
      return {
        text: `**Pace: ${paceToText(pace)}** · ${fmtN(speed, 2)} km/h (${fmtN(km, 3).replace(/,?0+$/, '')} km in ${fmtDuration(secs / 60, true)})\n\n- Bei gleichem Tempo: ${splits.join(' · ')}\n- Pro 400 m: ${fmtDuration(pace * 0.4 / 60, true)} · pro Meile: ${paceToText(pace * 1.609344).replace('/km', '/mi')}`,
        source: 'vehicle',
        val: Math.round(speed * 100) / 100,
      };
    }
    if ((m = s.match(new RegExp(`^(?:pace|tempo)\\s*(?:von|:)?\\s*(\\d{1,2}[:.,]\\d{2})\\s*(?:min/km|min\\s*pro\\s*km|pro\\s*km)?\\s*(?:auf|für|fuer|bei)\\s+(.+)$`, 'i')))) {
      const pace = parsePace(m[1]);
      const km = parseDistanceKm(m[2]);
      if (pace == null || km == null) return null;
      return { text: `**${m[2].trim()} bei ${paceToText(pace)}: ${fmtDuration(pace * km / 60, true)}** (${fmtN(3600 / pace, 2)} km/h)`, source: 'vehicle', val: Math.round(pace * km / 60) };
    }
    // „km/h in min/km: 12 km/h“ / „12 km/h als pace“
    if ((m = s.match(new RegExp(`^${NUM}\\s*(?:km/h|kmh)\\s+(?:in|als)\\s+(?:pace|min/km|min\\s*pro\\s*km)$`, 'i')))) {
      const speed = toNum(m[1]);
      if (speed <= 0) return null;
      return { text: `**${fmtN(speed)} km/h = ${paceToText(3600 / speed)}**`, source: 'vehicle', val: Math.round(3600 / speed) };
    }
    return null;
  },
};
