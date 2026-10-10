import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../data/defaultConfig';
import { configureEngine, findRule, findRuleMatches, getEngineConfig } from '../engine/aikoEngine';
import { checkRuleConflicts } from '../engine/ruleConflicts';
import type { Rule } from '../types';
import { clone } from '../utils/config';

function rule(id: string, patterns: string | string[], patch: Partial<Rule> = {}): Rule {
  return { id, enabled: true, patterns: typeof patterns === 'string' ? [patterns] : patterns, response: id, ...patch };
}

describe('live rule import conflict checks', () => {
  it('reports a duplicate, with the existing rule winning an equal-priority/score tie', () => {
    const existing = rule('old', 'hallo');
    const incoming = rule('new', 'hallo');
    const report = checkRuleConflicts([existing], [incoming]);
    expect(report.conflicts).toEqual([{ incoming, other: existing, query: 'hallo', winner: existing }]);
    expect(report.hasRegex).toBe(false);
  });

  it('uses the same case, punctuation and umlaut normalization as the engine', () => {
    const existing = rule('old', '=Ärger!');
    const incoming = rule('new', '=AERGER');
    expect(checkRuleConflicts([existing], [incoming]).conflicts).toEqual([
      { incoming, other: existing, query: 'AERGER', winner: existing },
    ]);
  });

  it('detects typo-tolerant keyword overlaps, not just equal strings', () => {
    const existing = rule('old', 'wetter');
    const incoming = rule('new', 'weter');
    expect(checkRuleConflicts([existing], [incoming]).conflicts).toEqual([
      { incoming, other: existing, query: 'weter', winner: incoming },
    ]);
  });

  it('checks old examples too, detecting a new priority rule hiding an existing exact rule', () => {
    const existing = rule('old', '=wetter morgen');
    const incoming = rule('new', 'wetter', { priority: 2 });
    expect(checkRuleConflicts([existing], [incoming]).conflicts).toEqual([
      { incoming, other: existing, query: 'wetter morgen', winner: incoming },
    ]);
  });

  it('detects an existing priority rule hiding a new exact rule', () => {
    const existing = rule('old', 'wetter', { priority: 2 });
    const incoming = rule('new', '=wetter morgen');
    expect(checkRuleConflicts([existing], [incoming]).conflicts[0].winner).toBe(existing);
  });

  it('uses the full rule set to name the winner, even if a third rule wins', () => {
    const existing = rule('old', 'hallo');
    const highest = rule('highest', 'hallo', { priority: 9 });
    const incoming = rule('new', 'hallo');
    const report = checkRuleConflicts([existing, highest], [incoming]);
    expect(report.conflicts).toHaveLength(2);
    expect(report.conflicts.every((conflict) => conflict.winner === highest)).toBe(true);
    expect(findRuleMatches('hallo', [existing, highest, incoming]).map((hit) => hit.rule)).toEqual([highest, existing, incoming]);
  });

  it('respects exclusions and does not warn for disjoint exact triggers', () => {
    const existing = rule('old', 'wetter', { exclude: ['morgen'] });
    const incoming = rule('new', '=wetter morgen');
    expect(checkRuleConflicts([existing], [incoming]).conflicts).toEqual([]);
  });

  it.each([
    { enabled: false },
    { response: ' ||| ' },
    { patterns: [] },
  ])('ignores an ineligible existing or incoming rule (%j)', (patch) => {
    const active = rule('active', 'hallo');
    const inactive = rule('inactive', 'hallo', patch);
    expect(checkRuleConflicts([inactive], [active]).conflicts).toEqual([]);
    expect(checkRuleConflicts([active], [inactive]).conflicts).toEqual([]);
  });

  it('checks placeholders and AND patterns with real example texts', () => {
    const capture = rule('capture', 'ich mag {x}');
    const exact = rule('exact', '=ich mag Pizza');
    expect(checkRuleConflicts([capture], [exact]).conflicts[0]).toMatchObject({ query: 'ich mag Pizza', winner: exact });

    const and = rule('and', 'wetter & morgen');
    const question = rule('question', '=morgen wetter');
    expect(checkRuleConflicts([and], [question]).conflicts[0]).toMatchObject({ query: 'morgen wetter', winner: question });
  });

  it('tries alternate capture values when the default Test value is excluded', () => {
    const existing = rule('old', 'ich mag {x}', { exclude: ['Test'] });
    const incoming = rule('new', 'ich mag {x}', { exclude: ['Test'] });
    expect(checkRuleConflicts([existing], [incoming]).conflicts[0].query).toBe('ich mag Beispiel');
  });

  it('checks regex rules against the other rules’ concrete examples in both directions', () => {
    const regex = rule('regex', '~/^hallo\\s+welt$/i');
    const exact = rule('exact', '=Hallo Welt');
    expect(checkRuleConflicts([regex], [exact]).conflicts[0]).toMatchObject({ query: 'Hallo Welt', winner: exact });
    expect(checkRuleConflicts([exact], [regex]).conflicts[0]).toMatchObject({ query: 'Hallo Welt', winner: exact });
  });

  it('reports identical regexes without inventing an example or a winner', () => {
    const existing = rule('old', '~/^hallo$/mi');
    const incoming = rule('new', '~/^hallo$/im');
    expect(checkRuleConflicts([existing], [incoming])).toEqual({
      conflicts: [{ incoming, other: existing, query: null, winner: null }],
      hasRegex: true,
    });
    expect(checkRuleConflicts([rule('old', '~^hallo$')], [rule('new', '~/^hallo$/i')]).conflicts).toHaveLength(1);
  });

  it('flags regex coverage as incomplete and never executes unsafe stored regexes', () => {
    const differentRegexes = checkRuleConflicts([rule('old', '~/^a+$/')], [rule('new', '~/a$/')]);
    expect(differentRegexes).toEqual({ conflicts: [], hasRegex: true });
    const unsafe = rule('unsafe', '~/(a+)+$/');
    expect(checkRuleConflicts([unsafe], [rule('new', `=${'a'.repeat(1_000)}!`)])).toEqual({ conflicts: [], hasRegex: false });
  });

  it('reports conflicts inside an import once per rule pair, not once per pattern', () => {
    const first = rule('first', ['hallo', 'hey']);
    const second = rule('second', ['hallo', 'hey']);
    expect(checkRuleConflicts([], [first, second]).conflicts).toEqual([
      { incoming: first, other: second, query: 'hallo', winner: first },
    ]);
  });

  it('does not report old-vs-old conflicts for an unrelated import', () => {
    const existing = [rule('old-1', 'hallo'), rule('old-2', 'hallo')];
    expect(checkRuleConflicts(existing, [rule('new', '=wetter')]).conflicts).toEqual([]);
    expect(checkRuleConflicts(existing, []).conflicts).toEqual([]);
  });

  it('does not rely on rule IDs being unique', () => {
    const existing = rule('same-id', 'hallo');
    const incoming = rule('same-id', 'hallo');
    const report = checkRuleConflicts([existing], [incoming]);
    expect(report.conflicts[0].incoming).toBe(incoming);
    expect(report.conflicts[0].other).toBe(existing);
    expect(report.conflicts[0].winner).toBe(existing);
  });

  it('never changes the active config, storage, stats or tools while previewing', () => {
    const config = clone(DEFAULT_CONFIG);
    const existing = rule('old', 'timer 5 Minuten');
    const incoming = rule('new', 'timer 5 Minuten', { priority: 3 });
    config.pairs = [existing];
    const onConfig = vi.fn();
    const start = vi.fn();
    configureEngine(config, onConfig, { getTimers: () => [], start, stopAll: () => 0 });
    const before = JSON.stringify(config);

    expect(checkRuleConflicts(config.pairs, [incoming]).conflicts).toHaveLength(1);
    expect(getEngineConfig()).toBe(config);
    expect(JSON.stringify(config)).toBe(before);
    expect(findRule('timer 5 Minuten')?.rule).toBe(existing);
    expect(onConfig).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
  });
});
