import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../data/defaultConfig';
import { CMD_LIST } from '../data/commands';
import { SOURCE_LABEL, configureEngine, pickResponse } from '../engine/aikoEngine';
import { TOOLS, TOOL_HELP_LINES, TOOL_SOURCE_LABELS } from '../engine/tools';
import { checkIban, eanCheckDigit, isbn10Check, isbn10to13, mod97 } from '../engine/tools/checkdigits';
import { easter, feastDate, parseFeast, publicHolidays } from '../engine/tools/holidays';
import { evaluate, show } from '../engine/tools/fractions';
import { fromRoman, isLeapYear, numberWords, toRoman } from '../engine/tools/numbers';
import { nextPhase, phasesInYear, previousPhase } from '../engine/tools/moon';
import { sha256 } from '../engine/tools/encoding';
import { fromMorse, toMorse, uuid } from '../engine/tools/generators';
import { diffTokens } from '../engine/tools/diff';
import { POMODORO_KIND, formatStopwatch, pomodoroPlan } from '../engine/tools/productivity';
import { amortize, annuity } from '../engine/tools/loan';
import { clone } from '../utils/config';
import type { AikoConfig, AssistantMessage, TimerStartOptions, TimerState } from '../types';

let config: AikoConfig;
let timers: TimerState[];
let started: Array<{ seconds: number; options?: TimerStartOptions }>;

beforeEach(() => {
  config = clone(DEFAULT_CONFIG);
  timers = [];
  started = [];
  configureEngine(config, (next) => { config = next; configureEngine(config); }, {
    getTimers: () => timers,
    start: (seconds, options) => {
      started.push({ seconds, options });
      timers.push({ id: `t${timers.length}`, end: Date.now() + seconds * 1_000, dur: seconds, label: options?.label || 'Timer', paused: false, kind: options?.kind, chain: options?.chain });
    },
    stopAll: (kind) => {
      const before = timers.length;
      timers = timers.filter((timer) => kind != null && timer.kind !== kind);
      return before - timers.length;
    },
  });
});

const ask = (text: string) => pickResponse(text, null, null);

describe('tool registry', () => {
  it('registers every tool with a label and a help line', () => {
    expect(TOOLS.map((tool) => tool.id)).toEqual(expect.arrayContaining([
      'stats', 'fraction', 'loan', 'tip', 'health', 'holiday', 'numbers', 'moon', 'encode', 'check', 'generate', 'regex', 'diff', 'stopwatch',
    ]));
    expect(TOOL_HELP_LINES).toHaveLength(TOOLS.length);
    for (const tool of TOOLS) expect(SOURCE_LABEL[tool.id]).toBe(tool.label);
    expect(TOOL_SOURCE_LABELS.pomodoro).toBe('Pomodoro');
    expect(ask('/hilfe').text).toContain('Feiertage');
    expect(ask('/hilfe').text).toContain('Stoppuhr');
  });

  it('exposes the new tools in the slash menu', () => {
    const commands = CMD_LIST.map(([command]) => command.toLowerCase());
    expect(commands).toContain('/stoppuhr starten');
    expect(commands).toContain('/pomodoro starten');
    expect(commands).toContain('/mondphase heute');
  });

  it.each([
    ['Mittelwert von 3, 7, 12, 5', 'stats'],
    ['1/3 + 1/4', 'fraction'],
    ['20000 € Kredit mit 4 % über 5 Jahre', 'loan'],
    ['86 € mit 10 % Trinkgeld auf 4 Personen', 'tip'],
    ['BMI bei 70 kg und 1,75 m', 'health'],
    ['Kalorienbedarf Mann 30 Jahre 80 kg 180 cm', 'health'],
    ['Wann ist Ostern 2027?', 'holiday'],
    ['Feiertage in Bayern 2026', 'holiday'],
    ['Ist 2100 ein Schaltjahr?', 'numbers'],
    ['2026 in römisch', 'numbers'],
    ['MMXXVI in dezimal', 'numbers'],
    ['1234 in Worten', 'numbers'],
    ['1234,56 € in Worten', 'numbers'],
    ['Wann ist Vollmond?', 'moon'],
    ['Mondphase heute', 'moon'],
    ['Base64: Hallo Welt', 'encode'],
    ['SHA-256 von abc', 'encode'],
    ['IBAN prüfen: DE89 3704 0044 0532 0130 00', 'check'],
    ['uuid', 'generate'],
    ['SOS in Morse', 'generate'],
    ['Teste /\\d+/g an: Zimmer 12 und 305', 'regex'],
    ['Diff: a b c ||| a x c', 'diff'],
    ['Stoppuhr starten', 'stopwatch'],
    ['Pomodoro starten', 'pomodoro'],
  ])('routes „%s“ to %s', (query, source) => {
    expect(ask(query).source).toBe(source);
  });

  it('leaves existing tools untouched', () => {
    expect(ask('5 km in Meilen').source).toBe('unit');
    expect(ask('255 in Binär').source).toBe('base');
    expect(ask('1000 € mit 3 % Zinsen für 5 Jahre').source).toBe('finance');
    expect(ask('23 × 17').source).toBe('math');
    expect(ask('100/3').source).toBe('math');
    expect(ask('Timer 5 Minuten').source).toBe('timer');
    expect(ask('89 € in Dollar').source).toBe('unit');
    expect(ask('5 € in Meter').source).toBe('unit');
    expect(ask('hallo').source).toBe('rule');
    expect(ask('Runde').source).not.toBe('stopwatch');
  });
});

