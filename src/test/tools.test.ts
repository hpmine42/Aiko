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
import { buildMonth, isoWeek } from '../engine/tools/calendar';
import { addWorkdays, countWorkdays } from '../engine/tools/workdays';
import { parseClock, parseDuration } from '../engine/tools/timecalc';
import { activeGame, resetGames } from '../engine/tools/games';
import { quotesTool } from '../engine/tools/quotes';
import { todayTool } from '../engine/tools/today';
import { tttBestMove, tttMove, tttWinner } from '../engine/tools/tictactoe';
import { c4BestMove, c4Drop, c4Winner } from '../engine/tools/connect4';
import { sudokuGenerate, sudokuHint, sudokuParse, sudokuSolve } from '../engine/tools/sudoku';
import { REMINDER_KIND } from '../engine/tools/reminders';
import { chineseZodiac } from '../engine/tools/zodiac';
import { caesar, crackCaesar, vigenere, atbash } from '../engine/tools/cipher';
import { analyzePassword } from '../engine/tools/pwstrength';
import { contrastRatio, parseColor, toHex } from '../engine/tools/contrast';
import { markdownTable, parseCsv } from '../engine/tools/data';
import { findCountry } from '../engine/tools/countries';
import { findElement, molarMass } from '../engine/tools/elements';
import { binomial, collatz, divisors, gcd } from '../engine/tools/numbertheory';
import { gradeFor, pointsToGrade } from '../engine/tools/grades';
import { clone } from '../utils/config';
import type { AikoConfig, AssistantMessage, TimerStartOptions, TimerState } from '../types';

let config: AikoConfig;
let timers: TimerState[];
let started: Array<{ seconds: number; options?: TimerStartOptions }>;

