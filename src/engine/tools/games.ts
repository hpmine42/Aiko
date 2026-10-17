import type { Tool, ToolResult } from './types';
import { clean, fmtN, pick, randomInt } from './shared';
import { tttMove, tttRender, tttWinner } from './tictactoe';
import { c4BestMove, c4Drop, c4Render, c4Winner } from './connect4';
import { sudokuGenerate, sudokuHint, sudokuParse, sudokuRender, sudokuSolve, type SudokuGrid } from './sudoku';

/* Small chat games with in-memory state: number guessing, rock-paper-scissors, mental arithmetic, hangman, quiz. */

type Game =
  | { kind: 'guess'; target: number; max: number; tries: number }
  | { kind: 'math'; question: string; answer: number; score: number; total: number }
  | { kind: 'hangman'; word: string; hint: string; guessed: Set<string>; wrong: number }
  | { kind: 'quiz'; index: number; score: number; asked: number[] }
  | { kind: 'ttt'; board: string; diff: number }
  | { kind: 'c4'; board: string; diff: number }
  | { kind: 'sudoku'; puzzle: SudokuGrid; solution: SudokuGrid; current: SudokuGrid; errors: number; hints: number; level: string };

let game: Game | null = null;
const rpsScore = { me: 0, you: 0, draw: 0 };
const tttScore = { me: 0, you: 0, draw: 0 };
const c4Score = { me: 0, you: 0, draw: 0 };

export function resetGames(): void {
  game = null;
  rpsScore.me = 0; rpsScore.you = 0; rpsScore.draw = 0;
  tttScore.me = 0; tttScore.you = 0; tttScore.draw = 0;
  c4Score.me = 0; c4Score.you = 0; c4Score.draw = 0;
}
export const activeGame = (): string | null => game?.kind ?? null;

const HANGMAN: Array<[string, string]> = [
  ['BIBLIOTHEK', 'Ort voller Bücher'], ['SCHMETTERLING', 'Insekt mit bunten Flügeln'], ['LEUCHTTURM', 'Zeigt Schiffen den Weg'], ['KAFFEEMASCHINE', 'Steht in vielen Küchen'], ['REGENBOGEN', 'Erscheint nach dem Regen'], ['FAHRRAD', 'Zwei Räder, keine Abgase'], ['SONNENBLUME', 'Gelbe Pflanze, dreht sich zum Licht'], ['WASSERFALL', 'Fließt steil nach unten'], ['SCHNEEMANN', 'Winterfigur mit Möhrennase'], ['ABENTEUER', 'Aufregendes Erlebnis'], ['GEHEIMNIS', 'Was niemand wissen soll'], ['KROKODIL', 'Reptil mit vielen Zähnen'], ['PINGUIN', 'Vogel, der nicht fliegt, aber schwimmt'], ['ERDBEERE', 'Rote Frucht mit Kernen außen'], ['ORCHESTER', 'Viele Musiker zusammen'], ['ZAHNBUERSTE', 'Morgens und abends im Einsatz'], ['TASCHENLAMPE', 'Licht für unterwegs'], ['BAUMHAUS', 'Hütte in der Krone'], ['KOMPASS', 'Zeigt nach Norden'], ['VULKAN', 'Berg, der Feuer spuckt'],
];