describe('statistics and fractions', () => {
  it('computes descriptive statistics', () => {
    const result = ask('Standardabweichung von 2, 4, 4, 4, 5, 5, 7, 9');
    expect(result.text).toContain('Mittelwert | 5');
    expect(result.text).toContain('Grundgesamtheit, n) | 2 |');
    expect(ask('Median von 1 2 3 4').val).toBe(2.5);
    expect(ask('Summe von 1 bis 100').val).toBe(5050);
  });

  it('does exact fraction arithmetic', () => {
    expect(show(evaluate('1/3 + 1/4'))).toBe('7/12');
    expect(show(evaluate('1/2 : 1/4'))).toBe('2');
    expect(show(evaluate('1 1/2 + 1/2'))).toBe('2');
    expect(show(evaluate('(1/2)/4'))).toBe('1/8');
    expect(ask('1/3 + 1/4').text).toContain('**1/3 + 1/4 = 7/12**');
    expect(ask('kürze 12/18').text).toContain('2/3');
    expect(ask('0,75 als Bruch').text).toContain('3/4');
    expect(ask('25 % als Bruch').text).toContain('1/4');
  });
});

describe('loan, tip and health', () => {
  it('calculates annuities', () => {
    const payment = annuity(20_000, 4, 60);
    expect(payment).toBeCloseTo(368.33, 2);
    const plan = amortize(20_000, 4, payment);
    expect(plan.months).toBe(60);
    expect(plan.totalInterest).toBeCloseTo(2099.83, 1);
    expect(plan.rows).toHaveLength(5);
    const result = ask('Darlehen 300.000 € mit 3,5 % Zinsen und 2 % Tilgung');
    expect(result.text).toContain('1.375,00 €');
    expect(result.text).toContain('Restschuld');
  });

  it('splits bills and adds tips', () => {
    const result = ask('86 € mit 10 % Trinkgeld auf 4 Personen');
    expect(result.val).toBeCloseTo(23.65, 2);
    expect(result.text).toContain('94,60 €');
    expect(ask('Rechnung 120 € durch 3').val).toBe(40);
    expect(ask('Trinkgeld für 45 €').text).toContain('| 10 % | 4,50 € | 49,50 € |');
  });

  it('computes BMI and calorie needs', () => {
    const bmi = ask('BMI bei 70 kg und 1,75 m');
    expect(bmi.val).toBe(22.9);
    expect(bmi.text).toContain('Normalgewicht');
    expect(ask('BMI 70 kg 175 cm').val).toBe(22.9);
    const kcal = ask('Kalorienbedarf Mann 30 Jahre 80 kg 180 cm');
    expect(kcal.text).toContain('1.780 kcal');
    expect(ask('Kalorienbedarf Frau, 28 Jahre, 62 kg, 168 cm').text).toContain('1.369 kcal');
  });
});

