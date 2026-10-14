import type { Tool, ToolResult } from './types';
import { fence, fmtN } from './shared';

export type DiffOp = { kind: 'same' | 'add' | 'del'; value: string };

/** Classic LCS diff over tokens (lines or words). */
export function diffTokens(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const table: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ kind: 'same', value: a[i] }); i += 1; j += 1; }
    else if (table[i + 1][j] >= table[i][j + 1]) { ops.push({ kind: 'del', value: a[i] }); i += 1; }
    else { ops.push({ kind: 'add', value: b[j] }); j += 1; }
  }
  while (i < n) { ops.push({ kind: 'del', value: a[i] }); i += 1; }
  while (j < m) { ops.push({ kind: 'add', value: b[j] }); j += 1; }
  return ops;
}

const MAX_TOKENS = 600;

function splitPair(body: string): [string, string] | null {
  if (body.includes('|||')) {
    const parts = body.split('|||');
    if (parts.length >= 2) return [parts[0].trim(), parts.slice(1).join('|||').trim()];
  }
  const sep = body.split(/\n\s*(?:---+|===+|\*\*\*+)\s*\n/);
  if (sep.length >= 2) return [sep[0].trim(), sep.slice(1).join('\n---\n').trim()];
  const blocks = body.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 2) return [blocks[0], blocks[1]];
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 2) return [lines[0], lines[1]];
  const quoted = body.match(/^["„](.+?)["“]\s+(?:und|vs\.?|mit|gegen)\s+["„](.+?)["“]$/s);
  if (quoted) return [quoted[1], quoted[2]];
  return null;
}

export const diffTool: Tool = {
  id: 'diff',
  label: 'Textvergleich',
  help: '- **Textvergleich:** „Diff: alter Text ||| neuer Text“ – oder zwei Texte, durch eine Zeile `---` getrennt',
  run(input) {
    const s = String(input || '').trim();
    const m = s.match(/^(?:diff|textdiff|text[-\s]?vergleich|vergleiche?\s+(?:die\s+|diese\s+|zwei\s+|beide\s+)?texte|unterschiede?(?:\s+zwischen)?|was\s+ist\s+anders|änderungen|aenderungen)\s*[:\n]\s*([\s\S]+)$/i);
    if (!m) return null;
    const pair = splitPair(m[1]);
    if (!pair) return { text: 'Gib mir zwei Texte, getrennt durch `|||` oder eine Zeile mit `---`, z. B. „Diff: alter Satz ||| neuer Satz“.', source: 'diff' };
    const [a, b] = pair;
    if (a === b) return { text: '**Die beiden Texte sind identisch.**', source: 'diff', val: 100 };
    const lineMode = a.includes('\n') || b.includes('\n');
    const tokensA = lineMode ? a.split('\n') : a.split(/(\s+)/).filter((t) => t.length);
    const tokensB = lineMode ? b.split('\n') : b.split(/(\s+)/).filter((t) => t.length);
    if (tokensA.length > MAX_TOKENS || tokensB.length > MAX_TOKENS) return { text: `Bitte höchstens ${MAX_TOKENS} ${lineMode ? 'Zeilen' : 'Wörter'} pro Text.`, source: 'diff' };
    const ops = diffTokens(tokensA, tokensB);
    const isWord = (t: string): boolean => !/^\s+$/.test(t);
    const added = ops.filter((op) => op.kind === 'add' && isWord(op.value)).length;
    const removed = ops.filter((op) => op.kind === 'del' && isWord(op.value)).length;
    const same = ops.filter((op) => op.kind === 'same' && isWord(op.value)).length;
    const totalA = tokensA.filter(isWord).length;
    const totalB = tokensB.filter(isWord).length;
    const similarity = totalA + totalB ? Math.round((2 * same) / (totalA + totalB) * 100) : 100;
    const unit = lineMode ? 'Zeile' : 'Wort';
    const units = lineMode ? 'Zeilen' : 'Wörter';
    let body: string;
    if (lineMode) {
      body = fence(ops.map((op) => `${op.kind === 'add' ? '+ ' : op.kind === 'del' ? '- ' : '  '}${op.value}`).join('\n'), 'diff');
    } else {
      body = ops.map((op) => {
        if (!isWord(op.value)) return op.value;
        if (op.kind === 'add') return `**${op.value}**`;
        if (op.kind === 'del') return `~~${op.value}~~`;
        return op.value;
      }).join('').replace(/\*\*(\S+)\*\*(\s+)\*\*(\S+)\*\*/g, '**$1$2$3**').replace(/~~(\S+)~~(\s+)~~(\S+)~~/g, '~~$1$2$3~~');
    }
    return {
      text: `**Textvergleich:** ${fmtN(similarity)} % identisch · ${added} ${added === 1 ? unit : units} hinzugefügt · ${removed} ${removed === 1 ? unit : units} entfernt\n\n${body}\n\n_${lineMode ? '`+` neu, `-` entfernt, Zeilenvergleich' : '**fett** = neu, ~~durchgestrichen~~ = entfernt, Wortvergleich'}._`,
      source: 'diff',
      val: similarity,
    };
  },
};
