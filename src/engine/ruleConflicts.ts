import type { Rule } from '../types';
import { findRuleMatches, testQueryFor } from './aikoEngine';
import { variantsOf } from '../utils/config';
import { isSafeRuleRegex } from '../utils/safeRegex';

export interface RuleConflict {
  incoming: Rule;
  other: Rule;
  query: string | null;
  winner: Rule | null;
}

export interface RuleConflictReport {
  conflicts: RuleConflict[];
  hasRegex: boolean;
}

function regexKey(pattern: string): string | null {
  const raw = pattern.trim();
  if (!raw.startsWith('~') || !isSafeRuleRegex(raw)) return null;
  const body = raw.slice(1);
  const match = body.match(/^\/(.*)\/([imsu]*)$/);
  const regex = match ? new RegExp(match[1], match[2]) : new RegExp(body, 'i');
  // RegExp canonicalizes the flag order, including the implicit i flag.
  return `${regex.source}/${regex.flags}`;
}

/**
 * Check only conflicts involving an incoming rule, never pre-existing ones.
 * Uses the real matcher on examples from BOTH sides so that a new rule hiding
 * an old one is detected as well as an old rule hiding a new one. No engine
 * configuration, responses, statistics, storage or tool effects are changed.
 *
 * This is an example-based check, not a proof of disjoint regex languages.
 * Identical regexes are also reported when no concrete example is available.
 */
export function checkRuleConflicts(existing: readonly Rule[], incoming: readonly Rule[]): RuleConflictReport {
  const rules = [...existing, ...incoming];
  const active = new Set(rules.filter((rule) => rule.enabled !== false && variantsOf(rule.response).length && rule.patterns.length));
  const incomingIndices = new Map(incoming.map((rule, index) => [rule, index]));
  const positions = new Map(rules.map((rule, index) => [rule, index]));
  const conflicts = new Map<string, RuleConflict>();
  const queries = new Set<string>();

  const record = (rule: Rule, other: Rule, query: string | null, winner: Rule | null) => {
    if (rule === other) return;
    const index = incomingIndices.get(rule);
    if (index === undefined) return;
    const otherIndex = incomingIndices.get(other);
    if (otherIndex !== undefined && otherIndex < index) return;
    const key = `${index}:${positions.get(other)}`;
    if (!conflicts.has(key)) conflicts.set(key, { incoming: rule, other, query, winner });
  };

  // Prefer an example of the new rule; also check old examples for regressions.
  for (const rule of [...incoming, ...existing]) {
    if (!active.has(rule)) continue;
    for (const pattern of rule.patterns) {
      const query = testQueryFor(pattern);
      if (query !== null && query.trim()) queries.add(query);
      const raw = pattern.trim();
      if (!raw.startsWith('~') && !raw.startsWith('=') && /\{x\}/i.test(raw)) {
        // Don't let an exclusion of the default capture value hide a conflict.
        for (const value of ['Beispiel', '42']) queries.add(raw.replace(/\{x\}/gi, value));
      }
    }
  }

  for (const query of queries) {
    // Most old examples are unrelated to the import. Avoid an old-vs-old
    // scan for those, especially when the user has accumulated many rules.
    if (!findRuleMatches(query, incoming).length) continue;
    const hits = findRuleMatches(query, rules);
    if (hits.length < 2) continue;
    for (const hit of hits) {
      if (!incomingIndices.has(hit.rule)) continue;
      for (const other of hits) record(hit.rule, other.rule, query, hits[0].rule);
    }
  }

  const regexes = new Map([...active].map((rule) => [rule, new Set(rule.patterns.map(regexKey).filter((key): key is string => key !== null))]));
  for (const rule of incoming) {
    const keys = regexes.get(rule);
    if (!keys?.size) continue;
    for (const other of active) {
      if ([...keys].some((key) => regexes.get(other)?.has(key))) record(rule, other, null, null);
    }
  }

  return {
    conflicts: [...conflicts.values()],
    hasRegex: [...regexes.values()].some((keys) => keys.size > 0),
  };
}
