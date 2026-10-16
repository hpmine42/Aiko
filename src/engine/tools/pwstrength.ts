import type { Tool } from './types';
import { fmtN } from './shared';

/* Password strength estimate (entropy, classes, patterns, crack-time) – computed locally, nothing is stored. */

const COMMON = ['passwort', 'password', 'passwort1', '123456', '12345678', '123456789', 'qwertz', 'qwerty', 'hallo', 'hallo123', 'schatz', 'sommer', 'iloveyou', 'abc123', 'letmein', 'admin', 'welcome', 'monkey', 'dragon', 'master', 'fussball', 'fußball', 'geheim', 'test', 'test123', 'liebe', 'sonnenschein', 'berlin', 'schalke', 'bayern', 'arschloch', 'ficken', 'killer', 'hannah', 'daniel', 'michael', 'thomas', 'andrea', 'marcel', 'julia', 'mercedes', 'ferrari', 'computer', 'internet', 'default', 'changeme', 'password1', 'p@ssw0rd', 'passw0rd', 'secret', 'login', 'user', 'root', 'toor'];
const KEYBOARD = ['qwertz', 'qwerty', 'asdf', 'asdfgh', 'yxcv', 'zxcv', '1q2w3e', 'qaywsx', '1234', '4321', 'abcd', '0987'];

export function analyzePassword(pw: string) {
  const lower = pw.toLowerCase();
  const classes = { lower: /[a-zäöüß]/.test(pw), upper: /[A-ZÄÖÜ]/.test(pw), digit: /\d/.test(pw), symbol: /[^A-Za-z0-9ÄÖÜäöüß]/.test(pw) };
  const pool = (classes.lower ? 26 : 0) + (classes.upper ? 26 : 0) + (classes.digit ? 10 : 0) + (classes.symbol ? 33 : 0) + (/[äöüÄÖÜß]/.test(pw) ? 7 : 0);
  let entropy = pw.length * Math.log2(Math.max(pool, 1));
  const warnings: string[] = [];
  const leet = lower.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/@/g, 'a').replace(/\$/g, 's').replace(/!/g, 'i');
  const stripped = leet.replace(/[^a-zäöüß]/g, '');
  if (COMMON.includes(lower) || COMMON.includes(leet)) { warnings.push('steht auf Listen der häufigsten Passwörter'); entropy = Math.min(entropy, 10); }
  else if (COMMON.some((word) => word.length >= 5 && stripped.includes(word))) { warnings.push('enthält ein sehr häufiges Wort'); entropy -= 15; }
  if (KEYBOARD.some((seq) => lower.includes(seq))) { warnings.push('enthält eine Tastatur- oder Zahlenfolge'); entropy -= 12; }
  if (/(.)\1{2,}/.test(pw)) { warnings.push('wiederholt Zeichen (z. B. „aaa“)'); entropy -= 8; }
  if (/^(.+?)\1+$/.test(pw)) { warnings.push('besteht aus einem wiederholten Muster'); entropy /= 2; }
  if (/(?:19|20)\d{2}/.test(pw)) { warnings.push('enthält eine Jahreszahl'); entropy -= 8; }
  if (/^[A-ZÄÖÜ][a-zäöüß]+\d{1,4}[!?.]?$/.test(pw)) { warnings.push('folgt dem Muster „Wort + Zahl (+ Zeichen)“ – das probieren Angreifer zuerst'); entropy -= 10; }
  if (pw.length < 8) warnings.push('ist kürzer als 8 Zeichen');
  const seq = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i + 3 < lower.length; i++) {
    const idx = seq.indexOf(lower[i]);
    if (idx >= 0 && seq.slice(idx, idx + 4) === lower.slice(i, i + 4)) { warnings.push('enthält eine aufsteigende Folge (abcd, 1234)'); entropy -= 10; break; }
  }
  entropy = Math.max(0, Math.round(entropy));
  const score = entropy < 28 ? 0 : entropy < 36 ? 1 : entropy < 60 ? 2 : entropy < 80 ? 3 : 4;
  return { classes, pool, entropy, warnings, score, length: pw.length };
}

const LABELS = ['sehr schwach', 'schwach', 'mittel', 'stark', 'sehr stark'];
const BARS = ['▰▱▱▱▱', '▰▰▱▱▱', '▰▰▰▱▱', '▰▰▰▰▱', '▰▰▰▰▰'];

