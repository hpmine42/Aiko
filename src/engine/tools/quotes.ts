import type { Tool, ToolContext } from './types';
import { DAY_MS, clean, fmtShortDay, pick, todayUTC } from './shared';

/* Sprüche, Witze und Zitate – kuratierte Offline-Sammlung.
   „… des Tages“ rotiert deterministisch pro Kalendertag (gleichbleibend am selben Tag),
   die kurze Form ohne Zusatz würfelt. Der Befehl „Witz“ (ohne Zusatz) bleibt der
   eingebauten Regel „witz“ vorbehalten, die eigene Antwortvarianten und Nachfragen hat. */

export const SPRUECHE: readonly string[] = [
  'Der Weg entsteht, indem man ihn geht.',
  'Große Dinge haben klein angefangen.',
  'Besser unperfekt begonnen als perfekt verschoben.',
  'Ein Lächeln kostet nichts und zahlt doch Zinsen.',
  'Ordnung ist die halbe Miete – Mut die andere Hälfte.',
  'Langsamkeit ist manchmal die schnellste Art, weiterzukommen.',
  'Wer fragt, hat schon die Hälfte der Antwort.',
  'Kein Meister fällt vom Himmel – er klettert.',
  'Das Gras wächst nicht schneller, wenn man daran zieht.',
  'Weniger ist oft mehr – außer bei Sonnenschein.',
  'Auch ein Umweg ist ein Weg.',
  'Zuhören ist die halbe Weisheit.',
  'Kleine Schritte in eine Richtung zählen mehr als große in keine.',
  'Geduld heißt, die Zeit zu nutzen, statt sie zu bekämpfen.',
  'Der Kopf ist rund, damit die Denkrichtung wechseln kann.',
  'Was du heute suchst, findet dich morgen auf halbem Weg.',
  'Vergleiche rauben Freude – Ausnahmen machen Freude.',
  'Mut wächst nicht vor dem ersten Schritt, sondern danach.',
  'Jeder Tag zählt – manche doppelt.',
  'Der beste Zeitpunkt war gestern, der zweitbeste ist jetzt.',
  'Fehler sind Beweise für Versuche.',
  'Ein offenes Fenster holt mehr Licht als eine geschlossene Tür.',
  'Man muss nicht alles wissen – nur wissen, wo es steht.',
  'Schwierigkeiten sind Chancen in Arbeitskleidung.',
  'Steter Tropfen höhlt den Stein.',
  'Übung macht den Meister.',
  'Eile mit Weile.',
  'Wer wagt, gewinnt.',
  'Reden ist Silber, Schweigen ist Gold.',
  'Der Ton macht die Musik.',
  'Wie man in den Wald hineinruft, so schallt es heraus.',
  'Aufgeschoben ist nicht aufgehoben.',
  'Gut Ding will Weile haben.',
  'Wer zuletzt lacht, lacht am besten.',
  'Man soll den Tag nicht vor dem Abend loben.',
  'Ein geteiltes Problem ist halbiert, eine geteilte Freude verdoppelt.',
  'Ein Danke öffnet mehr Türen als ein Schlüssel.',
  'Du musst nicht groß sein, um Großes zu tun.',
  'Das Glück bevorzugt die, die anfangen.',
  'Lob kostet nichts und wirkt am längsten.',
  'Ein neugieriger Kopf altert langsamer.',
  'Pausen gehören zum Weg wie Atem zum Laufen.',
  'Das meiste Wachstum passiert unsichtbar – wie bei Wurzeln.',
  'Klarheit entsteht oft erst beim Aufschreiben.',
  'Wer sich Zeit nimmt, hat am Ende mehr davon.',
  'Ein kleiner Fortschritt ist kein Ziel – aber kein Stillstand.',
  'Gut vorbereitet ist halb gewonnen.',
  'Viele Wege führen nach Rom – einer reicht dir.',
];

