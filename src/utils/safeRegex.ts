const MAX_RULE_REGEX_LENGTH = 256;
const MAX_RULE_QUANTIFIER = 1_000;
const MAX_RULE_QUANTIFIERS = 8;
const MAX_UNBOUNDED_RULE_QUANTIFIERS = 2;
export const MAX_RULE_REGEX_INPUT_LENGTH = 512;

function quantifierLength(source: string, index: number): number {
  const char = source[index];
  if (char === '*' || char === '+') return 1;
  if (char === '?') {
    // Ignore non-capturing/lookaround group prefixes and lazy modifiers.
    if (source[index - 1] === '(' || '*+?}'.includes(source[index - 1] || '')) return 0;
    return 1;
  }
  if (char !== '{') return 0;
  const match = source.slice(index).match(/^\{(\d+)(?:,(\d*))?\}/);
  if (!match) return 0;
  const lower = Number(match[1]);
  const upper = match[2] === undefined || match[2] === '' ? lower : Number(match[2]);
  return lower > MAX_RULE_QUANTIFIER || upper > MAX_RULE_QUANTIFIER ? -1 : match[0].length;
}

/** Conservative ReDoS guard for user-authored regex rules (not a full proof). */
export function isSafeRuleRegexSource(source: string): boolean {
  if (!source || source.length > MAX_RULE_REGEX_LENGTH || /\\[1-9]/.test(source)) return false;
  const groups: Array<{ quantified: boolean; alternation: boolean }> = [];
  let quantifierCount = 0;
  let unboundedQuantifierCount = 0;
  let inClass = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\') { index += 1; continue; }
    if (inClass) {
      if (char === ']') inClass = false;
      continue;
    }
    if (char === '[') { inClass = true; continue; }
    if (char === '(') {
      groups.push({ quantified: false, alternation: false });
      continue;
    }
    if (char === '|') {
      const group = groups[groups.length - 1];
      if (group) group.alternation = true;
      continue;
    }
    if (char === ')') {
      const group = groups.pop();
      if (!group) continue;
      const nextQuantifier = quantifierLength(source, index + 1);
      if (nextQuantifier < 0) return false;
      const repeated = nextQuantifier > 0;
      if (repeated && (group.quantified || group.alternation)) return false;
      const parent = groups[groups.length - 1];
      if (parent) {
        parent.quantified ||= group.quantified || repeated;
        parent.alternation ||= group.alternation;
      }
      continue;
    }
    const quantifier = quantifierLength(source, index);
    if (quantifier < 0) return false;
    if (quantifier > 0) {
      quantifierCount += 1;
      if (quantifierCount > MAX_RULE_QUANTIFIERS) return false;
      const range = char === '{' ? source.slice(index).match(/^\{\d+,(\d*)\}/) : null;
      if (char === '*' || char === '+' || (range && range[1] === '')) {
        unboundedQuantifierCount += 1;
        if (unboundedQuantifierCount > MAX_UNBOUNDED_RULE_QUANTIFIERS) return false;
      }
      const group = groups[groups.length - 1];
      if (group) group.quantified = true;
      if (char === '{') index += quantifier - 1;
    }
  }
  return true;
}

export function isSafeRuleRegex(pattern: string): boolean {
  const raw = String(pattern || '').trim();
  if (!raw.startsWith('~')) return true;
  const body = raw.slice(1);
  const match = body.match(/^\/(.*)\/([imsu]*)$/);
  const source = match ? match[1] : body;
  const flags = match ? match[2] : 'i';
  if (!isSafeRuleRegexSource(source)) return false;
  try { new RegExp(source, flags); return true; }
  catch { return false; }
}
