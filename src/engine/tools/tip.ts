import type { Tool } from './types';
import { NUM, clean, fmtEuro, fmtN, toNum } from './shared';

const KEYWORD = /\b(?:trinkgeld|tip|rechnung|aufteilen|teilen|pro\s+(?:person|kopf|nase)|personen|leute|köpfe|koepfe|gäste|gaeste|freunde)\b/i;
const PERSONS = new RegExp('(?:auf|durch|für|fuer|unter|zu|mit|zwischen)?\\s*' + NUM + '\\s*(?:personen|person|leute|köpfe|koepfe|köpfen|gäste|gaeste|freunde|freunden|mann|nasen|teilnehmer|leuten)', 'i');

export const tipTool: Tool = {
  id: 'tip',
  label: 'Trinkgeld & Rechnung teilen',
  help: '- **Trinkgeld & Teilen:** „86 € mit 10 % Trinkgeld auf 4 Personen“, „Rechnung 120 € durch 3“, „Trinkgeld für 45 €“',
  run(input) {
    const s = clean(input);
    if (!KEYWORD.test(s)) return null;
    const amountMatch = s.match(new RegExp(NUM + '\\s*(?:€|euro|eur)', 'i'))
      || s.match(new RegExp('(?:rechnung|betrag|summe)\\s*(?:von|über|ueber|:)?\\s*' + NUM, 'i'))
      || s.match(new RegExp('(?:trinkgeld|tip)\\s*(?:für|fuer|auf|bei|von)\\s*' + NUM, 'i'));
    if (!amountMatch) return null;
    const amount = toNum(amountMatch[1]);
    if (!(amount > 0)) return null;
    const pctMatch = s.match(new RegExp(NUM + '\\s*(?:%|prozent)', 'i'));
    const percent = pctMatch ? toNum(pctMatch[1]) : null;
    let persons: number | null = null;
    const personsMatch = s.match(PERSONS);
    if (personsMatch) persons = Math.round(toNum(personsMatch[1]));
    else {
      const m = s.replace(amountMatch[0], ' ').replace(pctMatch ? pctMatch[0] : '\u0000', ' ')
        .match(new RegExp('(?:auf|durch|unter|zwischen|zu)\\s*' + NUM + '(?:\\s|$)', 'i'));
      if (m) persons = Math.round(toNum(m[1]));
    }
    if (persons != null && !(persons >= 1 && persons <= 1000)) return { text: 'Die Personenzahl muss zwischen 1 und 1000 liegen.', source: 'tip' };
    const wantsTip = /trinkgeld|tip\b/i.test(s) || percent != null;

    if (wantsTip && percent == null) {
      const rows = [5, 10, 15].map((p) => {
        const tip = amount * p / 100;
        const total = amount + tip;
        return `| ${p} % | ${fmtEuro(tip)} | ${fmtEuro(total)} |${persons && persons > 1 ? ` ${fmtEuro(total / persons)} |` : ''}`;
      });
      const head = persons && persons > 1 ? '| Trinkgeld | Betrag | Gesamt | Pro Person |\n|---|---|---|---|' : '| Trinkgeld | Betrag | Gesamt |\n|---|---|---|';
      // Common practice: about 10 %, rounded up to a „glatter“ amount (full euro, or full 5 € for bigger bills).
      const step = amount >= 40 ? 5 : 1;
      const smooth = Math.ceil((amount * 1.1 - 1e-9) / step) * step;
      return {
        text: `**Trinkgeld auf ${fmtEuro(amount)}**\n\n${head}\n${rows.join('\n')}\n\nÜblich in Deutschland sind 5–10 %: Mit „**${fmtEuro(smooth)}**, stimmt so“ gibst du ${fmtEuro(smooth - amount)} (${fmtN((smooth - amount) / amount * 100, 1)} %) Trinkgeld.`,
        source: 'tip',
        val: smooth,
      };
    }
    const tip = percent != null ? amount * percent / 100 : 0;
    const total = amount + tip;
    const lines = [`**${fmtEuro(amount)}${percent != null ? ` + ${fmtN(percent)} % Trinkgeld = ${fmtEuro(total)}` : ''}**`, ''];
    if (percent != null) lines.push(`- Trinkgeld: ${fmtEuro(tip)}`);
    if (persons && persons > 1) {
      const each = total / persons;
      const rounded = Math.ceil(each * 2) / 2;
      lines.push(`- Pro Person (${persons}): **${fmtEuro(each)}**`);
      if (rounded !== each) lines.push(`- Aufgerundet pro Person: ${fmtEuro(rounded)} (zusammen ${fmtEuro(rounded * persons)})`);
      return { text: lines.join('\n'), source: 'tip', val: each };
    }
    if (percent == null) return null;
    const rounded = Math.ceil(total);
    if (rounded !== total) lines.push(`- Aufgerundet: ${fmtEuro(rounded)} (${fmtEuro(rounded - amount)} Trinkgeld)`);
    return { text: lines.join('\n'), source: 'tip', val: total };
  },
};