export const WITZE: readonly string[] = [
  'Was ist ein Keks unter einem Baum? Ein schattiges Plätzchen.',
  'Was ist weiß und stört beim Essen? Eine Lawine.',
  'Was ist grün und klopft an die Tür? Ein Klopfsalat.',
  'Treffen sich zwei Fische. Sagt der eine: „Hi!“ Sagt der andere: „Wo?“',
  'Warum summen Bienen? Weil sie den Text nicht kennen.',
  'Was ist rot und schlecht für die Zähne? Ein Ziegelstein.',
  'Wie nennt man einen Bumerang, der nicht zurückkommt? Stock.',
  'Kommt ein Pferd in eine Bar. Fragt der Barkeeper: „Warum so ein langes Gesicht?“',
  'Treffen sich zwei Kerzen. Fragt die eine: „Gehen wir heute Abend aus?“',
  'Was ist weiß und springt im Wald herum? Ein Jumpignon.',
  'Warum wird der Pilz auf jede Party eingeladen? Weil er ein Champignon ist.',
  'Was ist gelb und kann nicht schwimmen? Ein Bagger – er hat nur einen Arm.',
  'Warum haben Bienen so klebrige Haare? Weil sie einen Honigkamm benutzen.',
  'Was macht eine Wolke, wenn sie juckt? Sie fliegt zum Wolkenkratzer.',
  'Warum können Piraten keinen Kreis berechnen? Weil sie Pi nur raten können.',
  'Was macht ein Clown im Büro? Faxen.',
  'Was sitzt auf dem Baum und winkt? Ein Huhu.',
  'Was ist braun und rennt durch die Wüste? Eine Dattel-maus.',
  'Treffen sich zwei Jäger. Beide tot.',
  'Kommt ein Mann zum Bäcker: „Ich hätte gern 99 Brötchen.“ – „Warum nicht gleich 100?“ – „Wer soll denn die alle essen?“',
  'Treffen sich zwei Eier in der Pfanne. Sagt das eine: „Ach, du auch hier?“',
  'Was hat vier Beine und kann fliegen? Zwei Vögel.',
  'Was wird nass, wenn es trocknet? Ein Handtuch.',
  'Was geht bergauf und bergab und bleibt trotzdem an Ort und Stelle? Eine Treppe.',
  'Warum trinken Mäuse keinen Alkohol? Weil sie Angst vor dem Kater haben.',
  'Wie nennt man ein weißes Mammut? Helmut.',
  'Was ist schwarz-weiß und hüpft von Eisscholle zu Eisscholle? Ein Springuin.',
  'Was macht ein Kommissar auf dem Eis? Er zieht Schlüsse.',
  'Warum können Fische nicht Basketball spielen? Sie haben Angst vorm Netz.',
  'Was ist rosa und schaut durchs Schlüsselloch? Ein Spanferkel.',
  'Warum haben Giraffen so lange Hälse? Weil der Kopf so weit oben sitzt.',
  'Es gibt 10 Arten von Menschen: die, die Binärcode verstehen – und die, die ihn nicht verstehen.',
  'Was ist braun und sitzt hinter Gittern? Eine Knastanie.',
  'Wie nennt man einen Fisch ohne Auge? Fsch.',
  'Was macht eine Spinne am Computer? Sie sitzt im World Wide Web.',
  'Warum mögen Informatiker den Sommer nicht? Zu viele Bugs.',
];

