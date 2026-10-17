import type { Tool, ToolContext } from './types';
import { fmtN } from './shared';

/* Nutzungsstatistik als Diagramm – zeigt, welche Werkzeuge und Regeln wie oft geantwortet haben.
   Läuft komplett lokal über config.stats (localStorage), ohne Netzwerk. */

const QUERY = /^(?:meine\s+statistik|(?:meine\s+)?(?:nutzungs|verwendungs|benutzungs)statistik|statistik\s+(?:meiner\s+)?(?:nutzung|verwendung)|statistik\s+(?:anzeigen|zeigen))(?:\s+(?:anzeigen|zeigen|als\s+diagramm))?\s*$/i;

const esc = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Horizontales Balkendiagramm als eigenständiges SVG (dunkel-auf-hell, wie die Diagramm-Werkzeuge). */
function barSvg(rows: Array<{ label: string; value: number }>): string {
  const rowHeight = 34;
  const labelWidth = 210;
  const width = 540;
  const height = 12 + rows.length * rowHeight + 6;
  const max = Math.max(...rows.map((row) => row.value));
  const barMax = width - labelWidth - 56;
  const font = 'font-family="system-ui,-apple-system,Segoe UI,sans-serif"';
  let body = '';
  rows.forEach((row, i) => {
    const y = 8 + i * rowHeight;
    const w = Math.max(3, Math.round(row.value / max * barMax));
    const label = row.label.length > 26 ? `${row.label.slice(0, 25)}…` : row.label;
    body += `<text x="0" y="${y + 15}" font-size="13" fill="#333" ${font}>${esc(label)}</text>` +
      `<rect x="${labelWidth}" y="${y}" width="${w}" height="19" rx="4" fill="#2c67c5"/>` +
      `<text x="${labelWidth + w + 8}" y="${y + 15}" font-size="13" font-weight="600" fill="#333" ${font}>${fmtN(row.value)}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>`;
}

function total(entries: Array<[string, number]>): number {
  return entries.reduce((sum, [, count]) => sum + count, 0);
}

function topRules(context: ToolContext, limit: number): Array<{ title: string; count: number }> {
  return Object.entries(context.config.stats?.rules || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => {
      const rule = context.config.pairs.find((pair) => pair.id === id);
      const title = rule?.patterns[0] || rule?.response || id;
      return { title: title.slice(0, 40), count };
    });
}

export const usageTool: Tool = {
  id: 'usage',
  label: 'Statistik-Dashboard',
  help: '- **Statistik-Dashboard:** „Meine Statistik“ zeigt, welche Werkzeuge und Regeln wie oft geantwortet haben – als Diagramm',
  run(input, context) {
    const s = input.trim().replace(/\s+/g, ' ');
    if (!QUERY.test(s)) return null;

    const labels = context.labels || {};
    const toolEntries = Object.entries(context.config.stats?.tools || {})
      .filter(([id]) => id !== 'usage')
      .sort((a, b) => b[1] - a[1]);
    const rules = topRules(context, 3);
    const toolTotal = total(toolEntries);
    const ruleTotal = total(Object.entries(context.config.stats?.rules || {}));

    if (!toolTotal && !ruleTotal) {
      return {
        text: 'Ich habe noch nichts für dich beantwortet – daher ist die Statistik leer. Frag mich etwas oder leg eine Regel an; ich zähle dann mit, was wie oft geantwortet hat. 🔍',
        source: 'usage',
      };
    }

    const lines: string[] = [`**Deine Aiko-Statistik** – ${fmtN(toolTotal + ruleTotal)} Antworten insgesamt: ${fmtN(toolTotal)} aus Werkzeugen, ${fmtN(ruleTotal)} aus eigenen Regeln.`];
    if (rules.length) {
      lines.push('', '**Meistgenutzte eigene Regeln:**');
      rules.forEach((rule, i) => lines.push(`${i + 1}. „${rule.title}“ – ${fmtN(rule.count)}×`));
    }
    const top = toolEntries[0];
    if (top) lines.push('', `Spitzenreiter unter den Werkzeugen: **${labels[top[0]] || top[0]}** (${fmtN(top[1])}×).`, '', 'Das Diagramm zeigt deine meistgenutzten Werkzeuge – mit „Bild speichern“ lädst du es als PNG.');
    else lines.push('', 'Noch keine Werkzeug-Antworten erfasst.');

    const rows = toolEntries.slice(0, 8).map(([id, count]) => ({ label: labels[id] || id, value: count }));
    return {
      text: lines.join('\n'),
      source: 'usage',
      widget: rows.length ? { type: 'chart', svg: barSvg(rows), label: 'Nutzungsstatistik' } : null,
    };
  },
};
