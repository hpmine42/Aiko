import type { Tool, ToolResult } from './types';
import { fence, fmtN, toNum } from './shared';

/* Data helpers: CSV ↔ Markdown table, JSON → table/CSV, JSON minify & key overview, frequency counts, numbering, line/list conversion. */

export function parseCsv(raw: string): { rows: string[][]; delimiter: string } {
  const text = raw.replace(/\r\n?/g, '\n').trim();
  const firstLine = text.split('\n')[0] || '';
  const candidates = [';', '\t', '|', ','];
  const delimiter = candidates.map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell.trim());
  rows.push(row);
  return { rows: rows.filter((r) => r.some((c) => c !== '')).map((r) => (delimiter === '|' ? r.filter((c, idx) => !(c === '' && (idx === 0 || idx === r.length - 1))) : r)), delimiter };
}

const esc = (cell: string): string => cell.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function markdownTable(rows: string[][]): string {
  if (!rows.length) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')];
  const [head, ...body] = rows.map(pad);
  const numeric = head.map((_, col) => body.length > 0 && body.every((r) => r[col] === '' || /^-?[\d.,]+\s*%?$/.test(r[col])));
  return [`| ${head.map(esc).join(' | ')} |`, `|${numeric.map((n) => (n ? '---:|' : '---|')).join('')}`, ...body.map((r) => `| ${r.map(esc).join(' | ')} |`)].join('\n');
}

function columnStats(rows: string[][]): string[] {
  if (rows.length < 3) return [];
  const [head, ...body] = rows;
  const out: string[] = [];
  head.forEach((name, col) => {
    const values = body.map((r) => r[col]).filter((v) => v !== undefined && v !== '').map((v) => toNum(v.replace(/\s*%$/, '')));
    if (values.length === body.length && values.every((v) => Number.isFinite(v))) {
      const sum = values.reduce((a, b) => a + b, 0);
      out.push(`- **${name || `Spalte ${col + 1}`}:** Summe ${fmtN(sum)} · Ø ${fmtN(sum / values.length, 2)} · min ${fmtN(Math.min(...values))} · max ${fmtN(Math.max(...values))}`);
    }
  });
  return out;
}

const tableResult = (rows: string[][], note: string): ToolResult => {
  const stats = columnStats(rows);
  return { text: `${markdownTable(rows)}\n\n_${rows.length - 1} ${rows.length - 1 === 1 ? 'Datenzeile' : 'Datenzeilen'}, ${Math.max(...rows.map((r) => r.length))} Spalten${note ? ` · ${note}` : ''}._${stats.length ? `\n\n${stats.join('\n')}` : ''}`, source: 'data' };
};