describe('holidays and feasts', () => {
  it('computes Easter with the Gauss algorithm', () => {
    const iso = (ts: number) => new Date(ts).toISOString().slice(0, 10);
    expect(iso(easter(2024))).toBe('2024-03-31');
    expect(iso(easter(2026))).toBe('2026-04-05');
    expect(iso(easter(2027))).toBe('2027-03-28');
    expect(iso(easter(2028))).toBe('2028-04-16');
    expect(iso(feastDate('pfingsten', 2026)!)).toBe('2026-05-24');
    expect(iso(feastDate('advent1', 2026)!)).toBe('2026-11-29');
    expect(iso(feastDate('muttertag', 2026)!)).toBe('2026-05-10');
    expect(iso(feastDate('busstag', 2026)!)).toBe('2026-11-18');
  });

  it('parses feast names and answers date questions', () => {
    expect(parseFeast('Ostern 2027')).toMatchObject({ key: 'ostern', year: 2027 });
    expect(parseFeast('der 1. Advent')).toMatchObject({ key: 'advent1' });
    expect(ask('Wann ist Ostern 2027?').text).toContain('Sonntag, 28. März 2027');
    expect(ask('Wie viele Tage bis Ostern?').source).toBe('date');
    expect(ask('Countdown bis Pfingsten').text).toContain('Pfingstsonntag');
  });

  it('lists public holidays per state', () => {
    expect(publicHolidays(2026, 'BY')).toHaveLength(14);
    expect(publicHolidays(2026, 'BE').map((entry) => entry.key)).toContain('frauentag');
    expect(publicHolidays(2026, 'NW').map((entry) => entry.key)).not.toContain('reformationstag');
    const result = ask('Feiertage in NRW 2026');
    expect(result.text).toContain('Fronleichnam');
    expect(result.val).toBe(11);
    expect(ask('Ist der 3.10.2026 ein Feiertag?').text).toContain('Tag der Deutschen Einheit');
    expect(ask('Ist der 2.10.2026 ein Feiertag?').text).toContain('kein');
  });
});

describe('numbers', () => {
  it('converts Roman numerals both ways', () => {
    expect(toRoman(2026)).toBe('MMXXVI');
    expect(toRoman(1994)).toBe('MCMXCIV');
    expect(fromRoman('MMXXVI')).toBe(2026);
    expect(fromRoman('mcmxciv')).toBe(1994);
    expect(fromRoman('IIII')).toBeNull();
    expect(ask('2026 in römisch').text).toContain('MMXXVI');
    expect(ask('MMXXVI in dezimal').val).toBe(2026);
  });

  it('spells numbers in German', () => {
    expect(numberWords(1n)).toBe('eins');
    expect(numberWords(21n)).toBe('einundzwanzig');
    expect(numberWords(101n)).toBe('einhunderteins');
    expect(numberWords(111n)).toBe('einhundertelf');
    expect(numberWords(1000n)).toBe('eintausend');
    expect(numberWords(1_000_000n)).toBe('eine Million');
    expect(numberWords(2_000_001n)).toBe('zwei Millionen eins');
    expect(ask('1234,56 € in Worten').text).toContain('eintausendzweihundertvierunddreißig Euro und sechsundfünfzig Cent');
  });

  it('knows leap years', () => {
    expect([1900, 2000, 2024, 2100].map(isLeapYear)).toEqual([false, true, true, false]);
    expect(ask('Ist 2100 ein Schaltjahr?').text).toContain('kein Schaltjahr');
    expect(ask('Ist 2000 ein Schaltjahr?').text).toContain('ist ein Schaltjahr');
    expect(ask('Schaltjahr 2024').text).toContain('ist ein Schaltjahr');
  });
});

