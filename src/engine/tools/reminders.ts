import type { Tool } from './types';
import { DAY_MS, WEEKDAYS, clean, fmtDay, parseDate, todayUTC } from './shared';
import { fmtClock, parseClock } from './timecalc';

/* Date-based reminders („Erinnere mich am 24.12. um 10 Uhr an Geschenke“) – implemented as long-running timers of kind `reminder`. */

export const REMINDER_KIND = 'reminder';

const DATE_WORDS = '(?:heute|morgen|übermorgen|uebermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|(?:nächsten|naechsten|kommenden|diesen)\\s+\\w+|nächste\\s+woche|naechste\\s+woche|in\\s+\\d{1,3}\\s+(?:tagen?|wochen?|monaten?)|\\d{1,2}\\.\\s*\\d{1,2}\\.?(?:\\s*\\d{2,4})?|\\d{1,2}\\.?\\s*[a-zä]+\\.?(?:\\s*\\d{4})?|\\d{4}-\\d{2}-\\d{2})';
const TIME_WORDS = '(\\d{1,2}(?:[:.]\\d{2})?)\\s*(?:uhr)?';

function whenLabel(target: Date, now: Date): string {
  const days = Math.round((Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) - todayUTC(now)) / DAY_MS);
  const clock = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;
  const day = days === 0 ? 'heute' : days === 1 ? 'morgen' : days === 2 ? 'übermorgen' : `${WEEKDAYS[target.getDay()]}, ${target.getDate()}.${target.getMonth() + 1}.${target.getFullYear()}`;
  return `${day} um ${clock} Uhr${days > 2 ? ` (in ${days} Tagen)` : ''}`;
}

