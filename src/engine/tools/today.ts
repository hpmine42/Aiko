import type { Tool, ToolContext } from './types';
import { DAY_MS, daysBetween, fmtDay, fmtN, fmtShortDay, todayUTC } from './shared';
import { isoWeek } from './calendar';
import { moonState } from './moon';
import { publicHolidays, STATES } from './holidays';
import { fmtDuration } from './timecalc';

/* „Heute“ – die Tagesübersicht auf einen Blick: Datum, Kalenderwoche, Mondphase,
   nächster Feiertag (Bundesland aus den Einstellungen), Countdowns und laufende Timer.
   Läuft komplett offline über die lokale Konfiguration. */

const QUERY = /^(?:heute|heute[-\s]?übersicht|tagesübersicht|übersicht(?:\s+heute)?|was\s+ist\s+heute|mein\s+tag(?:\s+heute)?)\s*[?!.]*$/i;

function nextHoliday(context: ToolContext, today: number): { label: string; ts: number; where: string } | null {
  const state = context.config.region && STATES[context.config.region] ? context.config.region : null;
  const year = new Date(today).getUTCFullYear();
  for (const y of [year, year + 1]) {
    const hit = publicHolidays(y, state)
      .filter((entry) => entry.ts >= today && (state ? true : entry.nationwide))
      .sort((a, b) => a.ts - b.ts)[0];
    if (hit) return { label: hit.label, ts: hit.ts, where: state ? STATES[state] : 'bundesweit' };
  }
  return null;
}

export const todayTool: Tool = {
  id: 'today',
  label: 'Heute-Übersicht',
  help: '- **Heute-Übersicht:** „Heute“ oder „Tagesübersicht“ zeigt Datum, KW, Mondphase, den nächsten Feiertag, Countdowns und Timer',
  run(input, context) {
    const s = String(input || '').trim().replace(/\s+/g, ' ');
    if (!QUERY.test(s)) return null;

    const now = context.now();
    const today = todayUTC(now);
    const week = isoWeek(today);
    const moon = moonState(now.getTime());

    const lines = [
      `**☀️ Heute, ${fmtDay(today)}**`,
      '',
      `- 📅 **Kalenderwoche ${week.week}**`,
      `- ${moon.emoji} ${moon.name} (${fmtN(Math.round(moon.illumination * 100))} % beleuchtet)`,
    ];

    const holiday = nextHoliday(context, today);
    if (holiday) {
      const days = daysBetween(today, holiday.ts);
      const when = days <= 0 ? 'heute' : `in ${fmtN(days)} ${days === 1 ? 'Tag' : 'Tagen'}`;
      lines.push(`- 🎉 Nächster Feiertag (${holiday.where}): **${holiday.label}** am ${fmtShortDay(holiday.ts)} – ${when}`);
    }

    const countdowns = (context.config.countdowns || [])
      .filter((entry) => entry.ts >= today)
      .sort((a, b) => a.ts - b.ts)
      .slice(0, 2);
    if (countdowns.length) {
      const parts = countdowns.map((entry) => {
        const days = daysBetween(today, entry.ts);
        return `**${entry.name}** ${days <= 0 ? 'heute' : `in ${fmtN(days)} ${days === 1 ? 'Tag' : 'Tagen'}`}`;
      });
      lines.push(`- ⏳ Countdowns: ${parts.join(' · ')}`);
    }

    const timers = context.timers.getTimers()
      .filter((timer) => timer.end > now.getTime())
      .sort((a, b) => a.end - b.end)
      .slice(0, 3);
    if (timers.length) {
      const parts = timers.map((timer) => `**${timer.label}** – ${timer.paused ? 'pausiert' : `noch ${fmtDuration((timer.end - now.getTime()) / 60_000)}`}`);
      lines.push(`- ⏱️ Timer: ${parts.join(' · ')}`);
    }

    lines.push('', '_Mehr im Detail: „Feiertage 2026“, „Mondphase“, „Meine Countdowns“ – oder „Spruch des Tages“ für einen Gedanken zwischendurch._');
    return { text: lines.join('\n'), source: 'today' };
  },
};