export function parseMarkdownTable(raw: string): string[][] | null {
  const lines = raw.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
  if (lines.length < 2) return null;
  return lines.filter((l) => !/^\|?\s*:?-{2,}/.test(l)).map((l) => l.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|')));
}

const toCsv = (rows: string[][], delimiter = ';'): string => rows.map((r) => r.map((c) => (new RegExp(`[${delimiter}"\n]`).test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(delimiter)).join('\n');

function jsonToRows(value: unknown): string[][] | null {
  const list = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.entries(value as Record<string, unknown>).map(([k, v]) => (typeof v === 'object' && v !== null ? { Schlüssel: k, ...(v as Record<string, unknown>) } : { Schlüssel: k, Wert: v })) : null;
  if (!list || !list.length) return null;
  if (list.every((item) => typeof item !== 'object' || item === null)) return [['Wert'], ...list.map((item) => [String(item)])];
  const keys: string[] = [];
  for (const item of list) if (item && typeof item === 'object') for (const key of Object.keys(item as object)) if (!keys.includes(key)) keys.push(key);
  const cell = (v: unknown): string => (v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  return [keys, ...list.map((item) => keys.map((key) => cell((item as Record<string, unknown>)[key])))];
}

function jsonKeys(value: unknown, prefix = '', out: string[] = [], depth = 0): string[] {
  if (depth > 6 || out.length > 80) return out;
  if (Array.isArray(value)) {
    out.push(`${prefix || '$'}[] – Array mit ${value.length} ${value.length === 1 ? 'Element' : 'Elementen'}`);
    if (value.length) jsonKeys(value[0], `${prefix}[0]`, out, depth + 1);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object') jsonKeys(v, path, out, depth + 1);
      else out.push(`${path}: ${v === null ? 'null' : typeof v}`);
    }
  }
  return out;
}

const splitItems = (raw: string): string[] => (raw.includes('\n') ? raw.split(/\r?\n/) : raw.split(/\s*[,;|]\s*/)).map((x) => x.trim().replace(/^[-*•]\s+|^\d+[.)]\s+/, '')).filter(Boolean);

export const dataTool: Tool = {
  id: 'data',
  label: 'Daten & Tabellen',
  help: '- **Daten:** „CSV als Tabelle: Name;Alter …“, „Tabelle als CSV: | … |“, „JSON als Tabelle: [{…}]“, „JSON minimieren: …“, „JSON-Schlüssel: …“, „Häufigkeit: a, b, a“, „Nummeriere: …“',
  run(input) {
    const raw = input.trim();
    let m: RegExpMatchArray | null;
    if ((m = raw.match(/^(?:csv|tsv|semikolon-?liste)\s*(?:als|in|zu|->|→)\s*(?:markdown-?)?tabelle\s*[:\n]\s*([\s\S]+)$/i)) || (m = raw.match(/^(?:markdown-?)?tabelle\s+aus\s*(?:csv|daten|liste)?\s*[:\n]\s*([\s\S]+)$/i))) {
      const { rows, delimiter } = parseCsv(m[1]);
      if (rows.length < 2 || rows[0].length < 2) return { text: 'Ich brauche mindestens eine Kopfzeile und eine Datenzeile mit mehreren Spalten, z. B. „CSV als Tabelle: Name;Alter\\nAnna;30\\nBen;25“ – Spalten mit ; , Tab oder | trennen, Zeilen mit Zeilenumbruch.', source: 'data' };
      return tableResult(rows, `Trennzeichen „${delimiter === '\t' ? 'Tab' : delimiter}“`);
    }
    if ((m = raw.match(/^(?:markdown-?)?tabelle\s*(?:als|in|zu|->|→)\s*(csv|tsv|semikolon|komma)\s*[:\n]\s*([\s\S]+)$/i))) {
      const rows = parseMarkdownTable(m[2]);
      if (!rows) return { text: 'Bitte eine Markdown-Tabelle mit | Spalten | einfügen.', source: 'data' };
      const delimiter = /tsv/i.test(m[1]) ? '\t' : /komma/i.test(m[1]) ? ',' : ';';
      return { text: `${fence(toCsv(rows, delimiter), 'csv')}\n\n_${rows.length - 1} Datenzeilen, Trennzeichen „${delimiter === '\t' ? 'Tab' : delimiter}“ – zum Kopieren anklicken._`, source: 'data' };
    }
    if ((m = raw.match(/^json\s*(?:als|in|zu|->|→)\s*(tabelle|csv)\s*[:\n]\s*([\s\S]+)$/i))) {
      try {
        const rows = jsonToRows(JSON.parse(m[2]));
        if (!rows) return { text: 'Dafür brauche ich ein JSON-Array oder -Objekt, z. B. `[{"name":"Anna","alter":30},{"name":"Ben","alter":25}]`.', source: 'data' };
        return /csv/i.test(m[1]) ? { text: `${fence(toCsv(rows), 'csv')}\n\n_${rows.length - 1} Datenzeilen._`, source: 'data' } : tableResult(rows, 'aus JSON');
      } catch (error) {
        return { text: `❌ Kein gültiges JSON: \`${String((error as Error).message).replace(/`/g, "'")}\``, source: 'data' };
      }
    }
    if ((m = raw.match(/^(?:json\s+(?:minimieren|minify|komprimieren|verdichten|einzeilig)|minify\s+json|minimiere\s+json)\s*[:\n]\s*([\s\S]+)$/i))) {
      try {
        const compact = JSON.stringify(JSON.parse(m[1]));
        return { text: `${fence(compact, 'json')}\n\n_${fmtN(compact.length)} Zeichen statt ${fmtN(m[1].trim().length)} (−${fmtN(Math.max(0, 100 - compact.length / m[1].trim().length * 100), 0)} %)._`, source: 'data' };
      } catch (error) {
        return { text: `❌ Kein gültiges JSON: \`${String((error as Error).message).replace(/`/g, "'")}\``, source: 'data' };
      }
    }
    if ((m = raw.match(/^(?:json[-\s]?(?:schlüssel|schluessel|struktur|pfade|keys|übersicht|uebersicht)|struktur\s+von\s+json|welche\s+felder\s+hat\s+das\s+json)\s*[:\n]\s*([\s\S]+)$/i))) {
      try {
        const value = JSON.parse(m[1]);
        const keys = jsonKeys(value);
        return { text: `**Struktur (${keys.length}${keys.length >= 80 ? '+' : ''} Einträge):**\n\n${keys.map((k) => `- \`${k}\``).join('\n')}`, source: 'data' };
      } catch (error) {
        return { text: `❌ Kein gültiges JSON: \`${String((error as Error).message).replace(/`/g, "'")}\``, source: 'data' };
      }
    }
    if ((m = raw.match(/^(?:häufigkeit(?:en)?|haeufigkeit(?:en)?|zähle\s+(?:einträge|eintraege|vorkommen|häufigkeit|wie\s+oft)|wie\s+oft\s+kommt\s+(?:was|jedes)\s+vor|verteilung)\s*(?:von|in|der\s+liste)?\s*[:\n]\s*([\s\S]+)$/i))) {
      const items = splitItems(m[1]);
      if (!items.length) return null;
      const counts = new Map<string, { label: string; n: number }>();
      for (const item of items) {
        const key = item.toLowerCase();
        const entry = counts.get(key) || { label: item, n: 0 };
        entry.n += 1;
        counts.set(key, entry);
      }
      const sorted = [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'de'));
      const max = sorted[0].n;
      return {
        text: `| Eintrag | Anzahl | Anteil |\n|---|---:|---|\n${sorted.map((e) => `| ${esc(e.label)} | ${e.n} | ${fmtN(e.n / items.length * 100, 1)} % ${'█'.repeat(Math.max(1, Math.round(e.n / max * 10)))} |`).join('\n')}\n\n_${items.length} Einträge, ${sorted.length} verschiedene${sorted.length > 1 && sorted[0].n > sorted[1].n ? ` – am häufigsten: **${sorted[0].label}** (${sorted[0].n}×)` : ''}._`,
        source: 'data',
        val: sorted.length,
      };
    }
    if ((m = raw.match(/^(?:nummerier(?:e|en)|durchnummerieren|zeilennummern|nummerierte\s+liste)\s*(?:die\s+)?(?:zeilen|liste|einträge)?\s*[:\n]\s*([\s\S]+)$/i))) {
      const items = splitItems(m[1]);
      return { text: items.map((item, i) => `${i + 1}. ${item}`).join('\n'), source: 'data', val: items.length };
    }
    if ((m = raw.match(/^(?:zeilen\s*(?:als|in|zu)\s*(?:komma-?)?liste|zeilen\s+verbinden|in\s+eine\s+zeile|kommagetrennt|komma-?liste)\s*[:\n]\s*([\s\S]+)$/i))) {
      const items = splitItems(m[1]);
      return { text: `${fence(items.join(', '))}\n\n_${items.length} Einträge in einer Zeile – zum Kopieren anklicken._`, source: 'data', val: items.length };
    }
    if ((m = raw.match(/^(?:(?:komma-?)?liste\s*(?:als|in|zu)\s*zeilen|zeilenweise|untereinander|jede[sn]?\s+(?:eintrag|element)\s+in\s+eine\s+zeile|aufzählung)\s*[:\n]\s*([\s\S]+)$/i))) {
      const items = splitItems(m[1]);
      return { text: `${fence(items.join('\n'))}\n\n_${items.length} Zeilen._`, source: 'data', val: items.length };
    }
    if ((m = raw.match(/^(?:transponiere(?:n)?|tabelle\s+(?:drehen|kippen|transponieren)|spalten\s+und\s+zeilen\s+tauschen)\s*[:\n]\s*([\s\S]+)$/i))) {
      const rows = parseMarkdownTable(m[1]) || parseCsv(m[1]).rows;
      if (rows.length < 2) return { text: 'Bitte eine Tabelle (Markdown oder CSV) mit mindestens zwei Zeilen einfügen.', source: 'data' };
      const width = Math.max(...rows.map((r) => r.length));
      const transposed = Array.from({ length: width }, (_, col) => rows.map((r) => r[col] ?? ''));
      return { text: `${markdownTable(transposed)}\n\n_${transposed.length} Zeilen × ${transposed[0].length} Spalten (gedreht)._`, source: 'data' };
    }
    return null;
  },
};
