import type { Tool } from './types';
import { clean, fmtEuro, fmtN, NUM, reorder, toNum } from './shared';

/* Savings plans, withdrawal plans, inflation / purchasing power, rule of 72, CAGR. */

const RATE = `${NUM}\\s*(?:%|prozent)`;
const MONEY = `${NUM}\\s*(?:€|euro|eur|tsd|k)?`;

export function futureValue(start: number, monthly: number, ratePct: number, years: number): number {
  const i = ratePct / 100 / 12;
  const n = Math.round(years * 12);
  if (i === 0) return start + monthly * n;
  return start * (1 + i) ** n + monthly * (((1 + i) ** n - 1) / i);
}

export function monthsToGoal(goal: number, start: number, monthly: number, ratePct: number): number | null {
  const i = ratePct / 100 / 12;
  if (start >= goal) return 0;
  if (i === 0) return monthly > 0 ? Math.ceil((goal - start) / monthly) : null;
  if (monthly <= 0 && start <= 0) return null;
  const n = Math.log((goal * i + monthly) / (start * i + monthly)) / Math.log(1 + i);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null;
}

export function withdrawalMonths(capital: number, monthly: number, ratePct: number): number | null {
  const i = ratePct / 100 / 12;
  if (monthly <= 0) return null;
  if (i === 0) return Math.ceil(capital / monthly);
  if (monthly <= capital * i) return Infinity;              // interest covers the withdrawal forever
  return Math.ceil(-Math.log(1 - (capital * i) / monthly) / Math.log(1 + i));
}

export function sustainableWithdrawal(capital: number, ratePct: number, years: number): number {
  const i = ratePct / 100 / 12;
  const n = years * 12;
  if (i === 0) return capital / n;
  return capital * i / (1 - (1 + i) ** -n);
}

const fmtYears = (months: number): string => {
  const y = Math.floor(months / 12);
  const mo = months % 12;
  return y ? `${y} ${y === 1 ? 'Jahr' : 'Jahre'}${mo ? ` ${mo} ${mo === 1 ? 'Monat' : 'Monate'}` : ''}` : `${mo} ${mo === 1 ? 'Monat' : 'Monate'}`;
};

const money = (raw: string, whole: string): number => toNum(raw) * (/\d\s*(?:tsd|k)\b/i.test(whole) ? 1000 : 1);

