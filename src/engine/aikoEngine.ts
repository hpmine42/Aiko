import * as legacy from './aikoEngine.legacy';
import type { AikoConfig, EngineResult, MessageWidget, QrApi, Rule, RuleHit, RuleTestResult, TimerAdapter } from '../types';

/**
 * Typed boundary for the response engine. The historical implementation is
 * isolated in aikoEngine.legacy.ts and can be migrated without leaking `any`
 * into the React application.
 */
export const RULE_CODE_DOC = legacy.RULE_CODE_DOC as string;
export const Qr: QrApi = legacy.Qr as QrApi;
export const SOURCE_LABEL: Record<string, string> = legacy.SOURCE_LABEL as Record<string, string>;

export function configureEngine(
  config: AikoConfig,
  configChange?: (next: AikoConfig) => void,
  timers?: TimerAdapter,
): void {
  legacy.configureEngine(config, configChange, timers);
}

export function getEngineConfig(): AikoConfig {
  return legacy.getEngineConfig() as AikoConfig;
}

export function withName(text: unknown): string {
  return legacy.withName(text);
}

export function variantsOf(value: string): string[] {
  return legacy.variantsOf(value) as string[];
}

export function md(source: string): string {
  return legacy.md(source);
}

export function plain(source: string): string {
  return legacy.plain(source);
}

export function norm(source: string): string {
  return legacy.norm(source);
}

export function ruleTitle(rule: Rule): string {
  return legacy.ruleTitle(rule);
}

export function findRule(text: string): RuleHit | null {
  const result = legacy.findRule(text) as unknown;
  if (!result || typeof result !== 'object') return null;
  const candidate = result as Partial<RuleHit>;
  if (!candidate.rule || typeof candidate.rule.id !== 'string') return null;
  return {
    rule: candidate.rule as Rule,
    pattern: String(candidate.pattern || ''),
    cap: String(candidate.cap || ''),
    score: Number(candidate.score) || 0,
    hard: Boolean(candidate.hard),
    prio: Number(candidate.prio) || 0,
  };
}

/** All matching rules, in the same priority/score/order used by findRule. */
export function findRuleMatches(text: string, rules: readonly Rule[]): RuleHit[] {
  return legacy.findRuleMatches(text, rules) as RuleHit[];
}

export function testQueryFor(pattern: string): string | null {
  return legacy.testQueryFor(pattern);
}

export function pickResponse(text: string, avoid: string | null, context: unknown): EngineResult {
  const result = legacy.pickResponse(text, avoid, context) as unknown;
  if (!result || typeof result !== 'object') throw new TypeError('Die Antwort-Engine hat kein gültiges Ergebnis geliefert.');
  const raw = result as Record<string, unknown>;
  if (typeof raw.text !== 'string') throw new TypeError('Die Antwort-Engine hat keinen Antworttext geliefert.');
  const allowedFollowUps = ['kuerzer', 'einfacher', 'warum', 'beispiel', 'mehr', 'nochmal'];
  const widget = raw.widget && typeof raw.widget === 'object' ? raw.widget as MessageWidget : null;
  return {
    text: raw.text,
    rule: raw.rule && typeof raw.rule === 'object' ? raw.rule as Rule : null,
    pattern: typeof raw.pattern === 'string' ? raw.pattern : '',
    cap: typeof raw.cap === 'string' ? raw.cap : undefined,
    index: Number.isInteger(raw.index) && Number(raw.index) >= 0 ? Number(raw.index) : 0,
    total: Number.isInteger(raw.total) && Number(raw.total) > 0 ? Number(raw.total) : 1,
    source: typeof raw.source === 'string' ? raw.source : 'fallback',
    val: typeof raw.val === 'number' && Number.isFinite(raw.val) ? raw.val : null,
    widget,
    follow: allowedFollowUps.includes(String(raw.follow)) ? raw.follow as EngineResult['follow'] : undefined,
  };
}

export function runRuleTests(): RuleTestResult[] {
  return legacy.runRuleTests() as RuleTestResult[];
}