const QUIZ: Array<{ q: string; a: string[]; info: string }> = [
  { q: 'Wie viele Bundesländer hat Deutschland?', a: ['16', 'sechzehn'], info: 'Seit 1990 sind es 16 – drei davon Stadtstaaten (Berlin, Hamburg, Bremen).' },
  { q: 'Welcher Planet ist der größte im Sonnensystem?', a: ['jupiter'], info: 'Jupiter hat mehr als die doppelte Masse aller anderen Planeten zusammen.' },
  { q: 'Wie heißt die Hauptstadt von Australien?', a: ['canberra'], info: 'Nicht Sydney – Canberra wurde 1913 als Kompromiss zwischen Sydney und Melbourne gegründet.' },
  { q: 'Wie viele Zähne hat ein erwachsener Mensch normalerweise (mit Weisheitszähnen)?', a: ['32'], info: '32 – ohne Weisheitszähne 28.' },
  { q: 'Welches chemische Element hat das Symbol Au?', a: ['gold'], info: 'Vom lateinischen „aurum“.' },
  { q: 'In welchem Jahr fiel die Berliner Mauer?', a: ['1989'], info: 'Am 9. November 1989.' },
  { q: 'Welcher Fluss ist der längste in Deutschland (gemessen am Abschnitt in Deutschland)?', a: ['rhein'], info: 'Der Rhein fließt rund 865 km durch Deutschland; die Donau ist insgesamt länger, davon aber nur 647 km hier.' },
  { q: 'Wie viele Saiten hat eine klassische Gitarre?', a: ['6', 'sechs'], info: 'Sechs – E A D G H E.' },
  { q: 'Wer schrieb „Faust“?', a: ['goethe', 'johann wolfgang von goethe'], info: 'Johann Wolfgang von Goethe, Teil 1 erschien 1808.' },
  { q: 'Wie heißt der höchste Berg Deutschlands?', a: ['zugspitze'], info: '2.962 m, in den Bayerischen Alpen.' },
  { q: 'Wie viele Minuten hat ein Tag?', a: ['1440'], info: '24 × 60 = 1.440 Minuten.' },
  { q: 'Welches Tier ist das größte Landsäugetier?', a: ['elefant', 'afrikanischer elefant'], info: 'Der Afrikanische Elefant wiegt bis zu 6 Tonnen.' },
  { q: 'Welches Gas atmen Pflanzen bei der Photosynthese ein?', a: ['kohlendioxid', 'co2', 'kohlenstoffdioxid'], info: 'CO₂ wird mit Wasser und Licht zu Zucker und Sauerstoff.' },
  { q: 'Wie viele Spieler stehen pro Mannschaft beim Fußball auf dem Platz?', a: ['11', 'elf'], info: 'Elf, inklusive Torwart.' },
  { q: 'Welcher Ozean ist der größte?', a: ['pazifik', 'pazifischer ozean', 'der pazifik'], info: 'Der Pazifik bedeckt rund ein Drittel der Erdoberfläche.' },
  { q: 'Wie heißt die Währung Japans?', a: ['yen'], info: 'Der Yen (¥, JPY).' },
  { q: 'Wie viele Knochen hat der erwachsene Mensch ungefähr?', a: ['206'], info: 'Etwa 206 – Babys haben über 300, viele verwachsen später.' },
  { q: 'Welcher Komponist schrieb die „Neunte Sinfonie“ mit der „Ode an die Freude“?', a: ['beethoven', 'ludwig van beethoven'], info: 'Ludwig van Beethoven, uraufgeführt 1824 in Wien.' },
  { q: 'Wie lautet die Quadratwurzel aus 144?', a: ['12', 'zwölf'], info: '12 × 12 = 144.' },
  { q: 'Welches ist das kleinste Land der Welt?', a: ['vatikan', 'vatikanstadt', 'der vatikan'], info: 'Die Vatikanstadt mit rund 0,44 km².' },
  { q: 'Wie heißt der Erfinder des Buchdrucks mit beweglichen Lettern in Europa?', a: ['gutenberg', 'johannes gutenberg'], info: 'Johannes Gutenberg, Mainz, um 1450.' },
  { q: 'Wie viele Kontinente gibt es nach gängiger Zählung?', a: ['7', 'sieben'], info: 'Sieben: Afrika, Antarktis, Asien, Australien/Ozeanien, Europa, Nord- und Südamerika.' },
  { q: 'Welcher Stoff macht Blätter grün?', a: ['chlorophyll', 'blattgrün'], info: 'Chlorophyll fängt das Licht für die Photosynthese ein.' },
  { q: 'Welche Stadt ist die Hauptstadt von Kanada?', a: ['ottawa'], info: 'Ottawa – nicht Toronto oder Montreal.' },
  { q: 'Wie lange braucht das Licht ungefähr von der Sonne zur Erde?', a: ['8 minuten', '8', 'acht minuten', '8 min', 'ca. 8 minuten'], info: 'Rund 8 Minuten und 20 Sekunden.' },
  { q: 'Wie viele Herzen hat ein Oktopus?', a: ['3', 'drei'], info: 'Drei – zwei für die Kiemen, eines für den Körper.' },
  { q: 'Wie heißt das längste Gebirge der Welt an Land?', a: ['anden'], info: 'Die Anden erstrecken sich über rund 7.000 km.' },
  { q: 'Welche Programmiersprache ist nach einer Schlange benannt – angeblich aber nach einer Comedy-Truppe?', a: ['python'], info: 'Python – benannt nach Monty Python.' },
  { q: 'Wie viele Tasten hat ein normales Klavier?', a: ['88'], info: '88 – 52 weiße und 36 schwarze.' },
  { q: 'In welchem Jahr landeten die ersten Menschen auf dem Mond?', a: ['1969'], info: 'Am 20. Juli 1969 mit Apollo 11.' },
];

const norm = (s: string): string => s.toLowerCase().replace(/[.!?]/g, '').replace(/\s+/g, ' ').trim();

function hangmanBoard(g: Extract<Game, { kind: 'hangman' }>): string {
  const shown = g.word.split('').map((ch) => (g.guessed.has(ch) ? ch : '_')).join(' ');
  const gallows = [' +---+', ` |   ${g.wrong >= 1 ? 'O' : ' '}`, ` |  ${g.wrong >= 3 ? '/' : ' '}${g.wrong >= 2 ? '|' : ' '}${g.wrong >= 4 ? '\\' : ' '}`, ` |  ${g.wrong >= 5 ? '/' : ' '} ${g.wrong >= 6 ? '\\' : ' '}`, '==='].join('\n');
  const wrongLetters = [...g.guessed].filter((ch) => !g.word.includes(ch)).join(', ');
  return `\`${shown}\`  (${g.word.length} Buchstaben, Tipp: ${g.hint})\n\n\`\`\`text\n${gallows}\n\`\`\`\nFehlversuche: ${g.wrong}/6${wrongLetters ? ` (${wrongLetters})` : ''}`;
}