describe('moon phases', () => {
  const minutesOff = (actual: number, expectedIso: string) => Math.abs(actual - Date.parse(expectedIso)) / 60_000;

  it('matches published phase instants within a few minutes', () => {
    expect(minutesOff(nextPhase(0.5, Date.parse('2024-12-01T00:00:00Z')), '2024-12-15T09:02:00Z')).toBeLessThan(5);
    expect(minutesOff(nextPhase(0.5, Date.parse('2024-01-01T00:00:00Z')), '2024-01-25T17:54:00Z')).toBeLessThan(5);
    expect(minutesOff(nextPhase(0, Date.parse('2024-01-01T00:00:00Z')), '2024-01-11T11:57:00Z')).toBeLessThan(5);
    expect(minutesOff(previousPhase(0, Date.parse('2024-01-20T00:00:00Z')), '2024-01-11T11:57:00Z')).toBeLessThan(5);
    expect(phasesInYear(0.5, 2024)).toHaveLength(12);
  });

  it('answers moon questions', () => {
    expect(ask('Mondphase am 24.12.2026').text).toContain('Vollmond');
    expect(ask('Vollmonde 2026').val).toBe(13);
    expect(ask('Wann ist Vollmond?').text).toMatch(/Der nächste \*\*Vollmond\*\* ist am/);
  });
});

describe('encoding and check digits', () => {
  it('encodes, decodes and hashes', () => {
    expect(ask('Base64: Hallo Welt').text).toContain('SGFsbG8gV2VsdA==');
    expect(ask('Base64 dekodieren: SGFsbG8gV2VsdA==').text).toContain('Hallo Welt');
    expect(ask('URL-encode: a b&c=d').text).toContain('a%20b%26c%3Dd');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(ask('SHA-256 von abc').text).toContain('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('validates IBAN, ISBN and EAN', () => {
    expect(mod97('123456789')).toBe(123456789 % 97);
    const iban = checkIban('DE89 3704 0044 0532 0130 00');
    expect(iban.ok).toBe(true);
    expect(iban.blz).toBe('37040044');
    expect(iban.account).toBe('532013000');
    expect(checkIban('DE89 3704 0044 0532 0130 01').ok).toBe(false);
    expect(isbn10Check('0306406152')).toBe('2');
    expect(isbn10Check('316148410X')).toBe('X');
    expect(isbn10to13('0306406152')).toBe('9780306406157');
    expect(eanCheckDigit('400638133393')).toBe('1');
    expect(ask('ISBN prüfen: 978-3-16-148410-0').text).toContain('gültige ISBN-13');
    expect(ask('ISBN prüfen: 0306406152').text).toContain('gültige ISBN-10');
    expect(ask('EAN prüfen: 4006381333931').text).toContain('gültiger EAN-13');
    expect(ask('EAN prüfen: 4006381333932').text).toContain('nicht');
  });
});

describe('generators, regex and diff', () => {
  it('generates UUIDs, Morse code and names', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const result = ask('uuid');
    expect(result.widget).toMatchObject({ type: 'pw', label: 'UUID v4', req: 'uuid' });
    expect(toMorse('SOS').code).toBe('... --- ...');
    expect(fromMorse('.... .- .-.. .-.. --- / .-- . .-.. -')).toBe('HALLO WELT');
    expect(ask('Morse: ... --- ...').text).toContain('SOS');
    expect(ask('3 Nicknames').text.match(/^- \*\*/gm)).toHaveLength(3);
    expect(ask('Lorem ipsum 2 Absätze').text.split('\n\n').length).toBeGreaterThanOrEqual(3);
  });

  it('regenerates a UUID on „nochmal“', () => {
    const first = ask('uuid');
    const previous: AssistantMessage = {
      role: 'assistant', variants: [first.text], vi: 0, ts: Date.now(), thoughts: [0],
      meta: [{ rule: null, cap: '', source: first.source, val: null, widget: first.widget }],
    };
    const again = pickResponse('nochmal', first.text, { history: [previous] });
    expect(again.widget).toMatchObject({ type: 'pw', req: 'uuid' });
    expect(again.text).not.toBe(first.text);
  });

  it('tests and replaces with regular expressions', () => {
    const result = ask('Teste /\\d+/g an: Zimmer 12 und 305');
    expect(result.val).toBe(2);
    expect(result.text).toContain('»12«');
    expect(ask('Ersetze /\\s+/g durch "-" in: a  b c').text).toContain('a-b-c');
    expect(ask('Teste /(a+)+$/ an: aaaaaaaaaaaaaaaaaaaaaaaa!').text).toContain('ReDoS');
  });

  it('diffs words and lines', () => {
    expect(diffTokens(['a', 'b', 'c'], ['a', 'x', 'c']).map((op) => op.kind)).toEqual(['same', 'del', 'add', 'same']);
    const words = ask('Diff: der schnelle braune Fuchs ||| der langsame braune Hund');
    expect(words.text).toContain('~~schnelle~~**langsame**');
    const lines = ask('Unterschied: Zeile 1\nZeile 2\nZeile 3\n---\nZeile 1\nZeile 2 neu\nZeile 3');
    expect(lines.text).toContain('- Zeile 2\n+ Zeile 2 neu');
  });
});