export function crackTime(entropy: number, guessesPerSecond: number): string {
  const seconds = 2 ** entropy / 2 / guessesPerSecond;
  if (seconds < 1) return 'sofort';
  if (seconds < 60) return `${fmtN(Math.round(seconds))} Sekunden`;
  if (seconds < 3600) return `${fmtN(Math.round(seconds / 60))} Minuten`;
  if (seconds < 86400) return `${fmtN(Math.round(seconds / 3600))} Stunden`;
  if (seconds < 86400 * 365) return `${fmtN(Math.round(seconds / 86400))} Tage`;
  const years = seconds / (86400 * 365.25);
  if (years < 1e6) return `${fmtN(Math.round(years))} Jahre`;
  if (years < 1e9) return `${fmtN(Math.round(years / 1e6))} Mio. Jahre`;
  if (years < 1e12) return `${fmtN(Math.round(years / 1e9))} Mrd. Jahre`;
  return 'länger als das Universum existiert';
}

export const passwordStrengthTool: Tool = {
  id: 'pwstrength',
  label: 'Passwortstärke',
  help: '- **Passwort prüfen:** „Passwortstärke: Sommer2024!“, „Wie sicher ist das Passwort korrekt-pferd-batterie-heft?“ (alles bleibt lokal)',
  run(input) {
    const m = input.trim().match(/^(?:passwort(?:stärke|staerke|-?check|-?test|-?prüfung|-?pruefung|\s+prüfen|\s+pruefen|\s+testen|\s+bewerten)|wie\s+(?:sicher|stark|gut)\s+ist\s+(?:das\s+|mein\s+|dieses\s+)?passwort|ist\s+(?:das\s+|mein\s+)?passwort\s+(?:sicher|stark|gut)|prüfe\s+(?:das\s+|mein\s+)?passwort|password\s+strength)\s*[:\s]\s*(\S.*?)\s*\??$/i);
    if (!m) return null;
    const pw = m[1].replace(/^[„"'`]|[“"'`]$/g, '');
    if (!pw) return null;
    const r = analyzePassword(pw);
    const masked = pw.length <= 2 ? '••' : `${pw[0]}${'•'.repeat(Math.min(pw.length - 2, 18))}${pw[pw.length - 1]}`;
    const classList = [r.classes.lower && 'Kleinbuchstaben', r.classes.upper && 'Großbuchstaben', r.classes.digit && 'Ziffern', r.classes.symbol && 'Sonderzeichen'].filter(Boolean).join(', ') || 'nur eine Zeichenart';
    const tips: string[] = [];
    if (r.length < 12) tips.push('Länge schlägt Komplexität: ab 12 Zeichen, besser 16+.');
    if (r.warnings.length) tips.push('Vermeide Wörter, Namen, Jahreszahlen und Tastaturmuster – Angreifer testen Milliarden solcher Varianten pro Sekunde.');
    tips.push('Passphrasen aus 4–5 zufälligen Wörtern (z. B. „korrekt pferd batterie heft“) sind lang, stark und merkbar.');
    tips.push('Für jedes Konto ein eigenes Passwort – am besten mit einem Passwort-Manager; wo möglich Zwei-Faktor-Anmeldung aktivieren.');
    return {
      text: `**${masked}: ${LABELS[r.score]}** ${BARS[r.score]}\n\n- Länge ${r.length} Zeichen · ${classList} · Zeichenvorrat ≈ ${r.pool}\n- Geschätzte Entropie: ≈ ${r.entropy} Bit${r.warnings.length ? ` (abgewertet, weil es ${r.warnings.join('; ')})` : ''}\n- Knackzeit offline (10 Mrd. Versuche/s): **${crackTime(r.entropy, 1e10)}** · online gedrosselt (100/s): ${crackTime(r.entropy, 100)}\n\n${tips.map((tip) => `- ${tip}`).join('\n')}\n\n_Nur eine Schätzung, ohne Abgleich mit geleakten Datenbanken. Die Eingabe bleibt auf deinem Gerät – trotzdem: echte Passwörter lieber nicht im Chatverlauf stehen lassen (Nachricht löschen)._`,
      source: 'pwstrength',
      val: r.entropy,
    };
  },
};