export const reminderTool: Tool = {
  id: 'reminders',
  label: 'Erinnerungen',
  help: '- **Erinnerungen:** „Erinnere mich am 24.12. um 10 Uhr an Geschenke“, „Erinnere mich morgen um 9 an den Zahnarzt“, „Erinnere mich in 3 Tagen an die Miete“, „Geplante Erinnerungen“, „Erinnerung löschen: Zahnarzt“',
  run(input, context) {
    const s = clean(input).replace(/\s+/g, ' ');
    const now = context.now();
    const reminders = () => context.timers.getTimers().filter((timer) => timer.kind === REMINDER_KIND);
    let m: RegExpMatchArray | null;

    if (/^(?:(?:geplante|anstehende|offene|aktive|laufende)\s+erinnerungen|welche\s+erinnerungen\s+(?:laufen|sind\s+geplant|stehen\s+an|gibt\s+es)|erinnerungen\s+anzeigen|erinnerungsliste|termine\s+anzeigen)$/i.test(s)) {
      const list = reminders().sort((a, b) => a.end - b.end);
      if (!list.length) return { text: 'Keine Erinnerungen geplant. Lege eine an mit „Erinnere mich am 24.12. um 10 Uhr an Geschenke“ oder „Erinnere mich morgen um 9 an den Zahnarzt“.', source: 'reminders' };
      return { text: `**${list.length} ${list.length === 1 ? 'Erinnerung' : 'Erinnerungen'}:**\n\n${list.map((timer) => `- ${whenLabel(new Date(timer.end), now)} – ${timer.label.replace(/^Erinnerung:\s*/, '')}`).join('\n')}\n\n_Erinnerungen melden sich im Chat, solange Aiko geöffnet ist (auch nach einem Neuladen). Löschen: „Erinnerung löschen: Zahnarzt“._`, source: 'reminders', val: list.length };
    }
    if ((m = s.match(/^(?:alle\s+erinnerungen\s+löschen|alle\s+erinnerungen\s+loeschen|erinnerungen\s+löschen|erinnerungen\s+loeschen|lösche\s+alle\s+erinnerungen|loesche\s+alle\s+erinnerungen)$/i))) {
      const count = reminders().length;
      if (!count) return { text: 'Es gibt keine Erinnerungen zu löschen.', source: 'reminders' };
      return { text: `Okay – ${count} ${count === 1 ? 'Erinnerung' : 'Erinnerungen'} gelöscht.`, source: 'reminders', effect: () => { context.timers.stopAll(REMINDER_KIND); } };
    }
    if ((m = s.match(/^(?:erinnerung\s+(?:löschen|loeschen|entfernen|abbrechen)|lösche\s+(?:die\s+)?erinnerung|loesche\s+(?:die\s+)?erinnerung|vergiss\s+die\s+erinnerung)\s*(?:an|:|für|fuer)?\s*(.+)$/i))) {
      const needle = m[1].toLowerCase().replace(/^(?:den|die|das)\s+/, '');
      const hits = reminders().filter((timer) => timer.label.toLowerCase().includes(needle));
      if (!hits.length) return { text: `Keine Erinnerung zu „${m[1]}“ gefunden – „Erinnerungen“ zeigt alle.`, source: 'reminders' };
      return { text: `Gelöscht: ${hits.map((timer) => `„${timer.label.replace(/^Erinnerung:\s*/, '')}“`).join(', ')}.`, source: 'reminders', effect: () => { hits.forEach((timer) => (context.timers.stop ? context.timers.stop(timer.id) : undefined)); } };
    }

    // „Erinnere mich am 24.12. um 10 Uhr an Geschenke“ / „Erinnere mich morgen um 9 an den Zahnarzt“ / „Erinnere mich in 3 Tagen an die Miete“
    const prefix = s.match(/^(?:erinnere\s+mich|erinner\s+mich|erinnerung|neue\s+erinnerung|reminder)\s*:?\s*(?:bitte\s+)?(.+)$/i);
    if (!prefix) return null;
    let rest = ` ${prefix[1].trim()} `;
    let seconds: number | null = null;
    let target: Date | null = null;
    let text = '';
    if ((m = rest.match(/^\s*(?:in|nach)\s+(\d{1,4})\s*(sekunden?|sek|s|minuten?|min|m|stunden?|std|h|tagen?|tag|wochen?|woche)\b\s*(?:an|daran,?\s+dass|dass|zu|zum|zur|:|,)?\s*(.*?)\s*$/i))) {
      const n = Number(m[1]);
      const unit = m[2].toLowerCase();
      const factor = /^(sek|s)/.test(unit) ? 1 : /^(min|m)/.test(unit) ? 60 : /^(std|stunde|h)/.test(unit) ? 3600 : /^tag/.test(unit) ? 86400 : 604800;
      text = m[3].trim();
      if (!text) return null;                                   // bare „in 20 Minuten“ → legacy timer
      seconds = n * factor;
      target = new Date(now.getTime() + seconds * 1000);
    } else {
      let clockMin: number | null = null;
      const timeMatch = rest.match(/\s(?:um\s+)?(\d{1,2}(?:[:.]\d{2})?)\s*uhr(?=[\s,])/i) || rest.match(/\sum\s+(\d{1,2}(?:[:.]\d{2})?)(?=[\s,])/i);
      if (timeMatch) { clockMin = parseClock(timeMatch[1]); if (clockMin != null) rest = rest.replace(timeMatch[0], ' '); }
      let dayTs: number | null = null;
      let explicitDate = false;
      const dateRe = new RegExp(`\\s(?:am\\s+)?(${DATE_WORDS})(?=[\\s,])`, 'gi');
      let dateMatch: RegExpExecArray | null;
      while ((dateMatch = dateRe.exec(rest))) {
        const candidate = parseDate(dateMatch[1], now);
        if (candidate != null) { dayTs = candidate; explicitDate = true; rest = rest.replace(dateMatch[0], ' '); break; }
      }
      if (clockMin == null) {
        const bare = rest.match(/\s(\d{1,2}:\d{2})(?=[\s,])/);
        if (bare) { clockMin = parseClock(bare[1]); if (clockMin != null) rest = rest.replace(bare[0], ' '); }
      }
      if (dayTs == null && clockMin == null) return null;
      text = rest.replace(/\s+/g, ' ').trim().replace(/^(?:,|:|-|–)\s*/, '').replace(/^(?:an|daran,?\s+dass|dass|zu|zum|zur)\s+/i, '').replace(/^(?:den|die|das|meinen|meine|mein)\s+/i, '').replace(/[,:]\s*$/, '').trim();
      if (!text) return { text: 'Woran soll ich dich erinnern? Z. B. „Erinnere mich morgen um 9 an den Zahnarzt“.', source: 'reminders' };
      if (dayTs == null) dayTs = todayUTC(now);
      const d = new Date(dayTs);
      const minutes = clockMin ?? 9 * 60;
      target = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Math.floor(minutes / 60), minutes % 60, 0, 0);
      if (!explicitDate && clockMin != null && target.getTime() <= now.getTime()) target = new Date(target.getTime() + DAY_MS);   // „um 7 Uhr“ already past → tomorrow
      seconds = Math.round((target.getTime() - now.getTime()) / 1000);
      if (seconds <= 0) return { text: `${fmtDay(dayTs)} um ${fmtClock(minutes)} Uhr liegt schon in der Vergangenheit – nenne mir einen Zeitpunkt in der Zukunft.`, source: 'reminders' };
    }
    if (seconds > 400 * 86400) return { text: 'Erinnerungen plane ich bis zu 400 Tage im Voraus.', source: 'reminders' };
    if (seconds < 5) return null;
    const label = `Erinnerung: ${text.charAt(0).toUpperCase()}${text.slice(1)}`.slice(0, 80);
    const startSeconds = seconds;
    return {
      text: `🔔 Alles klar – ich erinnere dich **${whenLabel(target, now)}** an: **${text}**.\n\n_Die Erinnerung ist gespeichert und meldet sich hier im Chat, solange Aiko geöffnet ist. „Geplante Erinnerungen“ zeigt alle, „Erinnerung löschen: ${text.split(' ').slice(0, 3).join(' ')}“ entfernt sie._`,
      source: 'reminders',
      effect: () => context.timers.start(startSeconds, { label, kind: REMINDER_KIND }),
    };
  },
};