describe('stopwatch and pomodoro', () => {
  it('formats elapsed time', () => {
    expect(formatStopwatch(0)).toBe('0:00,0');
    expect(formatStopwatch(61_250)).toBe('1:01,2');
    expect(formatStopwatch(3_600_000)).toBe('1:00:00,0');
  });

  it('runs a stopwatch through the config', () => {
    expect(ask('Stoppuhr starten').widget).toMatchObject({ type: 'stopwatch' });
    expect(config.stopwatch?.running).toBe(true);
    expect(ask('Runde').source).toBe('stopwatch');
    expect(config.stopwatch?.laps).toHaveLength(1);
    expect(ask('Stoppuhr stoppen').source).toBe('stopwatch');
    expect(config.stopwatch?.running).toBe(false);
    expect(ask('Stoppuhr weiter').source).toBe('stopwatch');
    expect(config.stopwatch?.running).toBe(true);
    expect(ask('Stoppuhr zurücksetzen').source).toBe('stopwatch');
    expect(config.stopwatch).toBeNull();
  });

  it('plans and starts Pomodoro cycles as chained timers', () => {
    const plan = pomodoroPlan(25, 5, 4, 15);
    expect(plan).toHaveLength(8);
    expect(plan[0]).toMatchObject({ dur: 1500 });
    expect(plan[plan.length - 1]).toMatchObject({ dur: 900 });
    const result = ask('Pomodoro starten');
    expect(result.source).toBe('pomodoro');
    expect(started).toHaveLength(1);
    expect(started[0].seconds).toBe(1500);
    expect(started[0].options?.kind).toBe(POMODORO_KIND);
    expect(started[0].options?.chain).toHaveLength(7);
    expect(ask('Pomodoro status').text).toContain('Fokus 1/4');
    expect(ask('Pomodoro stoppen').text).toContain('beendet');
    expect(timers.filter((timer) => timer.kind === POMODORO_KIND)).toHaveLength(0);
    expect(ask('Pomodoro 50/10 mit 2 Runden').text).toContain('2 × 50 Minuten');
    expect(started[1].seconds).toBe(3000);
    expect(started[1].options?.chain).toHaveLength(3);
  });
});