beforeEach(() => {
  resetGames();
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
const toolContext = (now: Date, cfg: AikoConfig = config) => ({
  config: cfg,
  save: () => {},
  timers: { getTimers: () => [], start: () => {}, stopAll: () => 0 },
  now: () => now,
  labels: {},
});

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

describe('neue Werkzeuge', () => {
  it('berechnet Kalenderwochen und Monatsraster', () => {
    expect(isoWeek(Date.UTC(2026, 0, 1))).toEqual({ week: 1, year: 2026 });
    expect(isoWeek(Date.UTC(2024, 11, 31))).toEqual({ week: 1, year: 2025 });
    const october = buildMonth(2026, 10, null, new Date(2026, 9, 16));
    const days = october.weeks.flatMap((week) => week.days).filter(Boolean);
    expect(days).toHaveLength(31);
    expect(days.find((cell) => cell!.day === 3)!.holiday).toContain('Einheit');
    expect(ask('Kalender 2026').text).toContain('365 Tage');
    expect(ask('Zeig mir den Oktober').text).toContain('Oktober 2026');
  });

  it('zählt Arbeitstage und rechnet mit ihnen', () => {
    expect(countWorkdays(Date.UTC(2026, 2, 1), Date.UTC(2026, 2, 31), null).count).toBe(22);
    expect(countWorkdays(Date.UTC(2026, 11, 1), Date.UTC(2026, 11, 31), null).count).toBe(22);
    expect(addWorkdays(Date.UTC(2026, 9, 16), 10, null)).toBe(Date.UTC(2026, 9, 30));
    expect(ask('Wie viele Arbeitstage bis Weihnachten?').text).toContain('Arbeitstage');
    expect(ask('Arbeitstage 2026').text).toContain('im Jahr 2026');
  });

  it('nutzt das Bundesland aus den Einstellungen für Feiertage', () => {
    expect(ask('Ist der 3.10.2026 ein Feiertag?').text).toContain('Tag der Deutschen Einheit');
    config.region = 'BY';
    configureEngine(config);
    expect(ask('Feiertage 2026').text).toContain('in Bayern');
  });

  it('versteht Uhrzeiten und Dauern', () => {
    expect(parseClock('8:15')).toBe(495);
    expect(parseDuration('2 h 45 min')).toBe(165);
    expect(parseDuration('1,5 h')).toBe(90);
    expect(ask('8:15 bis 17:30 mit 45 Minuten Pause').text).toContain('8 h 30 min');
  });

  it('erkennt Sternzeichen und chinesische Tierkreiszeichen', () => {
    expect(ask('Sternzeichen am 14.3.').text).toContain('Fische');
    expect(chineseZodiac(1990).animal).toContain('Pferd');
    expect(ask('Chinesisches Tierkreiszeichen 1990').text).toContain('Jahr des Pferdes');
  });

  it('rechnet Küchenmaße und skaliert Rezepte', () => {
    expect(ask('3 EL Öl in ml').text).toContain('45 ml');
    expect(ask('1 Tasse in ml').text).toContain('250 ml');
    const recipe = ask('Rezept 4 auf 2 Personen: 200 g Mehl, 2 Eier').text;
    expect(recipe).toContain('für 2 statt 4');
    expect(recipe).toContain('100 g Mehl');
  });

  it('bewertet Schlafzeiten mit 90-Minuten-Zyklen', () => {
    expect(ask('Wann aufstehen, wenn ich um 23 Uhr schlafen gehe?').text).toContain('06:45 Uhr');
    expect(ask('Wann sollte ich um 23:00 schlafen?').text).toContain('06:45 Uhr');
  });

  it('verschlüsselt, entschlüsselt und knackt Caesar-Codes', () => {
    expect(caesar('Hallo Welt', 3)).toBe('Kdoor Zhow');
    expect(caesar(caesar('Hallo Welt', 3), -3)).toBe('Hallo Welt');
    expect(vigenere('Angriff', 'LEMON')).toBe('Lrsfvqj');
    expect(vigenere(vigenere('Angriff', 'LEMON'), 'LEMON', true)).toBe('Angriff');
    expect(atbash('Hallo')).toBe('Szool');
    expect(crackCaesar('Kdoor Zhow')[0].text).toBe('Hallo Welt');
    expect(ask('Buchstabiere Müller').text).toContain('Umlaut Unna');
  });

  it('bewertet Passwörter und Farbkontraste', () => {
    expect(ask('Wie sicher ist das Passwort korrekt-pferd-batterie-heft?').text).toContain('sehr stark');
    expect(analyzePassword('abc').score).toBeLessThan(analyzePassword('korrekt-pferd-batterie-heft').score);
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 0);
    expect(parseColor('#336699')).toEqual([51, 102, 153]);
    expect(toHex([51, 102, 153])).toBe('#336699');
    expect(ask('Kontrast #ffffff auf #336699').text).toContain('6:1');
  });

  it('verarbeitet CSV, Markdown und Tabellen', () => {
    expect(parseCsv('Name;Alter\nAnna;3').delimiter).toBe(';');
    expect(markdownTable([['a', 'b'], ['1', '2']])).toContain('| a | b |');
  });

  it('liefert Länder-, Element- und Molmasse-Infos', () => {
    expect(findCountry('Japan')?.capital).toBe('Tokio');
    expect(ask('Hauptstadt von Portugal').text).toContain('Lissabon');
    expect(findElement('Wolfram')?.symbol).toBe('W');
    expect(ask('Was ist Wolfram?').text).toContain('Wolfram (W)');
    expect(molarMass('H2O')!.mass).toBeCloseTo(18.015, 2);
  });

  it('rechnet Zahlentheorie', () => {
    expect(gcd([48n, 36n, 120n])).toBe(12n);
    expect(divisors(360)).toHaveLength(24);
    expect(binomial(49, 6)).toBe(13983816n);
    expect(collatz(27).steps).toBe(111);
    expect(ask('Quersumme 98765').text).toContain('35');
  });

  it('berechnet Noten aus Punkten', () => {
    expect(gradeFor(75)[0]).toBe(3);
    expect(pointsToGrade(11)).toContain('2');
    expect(ask('Note bei 42 von 60 Punkten').text).toContain('Note 3');
  });

  it('plant Sparpläne und Kaufkraft', () => {
    expect(ask('Sparplan 200 € monatlich, 6 % Zinsen, 20 Jahre').text).toContain('92.408,18');
    expect(ask('Kaufkraft von 1.000 € in 20 Jahren bei 2 % Inflation').text).toContain('672,97');
  });

  it('startet Spiele und beendet sie wieder', () => {
    ask('Galgenmännchen');
    expect(activeGame()).toBe('hangman');
    ask('Spiel beenden');
    expect(activeGame()).toBeNull();
    ask('Spiel Zahlenraten');
    expect(activeGame()).toBe('guess');
  });

  it('plant Erinnerungen als Timer', () => {
    ask('Erinnere mich morgen um 9 an den Zahnarzt');
    expect(started.at(-1)?.options?.kind).toBe(REMINDER_KIND);
  });

  it('findet Kfz-Kennzeichen', () => {
    expect(ask('Kennzeichen BN').text).toContain('Bonn');
    expect(ask('Woher kommt das Kennzeichen GAP?').text).toContain('Garmisch');
    expect(ask('Kennzeichen von Bonn').text).toContain('BN');
    expect(ask('Kennzeichen in Bayern').text).toContain('Kennzeichen in Bayern');
  });
});

describe('Größen, Laufen, Download, Statistik & neue QR-Codes', () => {
  it('rechnet Download-Zeiten und Datenvolumen', () => {
    const download = ask('Wie lange dauert 4,7 GB bei 50 Mbit/s?');
    expect(download.source).toBe('download');
    expect(download.text).toContain('12 min 32 s');
    expect(download.text).toContain('37,6 Gbit');
    expect(ask('Downloadzeit 25 GB bei 100 Mbit/s').val).toBe(2000);
    expect(ask('Wie viel Datenvolumen bei 10 Mbit/s in 2 Stunden?').text).toContain('9 GB');
    expect(ask('Download 5 GB in 20 Minuten').text).toContain('Mbit/s');
  });

  it('rechnet Schuh-, Kleidungs- und Hosengrößen um', () => {
    expect(ask('Schuhgröße 42').text).toContain('US 9');
    expect(ask('Schuhgröße 42').text).toContain('26,5 cm');
    expect(ask('Schuhgröße 42 in US').text).toContain('US 9 (Herren)');
    expect(ask('US 9 in EU-Schuhgröße').text).toContain('EU 42');
    expect(ask('Damenschuhgröße 40').text).toContain('EU 40');
    expect(ask('Kinderschuhgröße 30').text).toContain('US 12,5');
    expect(ask('Kleidungsgröße 38 in US').text).toContain('US 8');
    expect(ask('Konfektionsgröße Herren 52').text).toContain('US/UK 42');
    expect(ask('Hosengröße 32/34').text).toContain('EU 48');
    expect(ask('Hosengröße 32/34').text).toContain('81,3 cm');
    expect(ask('Kindergröße 104').text).toContain('3–4 Jahre');
    expect(ask('Größentabelle Schuhe').text).toContain('US Herren');
    expect(ask('Größentabelle Kleidung').text).toContain('Konfektion');
  });

  it('plant Lauf-Prognosen, Splits und Pulszonen', () => {
    const prognosis = ask('Prognose 10 km in 52:30');
    expect(prognosis.source).toBe('running');
    expect(prognosis.text).toContain('Riegel');
    expect(prognosis.text).toContain('Halbmarathon');
    expect(ask('Prognose 10 km in 52:30 für Marathon').text).toContain('Marathon');
    expect(ask('Splits 10 km in 50:00').text).toContain('5:00 min/km');
    expect(ask('Splits 10 km in 50:00').text).toContain('| 6 km');
    const zones = ask('Pulszonen bei Ruhepuls 60 und Maximalpuls 185');
    expect(zones.text).toContain('Karvonen');
    expect(zones.text).toContain('148–160');
    expect(ask('Trainingspuls 35 Jahre').text).toContain('220 − 35');
  });

  it('zeigt die Nutzungsstatistik als Diagramm', () => {
    const empty = ask('Meine Statistik');
    expect(empty.source).toBe('usage');
    expect(empty.text).toContain('noch nichts');
    ask('BMI bei 70 kg und 1,75 m');
    ask('1/3 + 1/4');
    const stats = ask('Meine Statistik');
    expect(stats.text).toContain('aus Werkzeugen');
    expect(stats.text).toContain('BMI');
    expect(stats.widget?.type).toBe('chart');
    expect((stats.widget as { svg?: string } | undefined)?.svg).toContain('<svg');
  });

  it('erstellt QR-Codes für Kontakte, Telefon, Standort und Links', () => {
    const contact = ask('QR Kontakt: Name=Max Mustermann; Telefon=+49 228 123456; E-Mail=max@example.de');
    expect(contact.source).toBe('qr');
    expect((contact.widget as { text?: string } | undefined)?.text).toContain('BEGIN:VCARD');
    expect((contact.widget as { text?: string } | undefined)?.text).toContain('TEL:+49 228 123456');
    expect((contact.widget as { text?: string } | undefined)?.text).toContain('END:VCARD');
    expect((ask('QR Telefon: +49 228 123 456').widget as { text?: string } | undefined)?.text).toBe('tel:+49228123456');
    expect((ask('QR Geo: 50,73; 7,09').widget as { text?: string } | undefined)?.text).toBe('geo:50.73,7.09');
    expect((ask('QR URL: example.com').widget as { text?: string } | undefined)?.text).toBe('https://example.com');
  });

  it('erkennt die neuen Werkzeuge in /hilfe und im Slash-Menü', () => {
    expect(ask('/hilfe').text).toContain('Download & Volumen');
    expect(ask('/hilfe').text).toContain('Lauf & Puls');
    expect(ask('/hilfe').text).toContain('Statistik-Dashboard');
    expect(CMD_LIST.map(([command]) => command.toLowerCase())).toContain('/meine statistik');
    expect(CMD_LIST.map(([command]) => command.toLowerCase())).toContain('/schuhgröße 42 in us');
  });
});

describe('Brettspiele: Tic-Tac-Toe, 4 Gewinnt, Sudoku', () => {
  const WIDGET = (r: { widget?: unknown }): Record<string, unknown> => r.widget as Record<string, unknown>;

  it('startet Tic-Tac-Toe mit klickbarem Brett und spielt Züge', () => {
    const r = ask('Tic Tac Toe');
    expect(r.source).toBe('games');
    expect(WIDGET(r)).toMatchObject({ type: 'ttt', board: '         ', over: false });
    expect(r.text).toContain('Tic-Tac-Toe');
    const move = ask('5');
    expect(WIDGET(move)).toMatchObject({ type: 'ttt' });
    expect(String(WIDGET(move).board)).toMatch(/X/);
    expect(String(WIDGET(move).board)).toMatch(/O/);
    expect(activeGame()).toBe('ttt');
    const occupied = ask('5');
    expect(occupied.text).toContain('besetzt');
    const restart = ask('Tic Tac Toe leicht');
    expect(WIDGET(restart)).toMatchObject({ type: 'ttt', board: '         ' });
    expect(restart.text).toContain('leicht');
  });

  it('nimmt den ersten Zug direkt beim Start an', () => {
    resetGames();
    const r = ask('Tic Tac Toe: 5');
    expect(WIDGET(r)).toMatchObject({ type: 'ttt' });
    expect(String(WIDGET(r).board)[4]).toBe('X');
    expect(String(WIDGET(r).board)).toContain('O');
  });

  it('ist im schwer-Modus ungeschlagen (perfektes Minimax)', () => {
    const place = (board: string, i: number, p: string) => board.slice(0, i) + p + board.slice(i + 1);
    for (let first = 0; first < 9; first++) {
      let board = place('         ', first, 'X');
      for (let guard = 0; guard < 12; guard++) {
        let w = tttWinner(board);
        if (w) { expect(w).not.toBe('X'); break; } // Aiko (O) verliert nie
        board = place(board, tttBestMove(board, 'O'), 'O');
        w = tttWinner(board);
        if (w) break;
        board = place(board, tttBestMove(board, 'X'), 'X');
      }
      expect(tttWinner(board)).not.toBe('X');
    }
  });

  it('spielt leicht mit Zufallszügen', () => {
    let calls = 0;
    const move = tttMove('X        ', 'O', 1, () => { calls++; return 0; });
    expect(calls).toBe(1);
    expect(move).toBeGreaterThanOrEqual(0);
  });

  it('erkennt 4-gewinnt-Reihen in alle Richtungen', () => {
    let board = ' '.repeat(42);
    for (const col of [0, 1, 2, 3]) board = c4Drop(board, col, 'X')!.board;
    expect(c4Winner(board)).toBe('X');
    board = ' '.repeat(42);
    for (let i = 0; i < 4; i++) board = c4Drop(board, 6, 'O')!.board;
    expect(c4Winner(board)).toBe('O');
    // Diagonal (unten links nach oben rechts)
    const cells = [[5, 0], [4, 1], [3, 2], [2, 3]];
    let diag = ' '.repeat(42);
    for (const [row, col] of cells) {
      const i = row * 7 + col;
      diag = diag.slice(0, i) + 'X' + diag.slice(i + 1);
    }
    expect(c4Winner(diag)).toBe('X');
    expect(c4Winner(' '.repeat(42))).toBeNull();
  });

  it('blockt gegnerische Drohungen und nutzt eigene Gewinnzüge', () => {
    let board = ' '.repeat(42);
    for (let i = 0; i < 3; i++) board = c4Drop(board, 2, 'X')!.board;
    expect(c4BestMove(board, 'O', 4)).toBe(2);   // senkrechte Drohung blocken
    let mine = ' '.repeat(42);
    for (let i = 0; i < 3; i++) mine = c4Drop(mine, 5, 'O')!.board;
    expect(c4BestMove(mine, 'O', 4)).toBe(5);    // eigener Gewinnzug
  });

  it('startet 4 Gewinnt über die Engine und wirft Spalten', () => {
    resetGames();
    const r = ask('4 Gewinnt');
    expect(WIDGET(r)).toMatchObject({ type: 'c4', board: ' '.repeat(42), over: false });
    expect(r.text).toContain('4 Gewinnt');
    const move = ask('Spalte 4');
    expect(String(WIDGET(move).board)).toMatch(/X/);
    expect(String(WIDGET(move).board)).toMatch(/O/);
    expect(activeGame()).toBe('c4');
    ask('Spiel beenden');
    const fresh = ask('4 Gewinnt: 7');  // nach Ende: Neustart mit erstem Zug
    expect(String(WIDGET(fresh).board).split('X').length - 1).toBe(1); // genau ein X
  });

  it('löst ein bekanntes Sudoku und prüft Eindeutigkeit', () => {
    const KNOWN = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
    const grid = sudokuParse(KNOWN)!;
    expect(grid).toHaveLength(81);
    const solved = sudokuSolve(grid, 2);
    expect(solved.count).toBe(1);
    expect(solved.solutions[0].slice(0, 9).join('')).toBe('534678912');
    expect(sudokuSolve(new Array(81).fill(0), 2).count).toBe(2); // leeres Brett: mehrdeutig
    const broken = sudokuParse(KNOWN.replace(/^5/, '3'))!;       // zweite 3 in Zeile 1
    expect(sudokuSolve(broken, 1).count).toBe(0);
    const hint = sudokuHint(grid)!;
    expect(grid[(hint.row - 1) * 9 + hint.col - 1]).toBe(0);
    expect(hint.value).toBe(solved.solutions[0][(hint.row - 1) * 9 + hint.col - 1]);
    expect(hint.reason).toMatch(/Single/);
  });

  it('generiert eindeutig lösbare Rätsel in drei Schwierigkeiten', () => {
    for (const level of ['leicht', 'mittel', 'schwer'] as const) {
      const { puzzle, solution } = sudokuGenerate(level);
      expect(sudokuSolve(puzzle, 2).count).toBe(1);
      expect(sudokuSolve(puzzle, 1).solutions[0]).toEqual(solution);
      expect(puzzle.filter(Boolean).length).toBeGreaterThanOrEqual(22);
      expect(puzzle.filter(Boolean).length).toBeLessThanOrEqual(45);
    }
  });

  it('spielt Sudoku im Chat: eigenes Rätsel, Vorgaben, Konflikte, Lösung', () => {
    resetGames();
    const KNOWN = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
    const start = ask(`Sudoku: ${KNOWN}`);
    expect(start.text).toContain('eigenes Rätsel');
    expect(activeGame()).toBe('sudoku');
    expect(ask('Z1S1=9').text).toContain('Vorgabe');
    expect(ask('Z1S3=3').text).toContain('passt nicht');
    expect(ask('Z1S3=4').text).toContain('eingetragen');
    const tip = ask('Tipp');
    expect(tip.text).toContain('Tipp');
    const solution = ask('Sudoku Lösung');
    expect(solution.text).toContain('Lösung');
    expect(activeGame()).toBeNull();
    expect(ask('Sudoku Lösung: ' + '0'.repeat(81)).text).toContain('nicht eindeutig');
    expect(ask('Spiel beenden').text.toLowerCase()).toContain('kein spiel');
  });
});

describe('Heute-Übersicht', () => {
  it('zeigt Datum, KW, Mondphase und den nächsten Feiertag', () => {
    const result = ask('Heute');
    expect(result.source).toBe('today');
    expect(result.text).toContain('Kalenderwoche');
    expect(result.text).toMatch(/beleuchtet/);
    expect(result.text).toContain('Feiertag');
    expect(ask('Tagesübersicht').source).toBe('today');
    expect(ask('Was ist heute?').source).toBe('today');
    expect(ask('Übersicht').source).toBe('today');
  });

  it('rechnet mit eingespritztem Datum und Bundesland', () => {
    const now = new Date(2026, 9, 16);
    const card = todayTool.run('Heute', toolContext(now))!.text;
    expect(card).toContain('Freitag, 16. Oktober 2026');
    expect(card).toContain('Kalenderwoche 42');
    expect(card).toContain('bundesweit');
    expect(card).toContain('1. Weihnachtstag');
    expect(card).toContain('in 70 Tagen');
    const nw = clone(config);
    nw.region = 'NW';
    const cardNw = todayTool.run('Heute', toolContext(now, nw))!.text;
    expect(cardNw).toContain('Nordrhein-Westfalen');
    expect(cardNw).toContain('Allerheiligen');
  });

  it('listet Countdowns und laufende Timer auf', () => {
    const now = new Date(2026, 9, 16, 12, 0, 0);
    const cfg = clone(config);
    cfg.countdowns = [{ name: 'Weihnachten', ts: Date.UTC(2026, 11, 24) }];
    const ctx = {
      config: cfg,
      save: () => {},
      timers: {
        getTimers: () => [{ id: 't1', end: now.getTime() + 300_000, dur: 300, label: 'Tee', paused: false }],
        start: () => {},
        stopAll: () => 0,
      },
      now: () => now,
      labels: {},
    };
    const card = todayTool.run('Heute', ctx)!.text;
    expect(card).toContain('Countdowns: **Weihnachten** in 69 Tagen');
    expect(card).toContain('Timer: **Tee** – noch 5 min');
  });
});

describe('Sprüche, Witze & Zitate', () => {
  it('rotiert den Spruch des Tages deterministisch pro Tag', () => {
    const day1 = quotesTool.run('Spruch des Tages', toolContext(new Date(2026, 9, 16)));
    const day1Again = quotesTool.run('Spruch des Tages', toolContext(new Date(2026, 9, 16, 23, 59)));
    const day2 = quotesTool.run('Spruch des Tages', toolContext(new Date(2026, 9, 17)));
    expect(day1!.text).toBe(day1Again!.text);
    expect(day1!.text).toContain('Spruch des Tages');
    expect(day1!.text).not.toBe(day2!.text);
  });

  it('unterscheidet Tages-Tipp und Zufallsauswahl', () => {
    const daily = quotesTool.run('Zitat des Tages', toolContext(new Date(2026, 9, 16)))!;
    expect(daily.text).toContain('Zitat des Tages');
    expect(daily.text).toContain('—');
    const random = quotesTool.run('Zitat', toolContext(new Date(2026, 9, 16)))!;
    expect(random.text).not.toContain('Zitat des Tages');
    expect(random.text).toContain('—');
    expect(quotesTool.run('Flachwitz', toolContext(new Date(2026, 9, 16)))!.text.length).toBeGreaterThan(10);
  });

  it('antwortet aus der Sammlung und lässt die Witz-Regel unberührt', () => {
    expect(ask('Spruch des Tages').source).toBe('quotes');
    expect(ask('Zitat').source).toBe('quotes');
    expect(ask('Witz des Tages').source).toBe('quotes');
    expect(ask('Witz').source).toBe('rule');
    expect(ask('Erzähl mir einen Witz').source).toBe('rule');
  });
});
