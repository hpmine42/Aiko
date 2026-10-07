import type { AikoConfig } from '../types';

export const DEFAULT_CONFIG: AikoConfig = {
  "assistantName": "Aiko",
  "userName": "Jakob",
  "greetings": [
    "Hallo, {name}. Bist du bereit?",
    "Was steht heute an, {name}?",
    "Wie kann ich helfen, {name}?",
    "Womit fangen wir an, {name}?",
    "Schön, dich zu sehen, {name}."
  ],
  "models": [
    {
      "id": "nova4",
      "label": "4",
      "desc": "Ideal für alltägliche Aufgaben"
    },
    {
      "id": "nova4mini",
      "label": "4 mini",
      "desc": "Schneller bei einfachen Fragen"
    },
    {
      "id": "nova4think",
      "label": "4 Think",
      "desc": "Denkt vor dem Antworten länger nach"
    }
  ],
  "defaultModel": "nova4",
  "suggestions": [
    {
      "t": "Erzähl mir",
      "s": "einen Witz",
      "q": "Erzähl mir einen Witz"
    },
    {
      "t": "Rezept",
      "s": "für schnelle Pasta",
      "q": "Gib mir ein schnelles Pasta-Rezept"
    },
    {
      "t": "Vergleiche",
      "s": "Tee und Kaffee",
      "q": "Vergleich Tee und Kaffee"
    },
    {
      "t": "Code schreiben",
      "s": "in JavaScript",
      "q": "Schreib mir eine JavaScript-Funktion"
    },
    {
      "t": "Hilf mir",
      "s": "beim Planen",
      "q": "Hilf mir beim Planen"
    }
  ],
  "followFallback": "Gute Frage! Dazu habe ich gerade keine weiteren Details hinterlegt. Magst du die Frage etwas konkreter stellen? ||| Da muss ich passen – mehr kann ich dazu im Moment nicht sagen. Frag gerne etwas anderes!",
  "knowledge": "## Öffnungszeiten\nGeöffnet ist Montag bis Freitag 9–18 Uhr, Samstag 10–14 Uhr. Sonntags geschlossen.\n\n## Über Aiko\nAiko ist ein Chat-Assistent, der komplett offline in einer einzigen HTML-Datei läuft. Antworten werden über Regeln festgelegt; Rechnen, Einheiten, Datum und Text-Werkzeuge funktionieren wirklich.",
  "dictionary": "",
  "memory": [],
  "countdowns": [],
  "checklists": [],
  "avatar": "",
  "stats": {
    "rules": {},
    "tools": {}
  },
  "fallback": [
    "Hmm, dazu habe ich gerade keine verlässliche Information. Magst du es anders formulieren oder mir etwas mehr Kontext geben?",
    "Da bin ich mir nicht sicher, was du genau meinst. Kannst du die Frage etwas konkreter stellen?",
    "Dazu kann ich dir leider keine gute Antwort geben. Erzähl mir ein bisschen mehr, dann versuche ich es nochmal."
  ],
  "pairs": [
    {
      "id": "p1",
      "enabled": true,
      "suggest": [
        "Wie geht es dir?",
        "Erzähl mir einen Witz",
        "Was kannst du?"
      ],
      "patterns": [
        "hallo",
        "hi",
        "hey",
        "guten tag",
        "moin",
        "servus",
        "guten morgen"
      ],
      "response": "Hallo {name}! 👋 Wie geht’s? Was möchtest du heute machen? ||| Hey {name}! Was kann ich heute für dich tun? ||| Hi {name}! Schön, dass du da bist. Worum geht’s?"
    },
    {
      "id": "p2",
      "enabled": true,
      "patterns": [
        "wie geht es dir",
        "wie gehts",
        "wie geht's",
        "alles gut bei dir"
      ],
      "response": "Mir geht's gut, danke der Nachfrage! 😊 Und dir? ||| Alles bestens hier – ich bin bereit. Was beschäftigt dich gerade?"
    },
    {
      "id": "p3",
      "enabled": true,
      "suggest": [
        "Wie geht es dir?",
        "Erzähl mir einen Witz"
      ],
      "patterns": [
        "wie heißt du",
        "wer bist du",
        "dein name",
        "was bist du"
      ],
      "response": "Ich bin **Aiko**, ein KI-Assistent. Ich kann Fragen beantworten, Texte schreiben, Dinge erklären und beim Programmieren helfen.\n\nWomit fangen wir an?"
    },
    {
      "id": "p4",
      "enabled": true,
      "followups": {
        "mehr": "Noch mehr zu **Berlin**:\n\n- Fläche: ca. 891 km²\n- Bekannte Wahrzeichen: Brandenburger Tor, Reichstag, Fernsehturm\n- Bis 1990 war die Stadt geteilt – die Mauer fiel am 9. November 1989.",
        "kuerzer": "Kurz: **Berlin**.",
        "warum": "Berlin wurde nach der Wiedervereinigung 1990 Hauptstadt; 1991 beschloss der Bundestag den Umzug von Bonn nach Berlin."
      },
      "patterns": [
        "hauptstadt von deutschland",
        "hauptstadt deutschland"
      ],
      "response": "Die Hauptstadt von Deutschland ist **Berlin**.\n\nEin paar Fakten:\n\n- **Einwohner:** rund 3,7 Millionen – die größte Stadt Deutschlands\n- **Regierungssitz:** seit 1999 (Umzug des Bundestags aus Bonn)\n- **Bundesland:** Berlin ist zugleich ein eigenes Bundesland\n\nMöchtest du mehr über die Geschichte oder Sehenswürdigkeiten wissen?"
    },
    {
      "id": "p5",
      "enabled": true,
      "patterns": [
        "wetter",
        "regnet es",
        "wie warm"
      ],
      "response": "Ich habe gerade keinen Zugriff auf Live-Wetterdaten. Für eine genaue Vorhersage schau am besten in deine Wetter-App – dort bekommst du die aktuellen Werte für deinen Standort.\n\nSoll ich dir stattdessen Tipps geben, was du bei dem Wetter unternehmen kannst?"
    },
    {
      "id": "p6",
      "enabled": true,
      "suggest": [
        "Noch einen",
        "Warum ist der lustig?"
      ],
      "followups": {
        "nochmal": "Okay, noch einer: Warum können Geister so schlecht lügen? Weil man durch sie hindurchsieht. 👻 ||| Noch einer: Was macht ein Pirat am Computer? Er drückt die Enter-Taste. 🏴‍☠️",
        "warum": "Warum der lustig ist? Weil das Wortspiel überraschend kommt – genau das macht einen guten Witz aus. 😄"
      },
      "patterns": [
        "witz",
        "mach einen witz",
        "kennst du einen witz",
        "bring mich zum lachen"
      ],
      "response": "Klar, hier einer:\n\nTreffen sich zwei Magneten. Sagt der eine: *„Was soll ich heute bloß anziehen?“* 🧲\n\nNoch einen? ||| Warum können Geister so schlecht lügen?\n\nWeil man direkt **durch sie hindurchsieht**. 👻 ||| Was ist orange und läuft durch den Wald?\n\nEine **Wanderine**. 🍊🥾\n\nSoll ich noch einen erzählen?"
    },
    {
      "id": "p7",
      "enabled": true,
      "patterns": [
        "rezept",
        "pasta",
        "wie koche ich",
        "was soll ich kochen"
      ],
      "response": "Gerne! Hier ist ein schnelles Rezept für **Pasta Aglio e Olio** – fertig in etwa 15 Minuten.\n\n### Zutaten (2 Portionen)\n- 250 g Spaghetti\n- 4 Knoblauchzehen, in feinen Scheiben\n- 5 EL Olivenöl\n- 1 TL Chiliflocken\n- Frische Petersilie, Salz, Pfeffer\n\n### Zubereitung\n1. Spaghetti in reichlich Salzwasser al dente kochen. Eine Tasse Nudelwasser aufheben.\n2. Öl in einer Pfanne erhitzen und den Knoblauch bei mittlerer Hitze goldgelb braten.\n3. Chiliflocken kurz mitrösten.\n4. Nudeln mit etwas Nudelwasser in die Pfanne geben und gut schwenken.\n5. Mit Petersilie, Salz und Pfeffer abschmecken.\n\n**Tipp:** Ein Spritzer Zitrone und etwas Parmesan machen das Ganze noch besser. 🍝"
    },
    {
      "id": "p8",
      "enabled": true,
      "patterns": [
        "javascript",
        "code",
        "programmieren",
        "funktion"
      ],
      "response": "Klar! Hier ist eine kleine JavaScript-Funktion, die jeden Wortanfang großschreibt:\n\n```javascript\nfunction titleCase(text) {\n  return text\n    .split(' ')\n    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())\n    .join(' ');\n}\n\nconsole.log(titleCase('hallo schöne welt'));\n// Ausgabe: \"Hallo Schöne Welt\"\n```\n\n**So funktioniert's:**\n1. `split(' ')` zerlegt den Text in einzelne Wörter.\n2. `map()` macht den ersten Buchstaben jedes Wortes groß.\n3. `join(' ')` setzt alles wieder zusammen.\n\nSag mir, was dein Code genau tun soll – dann passe ich ihn an."
    },
    {
      "id": "p9",
      "enabled": true,
      "followups": {
        "kuerzer": "Kurz gesagt: **Kaffee** wirkt schneller und stärker, **Tee** sanfter und länger.",
        "beispiel": "Beispiel: Für einen schnellen Wachmacher vor einer Prüfung eignet sich ein Espresso; für konzentriertes Arbeiten über mehrere Stunden eher grüner Tee."
      },
      "patterns": [
        "vergleich",
        "vergleiche",
        "tee oder kaffee",
        "unterschied tee kaffee"
      ],
      "response": "Hier ist ein kurzer Vergleich zwischen **Tee** und **Kaffee**:\n\n| Merkmal | Tee | Kaffee |\n|---|---|---|\n| Koffein pro Tasse | ca. 20–50 mg | ca. 80–120 mg |\n| Wirkung | sanft, länger anhaltend | schnell, kräftig |\n| Geschmack | sehr vielfältig | herb bis fruchtig |\n| Säure | gering | höher |\n\n**Fazit:** Wenn du einen schnellen Wachmacher brauchst, ist Kaffee die bessere Wahl. Für gleichmäßige Energie über den Tag ist Tee oft angenehmer. ☕🍵"
    },
    {
      "id": "p10",
      "enabled": true,
      "patterns": [
        "danke",
        "dankeschön",
        "vielen dank",
        "danke dir"
      ],
      "response": "Sehr gerne! Sag Bescheid, wenn du noch etwas brauchst. 🙂 ||| Gern geschehen! ||| Immer gerne – viel Erfolg!"
    },
    {
      "id": "p11",
      "enabled": true,
      "patterns": [
        "tschüss",
        "tschuess",
        "auf wiedersehen",
        "ciao",
        "bye",
        "bis später"
      ],
      "response": "Bis bald! 👋 ||| Tschüss und einen schönen Tag noch! ☀️"
    },
    {
      "id": "p12",
      "enabled": true,
      "patterns": [
        "bist du ein mensch",
        "bist du echt",
        "bist du eine ki",
        "bist du ein bot"
      ],
      "response": "Nein, ich bin kein Mensch – ich bin ein KI-Assistent. Ich kann dir aber trotzdem bei vielen Dingen helfen. 🙂"
    },
    {
      "id": "p13",
      "enabled": true,
      "patterns": [
        "planen",
        "plan",
        "termine",
        "organisieren"
      ],
      "response": "Gerne helfe ich dir beim Planen! Damit ich dir einen guten Plan erstellen kann, beantworte mir kurz:\n\n1. **Worum geht es?** (z. B. Lernen, Umzug, Projekt, Reise)\n2. **Bis wann** muss es fertig sein?\n3. **Wie viel Zeit** hast du pro Tag oder Woche?\n\nStichpunkte reichen völlig – ich mache daraus eine übersichtliche Checkliste."
    },
    {
      "id": "p14",
      "enabled": true,
      "priority": -1,
      "patterns": [
        "übersetze",
        "übersetzung",
        "translate",
        "auf englisch"
      ],
      "response": "Klar, ich übersetze gerne! Schick mir den Text und sag mir, in welche Sprache er übersetzt werden soll."
    },
    {
      "id": "p15",
      "enabled": true,
      "patterns": [
        "zusammenfassen",
        "fasse zusammen",
        "zusammenfassung"
      ],
      "response": "Gerne! Füge einfach den Text ein. Ich fasse ihn dann in den wichtigsten **3–5 Kernpunkten** zusammen."
    }
  ]
};