function mathQuestion(level: number): { question: string; answer: number } {
  const op = pick(['+', '-', '×', '÷'] as const);
  const range = level >= 3 ? 100 : level === 2 ? 50 : 20;
  let a = randomInt(range) + 2;
  let b = randomInt(range) + 2;
  if (op === '-') { if (b > a) [a, b] = [b, a]; return { question: `${a} − ${b}`, answer: a - b }; }
  if (op === '×') { a = randomInt(level >= 3 ? 25 : 12) + 2; b = randomInt(12) + 2; return { question: `${a} × ${b}`, answer: a * b }; }
  if (op === '÷') { b = randomInt(11) + 2; const q = randomInt(12) + 2; return { question: `${b * q} ÷ ${b}`, answer: q }; }
  return { question: `${a} + ${b}`, answer: a + b };
}

const start = (text: string, widget?: ToolResult['widget']): ToolResult => ({ text, source: 'games', widget: widget ?? null });

export const gameTool: Tool = {
  id: 'games',
  label: 'Spiele',
  help: '- **Spiele:** „Zahlenraten“, „Schere Stein Papier: Stein“, „Kopfrechnen“, „Galgenmännchen“, „Quiz“, „Tic Tac Toe“, „4 Gewinnt“, „Sudoku (leicht/mittel/schwer)“ – mit „Spiel beenden“ aufhören',
  run(input) {
    const s = clean(input);
    const lower = s.toLowerCase();

    if (/^(?:spiel\s+(?:beenden|abbrechen|stoppen|aufgeben)|aufgeben|ich\s+gebe\s+auf|beende\s+das\s+spiel|stopp\s+spiel|lösung\s+bitte)$/i.test(lower)) {
      if (!game) {
        const scores = [];
        if (rpsScore.me + rpsScore.you + rpsScore.draw) scores.push(`Schere-Stein-Papier: du ${rpsScore.you} – ich ${rpsScore.me} (${rpsScore.draw} unentschieden)`);
        if (tttScore.me + tttScore.you + tttScore.draw) scores.push(`Tic-Tac-Toe: du ${tttScore.you} – ich ${tttScore.me} (${tttScore.draw} unentschieden)`);
        if (c4Score.me + c4Score.you + c4Score.draw) scores.push(`4 Gewinnt: du ${c4Score.you} – ich ${c4Score.me} (${c4Score.draw} unentschieden)`);
        return start(scores.length ? `Kein Spiel aktiv. Stände: ${scores.join(' · ')}.` : 'Gerade läuft kein Spiel. Starte eins mit „Zahlenraten“, „Kopfrechnen“, „Galgenmännchen“, „Quiz“, „Tic Tac Toe“, „4 Gewinnt“ oder „Sudoku“.');
      }
      const g = game;
      game = null;
      if (g.kind === 'guess') return start(`Aufgegeben – die Zahl war **${g.target}**. Neue Runde mit „Zahlenraten“.`);
      if (g.kind === 'math') return start(`Kopfrechnen beendet: **${g.score} von ${g.total} richtig**${g.total ? ` (${fmtN(g.score / g.total * 100, 0)} %)` : ''}.`);
      if (g.kind === 'hangman') return start(`Das Wort war **${g.word}**. Neue Runde mit „Galgenmännchen“.`);
      if (g.kind === 'ttt') return start(`Tic-Tac-Toe beendet. Stand: du ${tttScore.you} – ich ${tttScore.me} (${tttScore.draw} unentschieden).`);
      if (g.kind === 'c4') return start(`4 Gewinnt beendet. Stand: du ${c4Score.you} – ich ${c4Score.me} (${c4Score.draw} unentschieden).`);
      if (g.kind === 'sudoku') return start(`Sudoku beendet – hier ist die Lösung:

${sudokuRender(g.solution)}`);
      return start(`Quiz beendet: **${g.score} von ${g.asked.length} richtig**.`);
    }

    // --- Zahlenraten ---
    let m: RegExpMatchArray | null;
    if ((m = lower.match(/^(?:spiel\s+)?(?:(?:lass\s+uns\s+|wollen\s+wir\s+)?zahlenraten(?:\s+spielen)?|rate(?:spiel)?\s+zahl|ich\s+will\s+zahlenraten|zahl\s+raten|denk\s+dir\s+eine\s+zahl(?:\s+aus)?)(?:\s+(?:bis|zwischen\s+1\s+und)\s+(\d{1,6}))?$/))) {
      const max = m[1] ? Math.max(10, Number(m[1])) : 100;
      game = { kind: 'guess', target: randomInt(max) + 1, max, tries: 0 };
      return start(`Ich denke an eine Zahl zwischen **1 und ${fmtN(max)}**. Rate! (Schreibe einfach die Zahl, „Spiel beenden“ bricht ab.)`);
    }
    if (game?.kind === 'guess' && /^\d{1,7}$/.test(lower)) {
      const g = game;
      const n = Number(lower);
      g.tries += 1;
      if (n === g.target) {
        game = null;
        const optimal = Math.ceil(Math.log2(g.max));
        return start(`🎉 **Richtig, ${n}!** Du hast ${g.tries} ${g.tries === 1 ? 'Versuch' : 'Versuche'} gebraucht${g.tries <= optimal ? ' – optimal (binäre Suche)!' : ` (mit Halbieren wären höchstens ${optimal} nötig).`}\n\nNoch eine Runde? „Zahlenraten“ oder „Zahlenraten bis 1000“.`);
      }
      const diff = Math.abs(n - g.target);
      const warmth = diff <= Math.max(2, g.max * 0.02) ? ' 🔥 Ganz heiß!' : diff <= g.max * 0.1 ? ' 🌡️ Warm.' : diff >= g.max * 0.5 ? ' 🧊 Eiskalt.' : '';
      return start(`${n < g.target ? '📈 **Höher!**' : '📉 **Niedriger!**'}${warmth} (Versuch ${g.tries})`);
    }

    // --- Schere, Stein, Papier ---
    if ((m = lower.match(/^(?:schere[,\s]+stein[,\s]+papier|ssp|schnick\s*schnack\s*schnuck)\s*[:\-–]?\s*(schere|stein|papier|brunnen)?$/))) {
      if (!m[1]) return start('Schere, Stein, Papier – sag deine Wahl: „Schere Stein Papier: Stein“. Papier schlägt Stein, Stein schlägt Schere, Schere schlägt Papier.');
      const you = m[1] === 'brunnen' ? 'stein' : m[1];
      const me = pick(['schere', 'stein', 'papier'] as const);
      const beats: Record<string, string> = { schere: 'papier', stein: 'schere', papier: 'stein' };
      const emoji: Record<string, string> = { schere: '✌️', stein: '✊', papier: '✋' };
      let verdict: string;
      if (you === me) { rpsScore.draw += 1; verdict = 'Unentschieden!'; }
      else if (beats[you] === me) { rpsScore.you += 1; verdict = `**Du gewinnst** – ${you} schlägt ${me}.`; }
      else { rpsScore.me += 1; verdict = `**Ich gewinne** – ${me} schlägt ${you}.`; }
      return start(`Du: ${emoji[you]} ${you} · Ich: ${emoji[me]} ${me}\n\n${verdict}\n\nStand: du ${rpsScore.you} – ich ${rpsScore.me} (${rpsScore.draw} unentschieden)${m[1] === 'brunnen' ? '\n\n_Brunnen zählt bei mir wie Stein – klassische Regeln._' : ''}`);
    }

    // --- Kopfrechnen ---
    if ((m = lower.match(/^(?:kopfrechnen|kopfrechen-?(?:quiz|training|aufgabe)|rechen(?:aufgabe|quiz|training)|mathe-?(?:quiz|aufgabe|training)|1x1|einmaleins)(?:\s+(?:leicht|einfach|mittel|schwer))?(?:\s+starten)?$/))) {
      const level = /schwer/.test(lower) ? 3 : /mittel/.test(lower) ? 2 : 1;
      const q = mathQuestion(level);
      game = { kind: 'math', question: q.question, answer: q.answer, score: 0, total: 0 };
      return start(`🧮 Kopfrechnen (${level === 3 ? 'schwer' : level === 2 ? 'mittel' : 'leicht'}): **${q.question} = ?**\n\nAntworte mit der Zahl; „Spiel beenden“ zeigt den Stand.`);
    }
    if (game?.kind === 'math' && /^-?\d{1,7}$/.test(lower)) {
      const g = game;
      const n = Number(lower);
      g.total += 1;
      const correct = n === g.answer;
      if (correct) g.score += 1;
      const feedback = correct ? '✅ Richtig!' : `❌ Leider nicht – ${g.question} = **${fmtN(g.answer)}**.`;
      const level = g.total >= 10 ? 3 : g.total >= 5 ? 2 : 1;
      const next = mathQuestion(level);
      g.question = next.question;
      g.answer = next.answer;
      return start(`${feedback} Stand: ${g.score}/${g.total}\n\nNächste Aufgabe: **${next.question} = ?**`);
    }

    // --- Galgenmännchen ---
    if (/^(?:galgenmännchen|galgenmaennchen|hangman|wort\s+raten|wörter\s+raten)(?:\s+spielen|\s+starten)?$/.test(lower)) {
      const [word, hint] = pick(HANGMAN);
      game = { kind: 'hangman', word, hint, guessed: new Set(), wrong: 0 };
      return start(`🪢 Galgenmännchen! Rate Buchstaben (einzeln) oder gleich das ganze Wort.\n\n${hangmanBoard(game)}`);
    }
    if (game?.kind === 'hangman' && /^[a-zäöüß]$/i.test(s)) {
      const g = game;
      const letter = s.toUpperCase().replace('Ä', 'AE').replace('Ö', 'OE').replace('Ü', 'UE').replace('ß', 'SS').slice(0, 1);
      if (g.guessed.has(letter)) return start(`„${letter}“ hattest du schon.\n\n${hangmanBoard(g)}`);
      g.guessed.add(letter);
      if (!g.word.includes(letter)) g.wrong += 1;
      if (g.word.split('').every((ch) => g.guessed.has(ch))) { game = null; return start(`🎉 **${g.word}** – gelöst mit ${g.wrong} Fehlversuchen!\n\nNoch eine Runde? „Galgenmännchen“.`); }
      if (g.wrong >= 6) { game = null; return start(`💀 Verloren – das Wort war **${g.word}**.\n\nNoch eine Runde? „Galgenmännchen“.`); }
      return start(`${g.word.includes(letter) ? `✅ „${letter}“ ist drin!` : `❌ Kein „${letter}“.`}\n\n${hangmanBoard(g)}`);
    }
    if (game?.kind === 'hangman' && /^[a-zäöüß]{3,}$/i.test(s)) {
      const g = game;
      const guess = s.toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS');
      if (guess === g.word) { game = null; return start(`🎉 **${g.word}** – richtig geraten!\n\nNoch eine Runde? „Galgenmännchen“.`); }
      g.wrong += 1;
      if (g.wrong >= 6) { game = null; return start(`💀 Verloren – das Wort war **${g.word}**.`); }
      return start(`❌ „${s}“ ist es nicht.\n\n${hangmanBoard(g)}`);
    }

    // --- Quiz ---
    if (/^(?:quiz|quizfrage|quizrunde|wissensquiz|stell\s+mir\s+eine\s+quizfrage|frag\s+mich\s+was|allgemeinwissen)(?:\s+(?:starten|bitte|spielen))?$/.test(lower)) {
      const index = randomInt(QUIZ.length);
      game = { kind: 'quiz', index, score: 0, asked: [index] };
      return start(`❓ **${QUIZ[index].q}**\n\n(Antwort einfach eintippen; „weiter“ überspringt, „Spiel beenden“ zeigt den Stand.)`);
    }
    if (game?.kind === 'quiz' && s.length <= 60) {
      const g = game;
      const current = QUIZ[g.index];
      const skip = /^(?:weiter|nächste|naechste|skip|keine\s+ahnung|weiß\s+nicht|weiss\s+nicht)$/.test(lower);
      const correct = !skip && current.a.some((a) => norm(a) === norm(s) || (norm(s).length >= 3 && norm(a).includes(norm(s)) && norm(s).length >= norm(a).length - 3));
      if (correct) g.score += 1;
      const remaining = QUIZ.map((_, i) => i).filter((i) => !g.asked.includes(i));
      const feedback = skip ? `Die Antwort wäre **${current.a[0]}** gewesen. ${current.info}` : correct ? `✅ **Richtig!** ${current.info}` : `❌ Leider nicht – richtig ist **${current.a[0]}**. ${current.info}`;
      if (!remaining.length) { game = null; return start(`${feedback}\n\n🏁 Alle Fragen durch: **${g.score} von ${g.asked.length} richtig**.`); }
      const next = pick(remaining);
      g.index = next;
      g.asked.push(next);
      return start(`${feedback}\n\nStand: ${g.score}/${g.asked.length - 1}\n\n❓ **${QUIZ[next].q}**`);
    }

    // --- Tic-Tac-Toe ---
    const tttName = /(?:tic\s*tac\s*toe|drei\s*gewinnt|dreigewinnt|ttt)\b/i;
    const tttDiffOf = (text: string): number => (/schwer/.test(text) ? 3 : /mittel/.test(text) ? 2 : /leicht|einfach/.test(text) ? 1 : 0);
    const tttTail = (text: string): string => text.replace(tttName, ' ');
    if (game?.kind === 'ttt') {
      const g = game;
      const tail = tttTail(lower);
      const mm = tail.match(/^[^0-9]*([1-9])\s*$/);
      const restart = tttDiffOf(tail);
      if (mm && !restart) {
        const cell = Number(mm[1]) - 1;
        if (g.board[cell] !== ' ') return start(`Feld ${mm[1]} ist schon besetzt – wähle ein freies Feld (1–9).\n\n${tttRender(g.board)}`, { type: 'ttt', board: g.board, over: false });
        let board = g.board.slice(0, cell) + 'X' + g.board.slice(cell + 1);
        let w = tttWinner(board);
        if (w === 'X') { game = null; tttScore.you++; return start(`🎉 **Du gewinnst!** Drei in Reihe.\n\n${tttRender(board)}\n\nStand: du ${tttScore.you} – ich ${tttScore.me} (${tttScore.draw} unentschieden). Nochmal? „Tic Tac Toe“.`, { type: 'ttt', board, over: true }); }
        if (w === 'D') { game = null; tttScore.draw++; return start(`🤝 **Unentschieden!**\n\n${tttRender(board)}\n\nStand: du ${tttScore.you} – ich ${tttScore.me} (${tttScore.draw} unentschieden).`, { type: 'ttt', board, over: true }); }
        const mine = tttMove(board, 'O', g.diff);
        if (mine >= 0) board = board.slice(0, mine) + 'O' + board.slice(mine + 1);
        w = tttWinner(board);
        if (w === 'O') { game = null; tttScore.me++; return start(`😅 **Ich gewinne** – meine drei sind komplett.\n\n${tttRender(board)}\n\nStand: du ${tttScore.you} – ich ${tttScore.me} (${tttScore.draw} unentschieden). Revanche? „Tic Tac Toe“.`, { type: 'ttt', board, over: true }); }
        if (w === 'D') { game = null; tttScore.draw++; return start(`🤝 **Unentschieden!**\n\n${tttRender(board)}\n\nStand: du ${tttScore.you} – ich ${tttScore.me} (${tttScore.draw} unentschieden).`, { type: 'ttt', board, over: true }); }
        game = { kind: 'ttt', board, diff: g.diff };
        return start(`Du: **X** auf Feld ${cell + 1} · Ich: **O** auf Feld ${mine + 1}. Du bist am Zug!\n\n${tttRender(board)}`, { type: 'ttt', board, over: false });
      }
      if (!mm && !restart) {
        return start(`Du bist **X** und am Zug – klick ein Feld oder schreibe die Nummer (1–9).\n\n${tttRender(g.board)}`, { type: 'ttt', board: g.board, over: false });
      }
    }
    if (tttName.test(lower) && (game?.kind !== 'ttt' || tttDiffOf(tttTail(lower)))) {
      const diff = tttDiffOf(lower) || 3;
      let board = '         ';
      const first = tttTail(lower).match(/\b([1-9])\b/);
      if (first) {
        const cell = Number(first[1]) - 1;
        board = board.slice(0, cell) + 'X' + board.slice(cell + 1);
        const mine = tttMove(board, 'O', diff);
        if (mine >= 0) board = board.slice(0, mine) + 'O' + board.slice(mine + 1);
        game = { kind: 'ttt', board, diff };
        return start(`⭕ **Tic-Tac-Toe** (${diff === 3 ? 'schwer – ungeschlagen' : diff === 2 ? 'mittel' : 'leicht'}). Du: **X** auf ${cell + 1} · Ich: **O** auf ${mine + 1}.\n\n${tttRender(board)}\n\nDu bist am Zug – Feldnummer (1–9) schreiben oder klicken.`, { type: 'ttt', board, over: false });
      }
      game = { kind: 'ttt', board, diff };
      return start(`⭕ **Tic-Tac-Toe** (${diff === 3 ? 'schwer – ungeschlagen' : diff === 2 ? 'mittel' : 'leicht'}). Du bist **X** und beginnst – klick ein Feld im Brett oder schreibe die Feldnummer (1–9). „Spiel beenden“ beendet.\n\n${tttRender(board)}`, { type: 'ttt', board, over: false });
    }

    // --- 4 Gewinnt ---
    const c4Name = /(?:4\s*gewinnt|vier\s*gewinnt|viergewinnt|connect\s*four)\b/i;
    const c4DiffOf = (text: string): number => (/schwer/.test(text) ? 3 : /mittel/.test(text) ? 2 : /leicht|einfach/.test(text) ? 1 : 0);
    const c4Tail = (text: string): string => text.replace(c4Name, ' ');
    const c4Depth = (diff: number): number => (diff >= 3 ? 6 : diff === 2 ? 4 : 1);
    if (game?.kind === 'c4') {
      const g = game;
      const tail = c4Tail(lower);
      const mm = tail.match(/^[^0-9]*([1-7])\s*$/);
      const restart = c4DiffOf(tail);
      if (mm && !restart) {
        const col = Number(mm[1]) - 1;
        const drop = c4Drop(g.board, col, 'X');
        if (!drop) return start(`Spalte ${col + 1} ist voll – wähle eine andere (1–7).\n\n${c4Render(g.board)}`, { type: 'c4', board: g.board, over: false });
        let board = drop.board;
        let w = c4Winner(board);
        if (w === 'X') { game = null; c4Score.you++; return start(`🎉 **Du gewinnst!** Vier in Reihe.\n\n${c4Render(board)}\n\nStand: du ${c4Score.you} – ich ${c4Score.me} (${c4Score.draw} unentschieden). Revanche? „4 Gewinnt“.`, { type: 'c4', board, over: true }); }
        if (w === 'D') { game = null; c4Score.draw++; return start(`🤝 **Unentschieden** – das Brett ist voll.\n\n${c4Render(board)}`, { type: 'c4', board, over: true }); }
        const myCol = c4BestMove(board, 'O', c4Depth(g.diff));
        const myDrop = myCol >= 0 ? c4Drop(board, myCol, 'O') : null;
        if (myDrop) board = myDrop.board;
        w = c4Winner(board);
        if (w === 'O') { game = null; c4Score.me++; return start(`🔴 **Ich gewinne** – meine vier sind komplett.\n\n${c4Render(board)}\n\nStand: du ${c4Score.you} – ich ${c4Score.me} (${c4Score.draw} unentschieden). Revanche? „4 Gewinnt“.`, { type: 'c4', board, over: true }); }
        if (w === 'D') { game = null; c4Score.draw++; return start(`🤝 **Unentschieden** – das Brett ist voll.\n\n${c4Render(board)}`, { type: 'c4', board, over: true }); }
        game = { kind: 'c4', board, diff: g.diff };
        return start(`Du wirfst **X** in Spalte ${col + 1} · Ich antworte mit **O** in Spalte ${myCol + 1}.\n\n${c4Render(board)}\n\nDu bist am Zug – Spalte (1–7) schreiben oder klicken.`, { type: 'c4', board, over: false });
      }
      if (!mm && !restart) {
        return start(`Du bist **X** und am Zug – Spalte (1–7) schreiben oder oben klicken.\n\n${c4Render(g.board)}`, { type: 'c4', board: g.board, over: false });
      }
    }
    if (c4Name.test(lower) && (game?.kind !== 'c4' || c4DiffOf(c4Tail(lower)))) {
      const diff = c4DiffOf(lower) || 3;
      const first = c4Tail(lower).match(/\b([1-7])\b/);
      let board = ' '.repeat(42);
      if (first) {
        const col = Number(first[1]) - 1;
        const drop = c4Drop(board, col, 'X');
        if (drop) {
          board = drop.board;
          const myCol = c4BestMove(board, 'O', c4Depth(diff));
          const myDrop = myCol >= 0 ? c4Drop(board, myCol, 'O') : null;
          if (myDrop) board = myDrop.board;
          game = { kind: 'c4', board, diff };
          return start(`🔴 **4 Gewinnt** (${diff === 3 ? 'schwer' : diff === 2 ? 'mittel' : 'leicht'}). Du: **X** in Spalte ${col + 1} · Ich: **O** in Spalte ${myCol + 1}.\n\n${c4Render(board)}\n\nDu bist am Zug – Spalte (1–7) schreiben oder klicken.`, { type: 'c4', board, over: false });
        }
      }
      game = { kind: 'c4', board, diff };
      return start(`🔴 **4 Gewinnt** (${diff === 3 ? 'schwer' : diff === 2 ? 'mittel' : 'leicht'}) – du bist **X** und wirfst zuerst. Spalte (1–7) schreiben oder oben klicken; „Spiel beenden“ beendet.\n\n${c4Render(board)}`, { type: 'c4', board, over: false });
    }

    // --- Sudoku ---
    let sm: RegExpMatchArray | null;
    if ((sm = lower.match(/^sudoku\s+l(?:ö|oe)sung(?:\s+bitte)?\s*[:：]?\s*([\s\S]+)$/)) || (sm = lower.match(/^l(?:ö|oe)se\s+sudoku\s*[:：]?\s*([\s\S]+)$/))) {
      const grid = sudokuParse(sm[1]);
      if (!grid) return start('Für den Löser brauche ich **81 Ziffern** (0, . oder – für leere Felder), z. B.:\n\n`Sudoku Lösung: 530070000600195000098000060800060003400803001700020006060000280000419005000080079`');
      const { solutions, count } = sudokuSolve(grid, 2);
      if (!count) return start('Dieses Sudoku hat **keine Lösung** – irgendwo widersprechen sich Zahlen. Prüfe Zeilen, Spalten und Blöcke.');
      const note = count > 1 ? '_Achtung: dieses Rätsel ist nicht eindeutig – hier ist **eine** mögliche Lösung._' : '_Eindeutig lösbar._';
      return start(`**Lösung:**\n\n${sudokuRender(solutions[0])}\n\n${note}`);
    }
    if (game?.kind === 'sudoku') {
      const g = game;
      if (/^(?:sudoku\s+)?l(?:ö|oe)sung(?:\s+bitte)?$/.test(lower)) {
        game = null;
        return start(`Hier ist die Lösung:\n\n${sudokuRender(g.solution)}\n\n_Du hattest ${g.errors} Fehlversuche und ${g.hints} Tipps._ Noch eins? „Sudoku“, „Sudoku mittel“ oder „Sudoku schwer“.`);
      }
      if (/^(?:sudoku\s+)?(?:tipp|hinweis)(?:\s+bitte)?$/.test(lower)) {
        g.hints += 1;
        const hint = sudokuHint(g.current);
        if (hint) {
          g.current[(hint.row - 1) * 9 + hint.col - 1] = hint.value;
          if (!g.current.includes(0)) {
            const done = g.current.every((v, i) => v === g.solution[i]);
            game = null;
            return start(done ? `💡 ${hint.reason}\n\n🎉 **Damit ist das Sudoku komplett – alles korrekt!** (${g.errors} Fehlversuche, ${g.hints} Tipps)\n\n${sudokuRender(g.current)}` : `💡 ${hint.reason}\n\n${sudokuRender(g.current)}`);
          }
          return start(`💡 **Tipp:** ${hint.reason}\n\nIch habe die Ziffer schon eingetragen:\n\n${sudokuRender(g.current)}`);
        }
        const idx = g.current.findIndex((v, i) => !v && !g.puzzle[i]);
        const firstEmpty = idx >= 0 ? idx : g.current.findIndex((v) => !v);
        if (firstEmpty < 0) return start(`Alles ausgefüllt – prüfe mit „Sudoku Lösung“ oder korrigiere mit „Z<r>S<c>=0“.`);
        const row = Math.floor(firstEmpty / 9) + 1;
        const col = (firstEmpty % 9) + 1;
        g.current[firstEmpty] = g.solution[firstEmpty];
        return start(`💡 Mit einfacher Logik (Single) geht es gerade nicht weiter – ich decke auf: **Zeile ${row}, Spalte ${col} = ${g.solution[firstEmpty]}**.\n\n${sudokuRender(g.current)}\n\n_Für die harten Stellen braucht es Paare, X-Wing & Co. – oder weitere Tipps._`);
      }
      if (/^sudoku(?:\s+(?:leicht|einfach|mittel|schwer))?(?:\s+(?:spielen|starten|neu|neues))?$/.test(lower)) {
        if (/(?:leicht|einfach|mittel|schwer)|neu/.test(lower)) { /* Neustart unten weiter */ }
        else return start(`Dein Sudoku (${g.level}) läuft noch:\n\n${sudokuRender(g.current)}\n\n- Ziffer setzen: **„Z3S5=7“** oder „Zeile 3 Spalte 5: 7“ · löschen: „Z3S5=0“\n- **„Tipp“** für die nächste logische Stelle · **„Sudoku Lösung“** löst auf`);
      }
      if ((sm = lower.match(/^zeile\s*(\d)\s*[,;:\s]\s*spalte\s*(\d)\s*(?:=|:|ist|\s)?\s*(\d)$/)) || (sm = lower.match(/^z\s?(\d)\s*[,;:\s]?\s*s\s?(\d)\s*(?:=|:)?\s*(\d)$/)) || (sm = lower.match(/^(\d)\s*[,;:\s]\s*(\d)\s*[,;:\s]\s*(\d)$/))) {
        const row = Number(sm[1]);
        const col = Number(sm[2]);
        const value = Number(sm[3]);
        if (row < 1 || row > 9 || col < 1 || col > 9 || value > 9) return null;
        const i = (row - 1) * 9 + col - 1;
        if (g.puzzle[i]) return start(`Zeile ${row}, Spalte ${col} ist eine **Vorgabe** (${g.puzzle[i]}) – die bleibt fest.`);
        if (value === 0) {
          g.current[i] = 0;
          return start(`Zeile ${row}, Spalte ${col} geleert.\n\n${sudokuRender(g.current)}`);
        }
        const conflict = ((): string | null => {
          for (let c = 0; c < 9; c++) if (c !== col - 1 && g.current[(row - 1) * 9 + c] === value) return `Zeile ${row}`;
          for (let r = 0; r < 9; r++) if (r !== row - 1 && g.current[r * 9 + col - 1] === value) return `Spalte ${col}`;
          const br = Math.floor((row - 1) / 3) * 3 + 1;
          const bc = Math.floor((col - 1) / 3) * 3 + 1;
          for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) {
            if (r === row && c === col) continue;
            if (g.current[(r - 1) * 9 + c - 1] === value) return `Block ${Math.floor((row - 1) / 3) * 3 + Math.floor((col - 1) / 3) + 1}`;
          }
          return null;
        })();
        if (conflict) {
          g.errors += 1;
          return start(`❌ Die **${value}** passt nicht in Zeile ${row}, Spalte ${col} – sie steht schon in ${conflict}.\n\n${sudokuRender(g.current)}`);
        }
        g.current[i] = value;
        if (!g.current.includes(0)) {
          if (g.current.every((v, k) => v === g.solution[k])) {
            game = null;
            return start(`🎉 **Fertig – alles korrekt!** Sudoku ${g.level} gelöst mit ${g.errors} Fehlversuchen und ${g.hints} Tipps.\n\n${sudokuRender(g.current)}\n\nNoch eins? „Sudoku schwer“.`);
          }
          const wrong = g.current.filter((v, k) => v !== g.solution[k]).length;
          return start(`🔍 Das Brett ist voll, aber **${wrong} Zelle${wrong === 1 ? ' ist' : 'n sind'}** noch falsch. Mit „Z<r>S<c>=0“ leeren oder „Tipp“ nehmen.\n\n${sudokuRender(g.current)}`);
        }
        return start(`✅ **${value}** eingetragen in Zeile ${row}, Spalte ${col}.\n\n${sudokuRender(g.current)}`);
      }
    }
    if (/^sudoku\b/i.test(lower)) {
      // Eigenes Rätsel: „Sudoku: 81 Ziffern“ (0/. für leer)
      const blob = lower.replace(/^sudoku\b/i, ' ').replace(/[^0-9.\-\*_]/g, '');
      if (/^\d{81}$/.test(blob.replace(/[.\-*_]/g, '0')) || /^[0.\-*_]{81}$/.test(blob)) {
        const custom = sudokuParse(blob);
        if (custom) {
          const solved = sudokuSolve(custom, 2);
          if (!solved.count) return start('Dieses Sudoku ist **nicht lösbar** – irgendwo widersprechen sich Zahlen. Prüfe Zeilen, Spalten und Blöcke.');
          if (solved.count > 1) return start('Dieses Sudoku ist **nicht eindeutig** lösbar – bitte gib ein Rätsel mit genau einer Lösung an (oder nutze „Sudoku leicht“ für ein generiertes).');
          game = { kind: 'sudoku', puzzle: custom, solution: solved.solutions[0], current: custom.slice(), errors: 0, hints: 0, level: 'eigenes' };
          const givens = custom.filter(Boolean).length;
          return start(`🔢 **Sudoku (eigenes Rätsel)** – ${givens} Vorgaben, eindeutig lösbar.\n\n${sudokuRender(custom)}\n\n- Ziffer setzen: **„Z3S5=7“**, „Zeile 3 Spalte 5: 7“ oder kurz „3 5 7“ · löschen: „Z3S5=0“\n- **„Tipp“** zeigt die nächste logische Stelle (mit Begründung)\n- **„Sudoku Lösung“** löst auf, „Spiel beenden“ beendet`);
        }
      }
      const level = /schwer/.test(lower) ? 'schwer' : /mittel/.test(lower) ? 'mittel' : /leicht|einfach/.test(lower) ? 'leicht' : 'mittel';
      const { puzzle, solution } = sudokuGenerate(level);
      game = { kind: 'sudoku', puzzle, solution, current: puzzle.slice(), errors: 0, hints: 0, level };
      const givens = puzzle.filter(Boolean).length;
      return start(`🔢 **Sudoku ${level}** – ${givens} Vorgaben, eindeutig lösbar.\n\n${sudokuRender(puzzle)}\n\n- Ziffer setzen: **„Z3S5=7“**, „Zeile 3 Spalte 5: 7“ oder kurz „3 5 7“ · löschen: „Z3S5=0“\n- **„Tipp“** zeigt die nächste logische Stelle (mit Begründung)\n- **„Sudoku Lösung“** löst auf, „Spiel beenden“ beendet`);
    }
    return null;
  },
};
