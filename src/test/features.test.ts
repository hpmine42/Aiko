import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../data/defaultConfig';
import { CMD_LIST, CMD_MORE } from '../data/commands';
import { configureEngine, pickResponse } from '../engine/aikoEngine';
import { clone } from '../utils/config';
import type { AikoConfig, AssistantMessage, TimerState } from '../types';

let config: AikoConfig;
let timers: TimerState[];

beforeEach(() => {
  config = clone(DEFAULT_CONFIG);
  timers = [];
  configureEngine(config, (next) => { config = next; configureEngine(config); }, {
    getTimers: () => timers,
    start: (seconds) => { timers.push({ id: 'timer', end: Date.now() + seconds * 1_000, dur: seconds, label: 'Timer', paused: false }); },
    stopAll: () => { const count = timers.length; timers = []; return count; },
  });
});

describe('integrated offline features', () => {
  it.each([
    ['5 km in Meilen', 'unit'],
    ['30 °C in Fahrenheit', 'unit'],
    ['2x + 3 = 11', 'math'],
    ['welche KW ist heute', 'date'],
    ['wie spät ist es in Tokio', 'date'],
    ['1000 € mit 3 % Zinsen für 5 Jahre', 'finance'],
    ['Fläche Kreis r = 3', 'geo'],
    ['würfle 2d20', 'random'],
    ['255 in Binär', 'base'],
    ['#173f7d in RGB', 'color'],
    ['119 € brutto', 'vat'],
    ['sicheres Passwort', 'pw'],
  ])('handles %s locally', (query, source) => {
    expect(pickResponse(query, null, null).source).toBe(source);
  });

  it('creates and updates a checklist widget', () => {
    const result = pickResponse('Checkliste Einkauf: Milch, Brot', null, null);
    expect(result.source).toBe('list');
    expect(result.widget).toMatchObject({ type: 'list', name: 'Einkauf' });
    expect(config.checklists[0].items.map((item) => item.t)).toEqual(['Milch', 'Brot']);
  });

  it('creates QR and chart widgets without a network', () => {
    expect(pickResponse('QR-Code für https://example.com', null, null).widget).toMatchObject({ type: 'qr' });
    expect(pickResponse('Diagramm: Äpfel 5, Birnen 8', null, null).widget).toMatchObject({ type: 'chart' });
  });

  it('stores local memories and resolves contextual follow-ups', () => {
    expect(pickResponse('Merke dir: Ich mag Tee', null, null).source).toBe('mem');
    expect(config.memory).toContain('Ich mag Tee');
    const joke = pickResponse('Erzähl mir einen Witz', null, null);
    const previous: AssistantMessage = {
      role: 'assistant', variants: [joke.text], vi: 0, ts: Date.now(), thoughts: [0],
      meta: [{ rule: joke.rule?.id || null, cap: joke.cap || '', source: joke.source, val: null }],
    };
    const follow = pickResponse('nochmal', joke.text, { history: [previous] });
    expect(follow.source).toBe('follow');
    expect(follow.text).not.toBe(joke.text);
  });

  it('contains exactly 29 slash menu entries and nine extra groups', () => {
    expect(CMD_LIST).toHaveLength(29);
    expect(CMD_MORE).toHaveLength(9);
    expect(CMD_LIST.every(([command]) => command.startsWith('/'))).toBe(true);
  });
});
