import type { Tool, ToolResult } from './types';
import { fence, fmtN } from './shared';
import { MAX_RULE_REGEX_INPUT_LENGTH, isSafeRuleRegexSource } from '../../utils/safeRegex';

/** Finds a `/pattern/flags` literal; returns the literal, its source and flags. */
function literal(text: string): { source: string; flags: string; raw: string; index: number } | null {
  const m = text.match(/\/((?:\\.|\[(?:\\.|[^\]])*\]|[^/\\\n])+)\/([gimsuyd]*)/);
  if (!m || m.index == null) return null;
  return { source: m[1], flags: m[2], raw: m[0], index: m.index };
}

function build(source: string, flags: string): { regex?: RegExp; error?: string } {
  if (!isSafeRuleRegexSource(source)) return { error: 'Dieses Muster lehne ich ab: zu lang oder potenziell katastrophale Verschachtelung von Wiederholungen (ReDoS-Schutz).' };
  try {
    return { regex: new RegExp(source, flags.includes('g') ? flags : `${flags}g`) };
  } catch (error) {
    return { error: `Ungültiger regulärer Ausdruck: ${error instanceof Error ? error.message.replace(/^Invalid regular expression:\s*/, '') : 'unbekannter Fehler'}` };
  }
}

function matches(regex: RegExp, text: string): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) && out.length < 50) {
    out.push(m);
    if (m[0] === '') regex.lastIndex += 1;
  }
  return out;
}

function markup(text: string, hits: RegExpExecArray[]): string {
  let out = '';
  let pos = 0;
  hits.forEach((hit) => {
    if (hit.index < pos) return;
    out += text.slice(pos, hit.index) + '»' + hit[0] + '«';
    pos = hit.index + hit[0].length;
  });
  return out + text.slice(pos);
}

function report(source: string, flags: string, text: string): ToolResult {
  if (text.length > MAX_RULE_REGEX_INPUT_LENGTH) return { text: `Bitte höchstens ${fmtN(MAX_RULE_REGEX_INPUT_LENGTH)} Zeichen Testtext.`, source: 'regex' };
  const built = build(source, flags);
  if (!built.regex) return { text: `✘ ${built.error}`, source: 'regex' };
  const hits = matches(built.regex, text);
  const shownFlags = flags || '–';
  if (!hits.length) {
    return { text: `✘ **Kein Treffer** für \`/${source}/${flags}\` in:\n\n${fence(text)}\n\n_Flags: ${shownFlags}. Tipp: \`i\` ignoriert Groß-/Kleinschreibung, \`m\` lässt ^ und $ pro Zeile gelten._`, source: 'regex', val: 0 };
  }
  const list = hits.map((hit, i) => {
    const groups = hit.slice(1).map((g, k) => `Gruppe ${k + 1}: ${g === undefined ? '–' : `„${g}“`}`);
    const named = hit.groups ? Object.entries(hit.groups).map(([k, v]) => `${k}: ${v === undefined ? '–' : `„${v}“`}`) : [];
    const extras = [...groups, ...named];
    return `${i + 1}. „${hit[0]}“ an Position ${hit.index}–${hit.index + hit[0].length}${extras.length ? ` (${extras.join(', ')})` : ''}`;
  });
  const global = flags.includes('g');
  return {
    text: `✔️ **${hits.length === 1 ? '1 Treffer' : `${hits.length} Treffer`}** für \`/${source}/${flags}\`${!global && hits.length > 1 ? ' (ohne `g` würde nur der erste gelten)' : ''}\n\n${list.join('\n')}\n\nMarkiert:\n\n${fence(markup(text, hits))}`,
    source: 'regex',
    val: hits.length,
  };
}

export const regexTool: Tool = {
  id: 'regex',
  label: 'RegEx-Tester',
  help: '- **RegEx testen:** „Teste /\\d+/g an: Zimmer 12 und 305“, „Ersetze /\\s+/g durch "-" in: a  b c“',
  run(input) {
    const s = String(input || '').trim();
    if (!/\/.+\//.test(s) || !/^(?:teste?|test|prüfe?|pruefe?|regex|regexp|regulärer\s+ausdruck|regulaerer\s+ausdruck|passt|matcht|match|ersetze|replace|regex[-\s]?(?:test|tester))\b/i.test(s)) return null;
    const lit = literal(s);
    if (!lit) return { text: 'Schreib das Muster als /muster/flags, z. B. „Teste /\\d+/g an: Zimmer 12 und 305“.', source: 'regex' };
    const after = s.slice(lit.index + lit.raw.length).trim();
    let m: RegExpMatchArray | null;
    if (/^(?:ersetze|replace)\b/i.test(s) && (m = after.match(/^(?:durch|mit|with|by)\s+(?:"([^"]*)"|„([^“]*)“|'([^']*)'|(\S+))\s+(?:in|im\s+text|auf|bei)\s*[:\n]?\s*([\s\S]+)$/i))) {
      const replacement = m[1] ?? m[2] ?? m[3] ?? m[4] ?? '';
      const text = m[5].trim();
      if (text.length > MAX_RULE_REGEX_INPUT_LENGTH) return { text: `Bitte höchstens ${fmtN(MAX_RULE_REGEX_INPUT_LENGTH)} Zeichen Text.`, source: 'regex' };
      const built = build(lit.source, lit.flags);
      if (!built.regex) return { text: `✘ ${built.error}`, source: 'regex' };
      const regex = lit.flags.includes('g') ? built.regex : new RegExp(lit.source, lit.flags);
      const count = matches(built.regex, text).length;
      const out = text.replace(regex, replacement);
      return {
        text: `**Ersetzt (${lit.flags.includes('g') ? `${count} ${count === 1 ? 'Stelle' : 'Stellen'}` : count ? 'erste Stelle' : 'keine Stelle'}):**\n\n${fence(out)}\n\n_Muster \`/${lit.source}/${lit.flags}\`, Ersatz „${replacement}“ – \`$1\` setzt die erste Gruppe ein._`,
        source: 'regex',
        val: count,
      };
    }
    const textMatch = after.match(/^(?:an|auf|gegen|mit|in|bei|text|string|testtext)?\s*[:\n]\s*([\s\S]+)$/i) || after.match(/^(?:an|auf|gegen|mit|in|bei)\s+([\s\S]+)$/i);
    if (!textMatch) {
      const before = s.slice(0, lit.index).trim();
      const inFront = before.match(/^(?:passt|matcht|match(?:t)?)\s+(.+?)\s+(?:auf|zu|mit|gegen)$/i);
      if (inFront) return report(lit.source, lit.flags, inFront[1].replace(/^[„"']+|[“"']+$/g, ''));
      return { text: `Gegen welchen Text soll ich \`/${lit.source}/${lit.flags}\` testen? Beispiel: „Teste /${lit.source}/${lit.flags} an: dein Text“.`, source: 'regex' };
    }
    return report(lit.source, lit.flags, textMatch[1].trim().replace(/^[„"]|[“"]$/g, ''));
  },
};