export const savingsTool: Tool = {
  id: 'savings',
  label: 'Sparen & Vorsorge',
  help: '- **Sparen:** „Sparplan 200 € monatlich, 6 % Zinsen, 20 Jahre“, „Wie lange bis 100.000 € bei 300 € monatlich und 5 %?“, „Entnahmeplan 300.000 € bei 4 % und 1.500 € monatlich“, „Kaufkraft von 1.000 € in 20 Jahren bei 2 % Inflation“, „Verdopplungszeit bei 7 %“',
  run(input) {
    const s = clean(input).replace(/\s+/g, ' ').replace(/€\s*\/\s*monat|euro\s+pro\s+monat|€\s+im\s+monat|€\s+pro\s+monat/gi, '€ monatlich');
    let m: RegExpMatchArray | null;

    // Sparplan: start capital optional, monthly rate, interest, years
    if (/sparplan|sparen|ansparen|sparrate|monatlich|pro\s+monat|etf|fondssparplan|vermögen|vermoegen/i.test(s) && !/entnahme|auszahl|wie\s+lange|bis\s+ich|kaufkraft|inflation|kredit|darlehen|tilg/i.test(s)) {
      const monthly = s.match(new RegExp(`${MONEY}\\s*(?:monatlich|im\\s+monat|pro\\s+monat|jeden\\s+monat|mtl\\.?)`, 'i'));
      const rate = s.match(new RegExp(RATE, 'i'));
      const years = s.match(new RegExp(`${NUM}\\s*(?:jahre?n?|j\\.)`, 'i'));
      const start = s.match(new RegExp(`(?:start(?:kapital)?|anfangs(?:kapital)?|einmalig|einmalanlage|startguthaben|bereits|schon)\\s*(?:von\\s+)?${MONEY}`, 'i')) || s.match(new RegExp(`${MONEY}\\s*(?:start(?:kapital)?|anfangskapital|einmalig|einmalanlage|zu\\s+beginn)`, 'i'));
      if (monthly && rate && years) {
        const rateValue = toNum(monthly[1]) * (/\d\s*(?:tsd|k)\b/i.test(monthly[0]) ? 1000 : 1);
        const pct = toNum(rate[1]);
        const yrs = toNum(years[1]);
        const initial = start ? money(start[1], start[0]) : 0;
        if (yrs <= 0 || yrs > 100 || pct < 0 || pct > 50) return null;
        const fv = futureValue(initial, rateValue, pct, yrs);
        const paid = initial + rateValue * Math.round(yrs * 12);
        const steps = [5, 10, 15, 20, 25, 30, 35, 40].filter((y) => y < yrs);
        const table = [...steps, yrs].map((y) => `| ${fmtN(y)} | ${fmtEuro(initial + rateValue * y * 12)} | ${fmtEuro(futureValue(initial, rateValue, pct, y))} |`);
        return {
          text: `**Nach ${fmtN(yrs)} Jahren: ${fmtEuro(fv)}**\n\n- Eingezahlt: ${fmtEuro(paid)}${initial ? ` (davon ${fmtEuro(initial)} Startkapital)` : ''}\n- Zinsen/Erträge: ${fmtEuro(fv - paid)} (${fmtN((fv - paid) / paid * 100, 1)} % Zuwachs)\n- Monatsrate ${fmtEuro(rateValue)} bei ${fmtN(pct)} % p. a. (monatliche Verzinsung)\n\n| Jahr | Eingezahlt | Guthaben |\n|---|---|---|\n${table.join('\n')}\n\n_Vor Steuern und Kosten; bei 2 % Inflation entspricht das Endkapital heute etwa ${fmtEuro(fv / 1.02 ** yrs)}. Ein Prozentpunkt mehr Rendite ergäbe ${fmtEuro(futureValue(initial, rateValue, pct + 1, yrs))}._`,
          source: 'savings',
          val: Math.round(fv * 100) / 100,
        };
      }
    }
    // Zielsparen: „Wie lange bis 100.000 € bei 300 € monatlich und 5 %?“ / „Wann habe ich 50.000 € bei 200 € im Monat und 4 %“
    if (/wie\s+lange|wann\s+(?:habe|hab)\s+ich|bis\s+ich|dauer/i.test(s) && /monatlich|pro\s+monat|im\s+monat|mtl/i.test(s)) {
      const goal = s.match(new RegExp(`(?:bis|auf|ziel|zu|habe\\s+ich)\\s*(?:ich\\s+|zu\\s+)?${MONEY}(?!\\s*(?:monatlich|im\\s+monat|pro\\s+monat|mtl))`, 'i'));
      const monthly = s.match(new RegExp(`${MONEY}\\s*(?:monatlich|im\\s+monat|pro\\s+monat|mtl\\.?)`, 'i'));
      const rate = s.match(new RegExp(RATE, 'i'));
      const start = s.match(new RegExp(`(?:start(?:kapital)?|anfangskapital|bereits|schon|habe\\s+bereits)\\s*(?:von\\s+)?${MONEY}`, 'i'));
      if (goal && monthly) {
        const target = money(goal[1], goal[0]);
        const rateValue = money(monthly[1], monthly[0]);
        const pct = rate ? toNum(rate[1]) : 0;
        const initial = start ? money(start[1], start[0]) : 0;
        const months = monthsToGoal(target, initial, rateValue, pct);
        if (months == null) return { text: 'Mit diesen Werten wird das Ziel nicht erreicht – Rate oder Zins erhöhen.', source: 'savings' };
        const noInterest = monthsToGoal(target, initial, rateValue, 0);
        return {
          text: `**${fmtEuro(target)} erreichst du in ${fmtYears(months)}** (${fmtN(months)} Monate) bei ${fmtEuro(rateValue)} monatlich${pct ? ` und ${fmtN(pct)} % p. a.` : ' ohne Zinsen'}${initial ? `, Start mit ${fmtEuro(initial)}` : ''}.\n\n- Eingezahlt bis dahin: ${fmtEuro(initial + rateValue * months)}${pct && noInterest ? `\n- Ohne Zinsen wären es ${fmtYears(noInterest)}` : ''}\n- Mit ${fmtEuro(rateValue * 1.5)} monatlich: ${(() => { const n = monthsToGoal(target, initial, rateValue * 1.5, pct); return n == null ? '–' : fmtYears(n); })()}`,
          source: 'savings',
          val: months,
        };
      }
    }
    // Entnahmeplan: „Entnahmeplan 300.000 € bei 4 % und 1.500 € monatlich“ / „Wie lange reichen 300.000 € bei 1.500 € monatlich und 3 %“
    if (/entnahme|auszahlplan|auszahlungsplan|reichen|reicht|aufbrauchen|verzehr|rente\s+aus/i.test(s)) {
      const monthly = s.match(new RegExp(`${MONEY}\\s*(?:monatlich|im\\s+monat|pro\\s+monat|mtl\\.?)`, 'i'));
      const rate = s.match(new RegExp(RATE, 'i'));
      const years = s.match(new RegExp(`(?:über|ueber|für|fuer|auf|lang)\\s*${NUM}\\s*jahre?n?`, 'i'));
      const capitalMatches = [...s.matchAll(new RegExp(MONEY, 'gi'))].filter((x) => !(monthly && x.index === monthly.index) && !(rate && x.index === rate.index) && !(years && x.index !== undefined && years.index !== undefined && x.index >= years.index && x.index <= years.index + years[0].length));
      const capitalMatch = capitalMatches.find((x) => /€|euro|eur|tsd|k\b/i.test(x[0])) || capitalMatches[0];
      if (capitalMatch) {
        const capital = money(capitalMatch[1], capitalMatch[0]);
        const pct = rate ? toNum(rate[1]) : 0;
        if (monthly) {
          const rateValue = money(monthly[1], monthly[0]);
          const months = withdrawalMonths(capital, rateValue, pct);
          if (months == null) return null;
          if (months === Infinity) return { text: `**${fmtEuro(capital)} reichen bei ${fmtN(pct)} % dauerhaft**: Die Zinsen (${fmtEuro(capital * pct / 100 / 12)} pro Monat) decken die Entnahme von ${fmtEuro(rateValue)} ab – das Kapital bleibt erhalten.`, source: 'savings' };
          return {
            text: `**${fmtEuro(capital)} reichen ${fmtYears(months)}** bei ${fmtEuro(rateValue)} monatlich${pct ? ` und ${fmtN(pct)} % Verzinsung` : ' ohne Verzinsung'}.\n\n- Ausgezahlt insgesamt: ≈ ${fmtEuro(rateValue * months)}${pct ? `\n- Ohne Zinsen: ${fmtYears(Math.ceil(capital / rateValue))}` : ''}\n- Ewige Rente (nur Zinsen entnehmen): ${fmtEuro(capital * pct / 100 / 12)} pro Monat\n- Mit 2 % Inflationsausgleich der Rate verkürzt sich die Dauer spürbar._`,
            source: 'savings',
            val: months,
          };
        }
        if (years) {
          const yrs = toNum(years[1]);
          const rateValue = sustainableWithdrawal(capital, pct, yrs);
          return {
            text: `**Aus ${fmtEuro(capital)} kannst du ${fmtN(yrs)} Jahre lang ${fmtEuro(rateValue)} pro Monat entnehmen** (${fmtN(pct)} % Verzinsung, Kapital am Ende aufgebraucht).\n\n- Ohne Zinsen: ${fmtEuro(capital / (yrs * 12))} pro Monat\n- Ewige Rente (Kapitalerhalt): ${fmtEuro(capital * pct / 100 / 12)} pro Monat\n- 4-%-Regel: ${fmtEuro(capital * 0.04 / 12)} pro Monat`,
            source: 'savings',
            val: Math.round(rateValue * 100) / 100,
          };
        }
      }
    }
    // Inflation / Kaufkraft
    if ((m = s.match(new RegExp(`(?:kaufkraft|inflation|wert|was\\s+sind|wie\\s*viel\\s+sind)\\b.*?${MONEY}\\b.*?(?:in|nach)\\s+${NUM}\\s*jahre?n?\\b.*?${RATE}`, 'i')))
      || (m = reorder(s.match(new RegExp(`(?:kaufkraft|inflation)\\b.*?${MONEY}\\b.*?${RATE}.*?(?:in|nach|über|ueber)\\s+${NUM}\\s*jahre?n?`, 'i')), 0, 1, 3, 2))) {
      const amount = money(m[1], m[0]);
      const years = toNum(m[2]);
      const pct = toNum(m[3]);
      const factor = (1 + pct / 100) ** years;
      return {
        text: `**${fmtEuro(amount)} haben in ${fmtN(years)} Jahren bei ${fmtN(pct)} % Inflation die Kaufkraft von heute ${fmtEuro(amount / factor)}.**\n\n- Preissteigerung insgesamt: ${fmtN((factor - 1) * 100, 1)} % – was heute ${fmtEuro(amount)} kostet, kostet dann ${fmtEuro(amount * factor)}\n- Kaufkraftverlust: ${fmtEuro(amount - amount / factor)}\n- Halbierung der Kaufkraft nach ≈ ${fmtN(Math.log(2) / Math.log(1 + pct / 100), 1)} Jahren`,
        source: 'savings',
        val: Math.round(amount / factor * 100) / 100,
      };
    }
    // Rule of 72 / doubling time
    if ((m = s.match(new RegExp(`^(?:verdopplungszeit|verdoppelung|verdopplung|wann\\s+verdoppelt\\s+sich\\s+(?:mein\\s+)?(?:geld|kapital|vermögen|vermoegen)|72er[-\\s]?regel|regel\\s+72)\\s*(?:bei|mit|von|:)?\\s*${RATE}\\s*(?:zinsen|rendite|p\\.?\\s?a\\.?)?\\s*\\??$`, 'i')))) {
      const pct = toNum(m[1]);
      if (pct <= 0) return null;
      const exact = Math.log(2) / Math.log(1 + pct / 100);
      return { text: `**Bei ${fmtN(pct)} % verdoppelt sich das Kapital nach ≈ ${fmtN(exact, 1)} Jahren** (72er-Regel: 72 ÷ ${fmtN(pct)} ≈ ${fmtN(72 / pct, 1)} Jahre).\n\n- Verdreifachung: ${fmtN(Math.log(3) / Math.log(1 + pct / 100), 1)} Jahre · Verzehnfachung: ${fmtN(Math.log(10) / Math.log(1 + pct / 100), 1)} Jahre`, source: 'savings', val: Math.round(exact * 10) / 10 };
    }
    // CAGR: „aus 10.000 wurden 15.000 in 5 Jahren“ / „Rendite von 10.000 auf 15.000 in 5 Jahren“
    if ((m = s.match(new RegExp(`(?:rendite|cagr|wachstum|zuwachs|jahresrendite|verzinsung)?\\s*(?:aus|von)\\s+${MONEY}\\s+(?:wurden|auf|zu|wird|werden)\\s+${MONEY}\\s+(?:in|nach|innerhalb\\s+von|über|ueber)\\s+${NUM}\\s*jahre?n?`, 'i')))) {
      const start = money(m[1], m[0]);
      const end = money(m[2], m[0]);
      const years = toNum(m[3]);
      if (start <= 0 || years <= 0) return null;
      const cagr = ((end / start) ** (1 / years) - 1) * 100;
      return { text: `**Rendite: ${fmtN(cagr, 2)} % pro Jahr** (CAGR) – aus ${fmtEuro(start)} wurden ${fmtEuro(end)} in ${fmtN(years)} Jahren.\n\n- Gesamt: ${fmtN((end / start - 1) * 100, 1)} % (${fmtEuro(end - start)})\n- Einfach gemittelt wären es ${fmtN((end / start - 1) * 100 / years, 2)} % pro Jahr – der Zinseszins drückt die echte Jahresrate.`, source: 'savings', val: Math.round(cagr * 100) / 100 };
    }
    return null;
  },
};
