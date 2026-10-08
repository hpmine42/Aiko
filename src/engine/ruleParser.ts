import type { FollowUpKind, Rule, RuleCodeResult } from '../types';

/**
 * Detects the explicit rule-code format without treating ordinary chat text
 * containing a colon as an import. This is intentionally conservative: only
 * a line starting with `regel:` is considered a rule import from the chat.
 */
export function isRuleCode(text: string): boolean {
  return /(?:^|\n)\s*regel\s*:/i.test(String(text || ''));
}

export function rulesWithIds(result: RuleCodeResult, timestamp = Date.now()): Rule[] {
  return result.rules.map((rule, index) => ({ ...rule, id: `p${timestamp}${index}` }));
}

function splitPipes(value: string): string[] {
  const parts = String(value).split('|').map((part) => part.trim()).filter(Boolean);
  const output: string[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    let part = parts[index];
    if (part.indexOf('~/') === 0 && !/\/[a-z]*$/i.test(part)) {
      while (index + 1 < parts.length && !/\/[a-z]*$/i.test(part)) {
        part += `|${parts[index += 1]}`;
      }
    }
    output.push(part);
  }
  return output;
}

type ImportedRule = Omit<Rule, 'id'>;

export function parseRuleCode(text: string): RuleCodeResult {
  const rules: ImportedRule[] = [];
  const errors: string[] = [];
  let current: ImportedRule | null = null;
  let currentLine = 0;

  const finish = (): void => {
    if (!current) return;
    if (!current.patterns.length) {
      errors.push(`Regel ${rules.length + 1} (ab Zeile ${currentLine}): „regel:“ mit mindestens einem Stichwort fehlt`);
    } else if (!current.response) {
      errors.push(`Regel ${rules.length + 1} (ab Zeile ${currentLine}): „antwort:“ fehlt`);
    }
    rules.push(current);
    current = null;
  };

  String(text || '').split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.charAt(0) === '#') return;
    if (/^---+$/.test(trimmed)) {
      finish();
      return;
    }
    const match = trimmed.match(/^([^:]{1,40}?):\s*(.*)$/);
    if (!match) {
      errors.push(`Zeile ${lineNumber}: Erwartet „feld: wert“ – oder eine Trennzeile „---“`);
      return;
    }
    const key = match[1].toLowerCase().trim()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/\s+/g, ' ');
    const value = match[2].trim().replace(/\\n/g, '\n');
    if (!current) {
      current = { enabled: true, patterns: [], response: '' };
      currentLine = lineNumber;
    }
    const rule = current;

    if (['regel', 'muster', 'stichwort', 'stichwoerter', 'pattern', 'patterns'].includes(key)) {
      const parts = splitPipes(value);
      if (!parts.length) errors.push(`Zeile ${lineNumber}: „regel:“ braucht mindestens ein Stichwort`);
      rule.patterns = rule.patterns.concat(parts);
    } else if (['antwort', 'antworten', 'response', 'antworttext'].includes(key)) {
      if (!value) errors.push(`Zeile ${lineNumber}: „antwort:“ ist leer`);
      else rule.response = rule.response ? `${rule.response}|||${value}` : value;
    } else if (['vorschlag', 'vorschlaege', 'suggest'].includes(key)) {
      rule.suggest = (rule.suggest || []).concat(splitPipes(value)).slice(0, 4);
    } else if (['prio', 'prioritaet', 'priority'].includes(key)) {
      const priority = Number.parseInt(value, 10);
      if (!(priority >= -9 && priority <= 9)) errors.push(`Zeile ${lineNumber}: priorität muss eine Zahl von -9 bis 9 sein`);
      else rule.priority = priority;
    } else if (['nicht bei', 'ausschliessen', 'exclude', 'nicht'].includes(key)) {
      rule.exclude = (rule.exclude || []).concat(value.split(/[,;|]/).map((part) => part.trim()).filter(Boolean));
    } else if (['aktiv', 'enabled', 'an'].includes(key)) {
      if (/^(ja|yes|true|an|1)$/i.test(value)) rule.enabled = true;
      else if (/^(nein|no|false|aus|0)$/i.test(value)) rule.enabled = false;
      else errors.push(`Zeile ${lineNumber}: aktiv muss ja oder nein sein`);
    } else if (/^folge /.test(key)) {
      const kind = key.slice(6).trim() as FollowUpKind;
      if (!(['kuerzer', 'einfacher', 'warum', 'beispiel', 'mehr', 'nochmal'] as string[]).includes(kind)) {
        errors.push(`Zeile ${lineNumber}: Folge-Frage „${kind}“ gibt es nicht (erlaubt: kürzer, einfacher, warum, beispiel, mehr, nochmal)`);
      } else {
        rule.followups = rule.followups || {};
        rule.followups[kind] = value;
      }
    } else {
      errors.push(`Zeile ${lineNumber}: Unbekanntes Feld „${match[1].trim()}“`);
    }
  });
  finish();
  if (rules.length > 50) {
    errors.push('Maximal 50 Regeln pro Einfügung');
    return { rules: rules.slice(0, 50), errors };
  }
  return { rules, errors };
}
