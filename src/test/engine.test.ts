import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../data/defaultConfig';
import { RULE_CODE_DOC } from '../data/ruleCodeDoc';
import { configureEngine, pickResponse, Qr } from '../engine/aikoEngine';
import { isRuleCode, parseRuleCode, rulesWithIds } from '../engine/ruleParser';
import { clone } from '../utils/config';
import { isSafeRuleRegex } from '../utils/safeRegex';
import type { AikoConfig, TimerState } from '../types';

let config: AikoConfig;
let timers: TimerState[];

beforeEach(() => {
  config = clone(DEFAULT_CONFIG);
  timers = [];
  configureEngine(config, (next) => { config = next; }, {
    getTimers: () => timers,
    start: (seconds) => { timers.push({ id: 't1', end: Date.now() + seconds * 1_000, dur: seconds, label: '5 Minuten', paused: false }); },
    stopAll: () => { const count = timers.length; timers = []; return count; },
  });
});

describe('Aiko behaviour engine', () => {
  it('calculates expressions and recognises Unicode minus', () => {
    expect(pickResponse('23 × 17', null, null).text).toContain('391');
    expect(pickResponse('5 − 2', null, null).text).toContain('3');
  });

  it('preserves exact, regex, capture, AND and priority rule syntax', () => {
    config.pairs = [
      { id: 'exact', enabled: true, patterns: ['=guten morgen'], response: 'Exakt', priority: 0 },
      { id: 'regex', enabled: true, patterns: ['~/ich bin (.+)/i'], response: 'Hallo {x}', priority: 0 },
      { id: 'capture', enabled: true, patterns: ['ich mag {x}'], response: 'Ich mag {x} auch!', priority: 0 },
      { id: 'and', enabled: true, patterns: ['wetter & morgen'], response: 'Beides', priority: 0 },
    ];
    configureEngine(config);
    expect(pickResponse('guten morgen', null, null).text).toBe('Exakt');
    expect(pickResponse('ich bin Ada', null, null).text).toBe('Hallo Ada');
    expect(pickResponse('ich mag Pizza', null, null).text).toBe('Ich mag Pizza auch!');
    expect(pickResponse('morgen Wetter?', null, null).text).toBe('Beides');
  });

  it('rejects potentially catastrophic user regexes without blocking the engine', () => {
    expect(isSafeRuleRegex('~/(a+)+$/')).toBe(false);
    expect(isSafeRuleRegex('~/a*a*a*b/')).toBe(false);
    expect(isSafeRuleRegex('~/^hallo\\s+welt$/i')).toBe(true);
    config.pairs = [{ id: 'unsafe', enabled: true, patterns: ['~/(a+)+$/'], response: 'Nicht ausführen', priority: 0 }];
    configureEngine(config);
    expect(pickResponse(`${'a'.repeat(10_000)}!`, null, null).rule).toBeNull();
    expect(parseRuleCode('regel: ~/(a+)+$/\nantwort: Unsicher').errors.join(' ')).toContain('zu komplex');
  });

  it('runs meta answers before knowledge fallback', () => {
    expect(pickResponse('42', null, null).text).toBe('Das ist die Zahl 42.');
    expect(pickResponse('Banane', null, null).text).toBe('Das ist ein Wort.');
    expect(pickResponse('Wann sind die Öffnungszeiten?', null, null).source).toBe('know');
  });

  it('accepts tools with a leading slash and starts timers', () => {
    const result = pickResponse('/timer 5 Minuten', null, null);
    expect(result.source).toBe('timer');
    expect(timers).toHaveLength(1);
    expect(timers[0].dur).toBe(300);
  });

  it('generates a scannable QR matrix locally', () => {
    const qr = Qr.encode('https://example.com', 'M');
    expect(qr.size).toBeGreaterThanOrEqual(21);
    expect(qr.modules).toHaveLength(qr.size);
    expect(Qr.toSvg(qr, undefined)).toContain('aria-label="QR-Code"');
  });
});

describe('rule code import', () => {
  it('keeps the original prompt and parses all supported fields', () => {
    expect(RULE_CODE_DOC).toContain('DEINE AUFGABE');
    expect(RULE_CODE_DOC).toContain('~/muster/flags');
    const parsed = parseRuleCode([
      'regel: =hallo | wetter & morgen',
      'antwort: Hallo! ||| Hey!\\nZweite Zeile',
      'vorschlag: Mehr | Warum?',
      'priorität: 2',
      'nicht bei: nein, nie',
      'folge kürzer: Kurz.',
      'aktiv: ja',
    ].join('\n'));
    expect(parsed.errors).toEqual([]);
    expect(parsed.rules[0]).toMatchObject({ priority: 2, enabled: true, suggest: ['Mehr', 'Warum?'] });
    expect(parsed.rules[0].response).toContain('\n');
  });

  it('returns line-numbered parser errors', () => {
    const parsed = parseRuleCode('regel: hallo\nunbekannt: wert');
    expect(parsed.errors.join(' ')).toMatch(/Zeile 2/);
    expect(parsed.errors.join(' ')).toContain('antwort:');
  });

  it('recognises only explicit rule-code messages for chat import', () => {
    expect(isRuleCode('regel: =hallo\nantwort: Hallo')).toBe(true);
    expect(isRuleCode('antwort: Das ist nur normaler Text')).toBe(false);
    const rules = rulesWithIds(parseRuleCode('regel: =hallo\nantwort: Hallo'), 123);
    expect(rules[0]).toMatchObject({ id: 'p1230', patterns: ['=hallo'], response: 'Hallo' });
  });
});
