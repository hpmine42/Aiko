import type { Tool, ToolResult } from './types';
import { NUM, clean, fmtEuro, fmtN, toNum } from './shared';

export interface YearRow { year: number; interest: number; principal: number; balance: number }
export interface Amortization { payment: number; months: number; totalInterest: number; totalPaid: number; rows: YearRow[]; openEnded: boolean }

/** Monthly annuity for principal K, nominal yearly rate p (%), n months. */
export function annuity(principal: number, yearlyRate: number, months: number): number {
  const i = yearlyRate / 100 / 12;
  if (i === 0) return principal / months;
  return principal * i / (1 - (1 + i) ** -months);
}

/** Simulates the loan month by month and aggregates per year. */
export function amortize(principal: number, yearlyRate: number, payment: number, maxMonths = 100 * 12): Amortization {
  const i = yearlyRate / 100 / 12;
  let balance = principal;
  let months = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  const rows: YearRow[] = [];
  let yearInterest = 0;
  let yearPrincipal = 0;
  while (balance > 0.005 && months < maxMonths) {
    const interest = balance * i;
    const due = Math.min(payment, balance + interest);
    const principalPart = due - interest;
    balance -= principalPart;
    months += 1;
    totalInterest += interest;
    totalPaid += due;
    yearInterest += interest;
    yearPrincipal += principalPart;
    if (months % 12 === 0 || balance <= 0.005) {
      rows.push({ year: Math.ceil(months / 12), interest: yearInterest, principal: yearPrincipal, balance: Math.max(0, balance) });
      yearInterest = 0;
      yearPrincipal = 0;
    }
  }
  return { payment, months, totalInterest, totalPaid, rows, openEnded: balance > 0.005 };
}

function durationWords(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} ${years === 1 ? 'Jahr' : 'Jahre'}`);
  if (rest) parts.push(`${rest} ${rest === 1 ? 'Monat' : 'Monate'}`);
  return parts.join(' und ') || '0 Monate';
}

function table(rows: YearRow[]): string {
  let shown = rows;
  if (rows.length > 30) shown = rows.filter((row, index) => row.year % 5 === 0 || index === rows.length - 1 || index === 0);
  return `| Jahr | Zinsen | Tilgung | Restschuld |\n|---|---|---|---|\n${shown.map((row) => `| ${row.year} | ${fmtEuro(row.interest)} | ${fmtEuro(row.principal)} | ${fmtEuro(row.balance)} |`).join('\n')}`;
}

const KEYWORD = /\b(?:kredit|darlehen|finanzierung|baufinanzierung|hypothek|annuität|annuitaet|annuitätendarlehen|ratenkredit|autokredit|monatsrate|tilgungsplan|tilgung)\b/i;

function pct(text: string, re: RegExp): number | null {
  const m = text.match(re);
  return m ? toNum(m[1]) : null;
}

export const loanTool: Tool = {
  id: 'loan',
  label: 'Kreditrechner',
  help: '- **Kredit:** „20.000 € Kredit mit 4 % über 5 Jahre“ oder „Darlehen 300.000 € mit 3,5 % Zinsen und 2 % Tilgung“ – Monatsrate, Zinsen, Tilgungsplan',
  run(input) {
    const s = clean(input).replace(/\s+p\.?\s?a\.?/gi, ' ').replace(/(\d)\s*(?:tsd|t)\b\.?/gi, '$1000').replace(/(\d)\s*k\b/gi, '$1000');
    if (!KEYWORD.test(s)) return null;
    const amountMatch = s.match(new RegExp(NUM + '\\s*(?:€|euro|eur)', 'i'))
      || s.match(new RegExp('(?:kredit|darlehen|finanzierung|hypothek)\\s*(?:über|ueber|von|in\\s+höhe\\s+von|:)?\\s*' + NUM, 'i'))
      || s.match(new RegExp(NUM + '\\s*(?:kredit|darlehen)', 'i'));
    if (!amountMatch) return null;
    const principal = toNum(amountMatch[1]);
    if (!(principal > 0)) return null;
    const repayment = pct(s, new RegExp('(?:anfangs)?tilgung(?:ssatz)?\\s*(?:von\\s+)?' + NUM + '\\s*(?:%|prozent)', 'i'))
      ?? pct(s, new RegExp(NUM + '\\s*(?:%|prozent)\\s*(?:anfangs)?tilgung', 'i'));
    const percents = [...s.matchAll(new RegExp(NUM + '\\s*(?:%|prozent)', 'gi'))].map((m) => ({ value: toNum(m[1]), index: m.index || 0 }));
    const interestEntry = percents.find((entry) => {
      const after = s.slice(entry.index, entry.index + 40).toLowerCase();
      const before = s.slice(Math.max(0, entry.index - 20), entry.index).toLowerCase();
      return !/^\S*\s*(?:%|prozent)\s*(?:anfangs)?tilgung/.test(after) && !/tilgung\S*\s*(?:von\s+)?$/.test(before);
    });
    if (!interestEntry) return { text: 'Dafür brauche ich noch den Zinssatz, z. B. „20.000 € Kredit mit 4 % über 5 Jahre“.', source: 'loan' };
    const rate = interestEntry.value;
    const yearsMatch = s.match(new RegExp(NUM + '\\s*(?:jahre?n?|j\\.)', 'i'));
    const monthsMatch = s.match(new RegExp(NUM + '\\s*(?:monate?n?|raten)', 'i'));
    const months = monthsMatch ? Math.round(toNum(monthsMatch[1])) : yearsMatch ? Math.round(toNum(yearsMatch[1]) * 12) : null;

    let result: Amortization;
    let headline: string;
    if (months && months > 0) {
      if (months > 1200) return { text: 'Laufzeiten über 100 Jahre rechne ich nicht.', source: 'loan' };
      const payment = annuity(principal, rate, months);
      result = amortize(principal, rate, payment, months + 1);
      headline = `**Kredit ${fmtEuro(principal)} · ${fmtN(rate)} % Zinsen · ${durationWords(months)}**`;
    } else if (repayment != null && repayment > 0) {
      const payment = principal * (rate + repayment) / 100 / 12;
      result = amortize(principal, rate, payment);
      headline = `**Darlehen ${fmtEuro(principal)} · ${fmtN(rate)} % Zinsen · ${fmtN(repayment)} % Anfangstilgung**`;
    } else {
      return { text: 'Dafür brauche ich noch die Laufzeit („über 5 Jahre“, „60 Monate“) oder eine Anfangstilgung („mit 2 % Tilgung“).', source: 'loan' };
    }
    const lines = [
      headline,
      '',
      `- Monatsrate: **${fmtEuro(result.payment)}**`,
      `- Laufzeit: ${durationWords(result.months)} (${fmtN(result.months)} Raten)${result.openEnded ? ' – **nicht vollständig getilgt** (Rate zu niedrig)' : ''}`,
      `- Gesamt gezahlt: ${fmtEuro(result.totalPaid)}`,
      `- davon Zinsen: **${fmtEuro(result.totalInterest)}**`,
      '',
      table(result.rows),
      '',
      '_Annuitätendarlehen mit monatlicher Rate und monatlicher Zinsverrechnung (Nominalzins ÷ 12). Ohne Gebühren, Sondertilgungen oder Zinsänderungen – eine Rechenhilfe, keine Beratung._',
    ];
    const answer: ToolResult = { text: lines.join('\n'), source: 'loan', val: result.payment };
    return answer;
  },
};
