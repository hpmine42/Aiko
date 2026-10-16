import type { Tool, ToolResult } from './types';
import { clean, fmtN, pick, randomInt } from './shared';

/* Small chat games with in-memory state: number guessing, rock-paper-scissors, mental arithmetic, hangman, quiz. */

type Game =
  | { kind: 'guess'; target: number; max: number; tries: number }
  | { kind: 'math'; question: string; answer: number; score: number; total: number }
  | { kind: 'hangman'; word: string; hint: string; guessed: Set<string>; wrong: number }
  | { kind: 'quiz'; index: number; score: number; asked: number[] };

let game: Game | null = null;
const rpsScore = { me: 0, you: 0, draw: 0 };

export function resetGames(): void { game = null; rpsScore.me = 0; rpsScore.you = 0; rpsScore.draw = 0; }
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

const start = (text: string): ToolResult => ({ text, source: 'games' });

export const gameTool: Tool = {
  id: 'games',
  label: 'Spiele',
  help: '- **Spiele:** „Zahlenraten“, „Schere Stein Papier: Stein“, „Kopfrechnen“, „Galgenmännchen“, „Quiz“ – mit „Spiel beenden“ aufhören',
  run(input) {
    const s = clean(input);
    const lower = s.toLowerCase();

    if (/^(?:spiel\s+(?:beenden|abbrechen|stoppen|aufgeben)|aufgeben|ich\s+gebe\s+auf|beende\s+das\s+spiel|stopp\s+spiel|lösung\s+bitte)$/i.test(lower)) {
      if (!game) return rpsScore.me + rpsScore.you + rpsScore.draw ? start(`Kein Spiel aktiv. Schere-Stein-Papier-Stand: du ${rpsScore.you} – ich ${rpsScore.me} (${rpsScore.draw} unentschieden).`) : start('Gerade läuft kein Spiel. Starte eins mit „Zahlenraten“, „Kopfrechnen“, „Galgenmännchen“ oder „Quiz“.');
      const g = game;
      game = null;
      if (g.kind === 'guess') return start(`Aufgegeben – die Zahl war **${g.target}**. Neue Runde mit „Zahlenraten“.`);
      if (g.kind === 'math') return start(`Kopfrechnen beendet: **${g.score} von ${g.total} richtig**${g.total ? ` (${fmtN(g.score / g.total * 100, 0)} %)` : ''}.`);
      if (g.kind === 'hangman') return start(`Das Wort war **${g.word}**. Neue Runde mit „Galgenmännchen“.`);
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
    return null;
  },
};
