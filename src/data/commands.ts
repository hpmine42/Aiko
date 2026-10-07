export type Command = readonly [command: string, description: string];
export type CommandGroup = readonly [title: string, commands: readonly Command[]];

export const CMD_LIST: Command[] = [
  ["/hilfe", "Alle Funktionen & Beispiele"],
  ["/sicheres Passwort", "Passwort generieren"],
  ["/6-stellige PIN", "PIN generieren"],
  ["/qr …", "QR-Code erstellen (offline, scannbar)"],
  ["/Diagramm: Äpfel 5, Birnen 8", "Diagramm zeichnen"],
  ["/Tortendiagramm: 30, 70", "Tortendiagramm"],
  ["/Checkliste Einkauf: Milch, Brot", "Checkliste anlegen"],
  ["/timer 5 Minuten", "Timer mit echtem Countdown"],
  ["/weck mich in 10 Minuten", "Wecker stellen"],
  ["/würfle", "Würfeln (1W6)"],
  ["/würfle 2d20", "Mehrere Würfel"],
  ["/münzwurf", "Kopf oder Zahl"],
  ["/zufallszahl 1 bis 100", "Zufallszahl ziehen"],
  ["/wähle: Pizza oder Pasta", "Zufällig entscheiden"],
  ["/255 in Binär", "Zahlensysteme"],
  ["/primfaktoren von 84", "Primfaktorzerlegung"],
  ["/ist 97 eine Primzahl?", "Primzahltest"],
  ["/#173f7d in RGB", "Farbe umrechnen"],
  ["/119 € brutto", "Netto/Brutto"],
  ["/5 km in Meilen", "Einheiten"],
  ["/89 € in Dollar", "Währung umrechnen"],
  ["/welche KW ist heute", "Kalenderwoche"],
  ["/wie spät ist es in Tokio", "Zeitzone"],
  ["/countdown bis Weihnachten", "Countdown speichern"],
  ["/meine countdowns", "Countdowns anzeigen"],
  ["/was ist günstiger: 200 g für 1,50 € oder 500 g für 3,20 €", "Preisvergleich"],
  ["/wie viele Tage bis Weihnachten?", "Datum & Countdown"],
  ["/merke dir: …", "Etwas merken"],
  ["/zähle Wörter: …", "Text-Werkzeuge"]
];
/* Weitere eingebaute Sprachbefehle – Übersicht für die Einstellungen
   (Funktionieren wie CMD_LIST mit oder ohne führenden /). */
export const CMD_MORE: CommandGroup[] = [
  ["Rechnen & Prozent", [
    ["23 × 17", "Rechnen mit Klammern (Punkt vor Strich)"],
    ["20 % von 150", "Prozentwert"],
    ["42 sind wie viel Prozent von 100?", "Prozentsatz"],
    ["150 mit 20 % Rabatt", "Rabatt oder Aufschlag"],
    ["2x + 3 = 11", "Gleichung mit x (mit Rechenweg)"],
    ["Wurzel aus 81", "Wurzeln, Potenzen & Funktionen"],
    ["17 mod 5", "Rest einer Division"]
  ]],
  ["Einheiten & Währung", [
    ["30 °C in Fahrenheit", "Temperaturen"],
    ["2 GB in MB", "Daten & Größen"],
    ["100 Dollar in Euro", "Währung (auch umgekehrt)"],
    ["50 Euro in Pfund", "Feste Offline-Kurse"]
  ]],
  ["Datum & Uhrzeit", [
    ["KW 42 im Jahr 2027", "Datum einer Kalenderwoche"],
    ["KW vom 24.12.2026", "Kalenderwoche eines Datums"],
    ["welcher Wochentag ist der 1.1.2030?", "Wochentag"],
    ["in 3 Wochen", "Datumsrechnung"],
    ["14 Uhr MEZ in Tokio", "Uhrzeit umrechnen"],
    ["zeitunterschied zwischen Berlin und Tokio", "Zeitverschiebung"]
  ]],
  ["Timer & Countdowns", [
    ["wie viel zeit ist noch?", "Timer-Restzeit"],
    ["timer abbrechen", "Timer stoppen"],
    ["countdown bis 24.12.2027: Weihnachten 2027", "Countdown mit Datum & Name"],
    ["countdown löschen: …", "Countdown entfernen"]
  ]],
  ["Passwort, PIN & QR-Code", [
    ["passwort mit 24 zeichen", "Länge wählen"],
    ["passwort ohne sonderzeichen", "Zeichensatz festlegen"],
    ["passwort nur mit ziffern", "nur Ziffern oder Buchstaben"],
    ["8-stellige pin", "PIN-Länge wählen"],
    ["QR WLAN: Name=…; Passwort=…", "WLAN-QR-Code"]
  ]],
  ["Diagramme & Listen", [
    ["Liniendiagramm: Jan 5, Feb 8, Mär 2", "Liniendiagramm"],
    ["Zur Liste Einkauf füge Eier hinzu", "Eintrag hinzufügen"],
    ["zeige meine listen", "Alle Listen anzeigen"],
    ["Checkliste Einkauf anzeigen", "Liste öffnen"],
    ["Lösche die Liste Einkauf", "Liste löschen"]
  ]],
  ["Text & Wörterbuch", [
    ["Sortiere: …", "Text sortieren"],
    ["Entferne Duplikate: …", "Duplikate entfernen"],
    ["Formatiere JSON: …", "JSON formatieren"],
    ["Was heißt Hund auf Englisch?", "Deutsch ⇄ Englisch"]
  ]],
  ["Merken & Wissen", [
    ["Was weißt du über mich?", "Erinnerungen anzeigen"],
    ["Vergiss: …", "Erinnerung löschen"],
    ["Was weißt du über …?", "Wissenssammlung durchsuchen"]
  ]],
  ["Nachfragen & Weiterrechnen", [
    ["kürzer / einfacher", "Antwort umformulieren"],
    ["warum? / ein Beispiel? / mehr dazu", "Nachfragen zur Antwort"],
    ["und mal 2 / davon 20 %", "Mit dem Ergebnis weiterrechnen"],
    ["Nochmal!", "Neue Antwort oder neues Passwort"]
  ]]
];