export const ZITATE: ReadonlyArray<readonly [string, string]> = [
  ['Man sieht nur mit dem Herzen gut. Das Wesentliche ist für die Augen unsichtbar.', 'Antoine de Saint-Exupéry'],
  ['Ich denke, also bin ich.', 'René Descartes'],
  ['Es gibt nichts Gutes, außer man tut es.', 'Erich Kästner'],
  ['Ein Tag ohne Lachen ist ein verlorener Tag.', 'Charlie Chaplin'],
  ['Phantasie ist wichtiger als Wissen, denn Wissen ist begrenzt.', 'Albert Einstein'],
  ['Wer kämpft, kann verlieren. Wer nicht kämpft, hat schon verloren.', 'Bertolt Brecht'],
  ['Es ist nicht genug zu wissen, man muss auch anwenden.', 'Johann Wolfgang von Goethe'],
  ['Nichts ist so beständig wie der Wandel.', 'Heraklit'],
  ['Wer ein Warum zu leben hat, erträgt fast jedes Wie.', 'Friedrich Nietzsche'],
  ['Ohne Musik wäre das Leben ein Irrtum.', 'Friedrich Nietzsche'],
  ['Die beste Zeit, einen Baum zu pflanzen, war vor zwanzig Jahren. Die zweitbeste Zeit ist jetzt.', 'chinesisches Sprichwort'],
  ['Wissen ist Macht.', 'Francis Bacon'],
  ['Wer andere kennt, ist klug. Wer sich selbst kennt, ist weise.', 'Laozi'],
  ['Das Sein bestimmt das Bewusstsein.', 'Karl Marx'],
  ['Jeder Mensch ist ein Künstler.', 'Joseph Beuys'],
  ['Zwei Dinge sind unendlich: das Universum und die menschliche Dummheit. Beim Universum bin ich mir allerdings nicht ganz sicher.', 'Albert Einstein'],
  ['Die Grenzen meiner Sprache bedeuten die Grenzen meiner Welt.', 'Ludwig Wittgenstein'],
  ['Natürlicher Verstand kann fast jeden Grad von Bildung ersetzen; keine Bildung aber den natürlichen Verstand.', 'Arthur Schopenhauer'],
  ['Der Klügere gibt nach. Eine traurige Wahrheit: Sie begründet die Weltherrschaft der Dummen.', 'Marie von Ebner-Eschenbach'],
  ['Nichts im Leben ist zu fürchten, es ist nur zu verstehen.', 'Marie Curie'],
  ['In der Mitte der Schwierigkeit liegt die Möglichkeit.', 'Albert Einstein'],
  ['Das Leben ist das, was passiert, während du eifrig dabei bist, andere Pläne zu machen.', 'John Lennon'],
  ['Ein Buch ist ein Garten, den man in der Tasche tragen kann.', 'arabisches Sprichwort'],
  ['Wenn du ein Schiff bauen willst, dann rufe nicht die Menschen zusammen, um Holz zu sammeln, sondern lehre sie die Sehnsucht nach dem weiten Meer.', 'Antoine de Saint-Exupéry'],
];

type Category = 'spruch' | 'witz' | 'zitat';

const PATTERN = /^(?:gib\s+mir\s+(?:einen|ein)\s+)?(?:einen\s+)?(spruch|sprüche|weisheit(?:en)?|zitat|zitate|aphorismus(?:e)?|flachwitz(?:e)?|witz|witze)(?:\s+des\s+tages)?\s*[?!.]*$/i;

const CATEGORY_LABEL: Record<Category, string> = { spruch: 'Spruch', witz: 'Witz', zitat: 'Zitat' };

export const quotesTool: Tool = {
  id: 'quotes',
  label: 'Sprüche, Witze & Zitate',
  help: '- **Sprüche & Zitate:** „Spruch des Tages“, „Zitat“, „Flachwitz“, „Witz des Tages“ – rotiert zuverlässig jeden Tag',
  run(input, context: ToolContext) {
    const s = clean(input);
    const m = s.match(PATTERN);
    if (!m) return null;
    const word = m[1].toLowerCase();
    const daily = /des\s+tages/i.test(s);
    // „Witz“ ohne Zusatz gehört zur eingebauten Regel mit eigenen Varianten und Nachfragen.
    if (!daily && (word === 'witz' || word === 'witze')) return null;

    const category: Category = /witz/.test(word) ? 'witz' : /zitat|aphorismus/.test(word) ? 'zitat' : 'spruch';
    const today = todayUTC(context.now());
    const dayIndex = Math.floor(today / DAY_MS);

    if (category === 'zitat') {
      const [text, author] = daily ? ZITATE[dayIndex % ZITATE.length] : pick(ZITATE);
      const head = daily ? `**Zitat des Tages** (${fmtShortDay(today)})\n\n` : '';
      return { text: `${head}„${text}“\n\n— ${author}`, source: 'quotes' };
    }
    if (category === 'witz') {
      const text = daily ? WITZE[dayIndex % WITZE.length] : pick(WITZE);
      const head = daily ? `**Witz des Tages** (${fmtShortDay(today)})\n\n` : '';
      return { text: `${head}${text}`, source: 'quotes' };
    }
    const text = daily ? SPRUECHE[dayIndex % SPRUECHE.length] : pick(SPRUECHE);
    const head = daily ? `**Spruch des Tages** (${fmtShortDay(today)})\n\n` : '';
    return { text: `${head}„${text}“`, source: 'quotes' };
  },
};
