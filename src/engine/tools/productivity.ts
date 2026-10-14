import type { StopwatchState, TimerStep } from '../../types';
import type { Tool, ToolContext, ToolResult } from './types';
import { clean, fmtN } from './shared';

/* ---------------- Stoppuhr (state lives in config, the widget renders it live) ---------------- */

export function stopwatchElapsed(state: StopwatchState | null | undefined, now = Date.now()): number {
  if (!state) return 0;
  return state.elapsed + (state.running ? Math.max(0, now - state.start) : 0);
}

export function formatStopwatch(ms: number, tenths = true): string {
  const total = Math.floor(ms / 100);
  const t = total % 10;
  const seconds = Math.floor(total / 10);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const base = `${h ? `${h}:${String(m).padStart(2, '0')}` : String(m)}:${String(s).padStart(2, '0')}`;
  return tenths ? `${base},${t}` : base;
}

const WIDGET = { type: 'stopwatch' as const };

function stopwatch(s: string, context: ToolContext): ToolResult | null {
  const now = context.now().getTime();
  const state = context.config.stopwatch ?? null;
  const elapsed = stopwatchElapsed(state, now);
  const set = (next: StopwatchState | null) => () => { context.config.stopwatch = next; context.save(); };
  const summary = (): string => {
    const laps = state?.laps ?? [];
    if (!laps.length) return '';
    return `\n\nRunden:\n${laps.map((lap, i) => `${i + 1}. ${formatStopwatch(lap)}${i ? ` (+${formatStopwatch(lap - laps[i - 1])})` : ''}`).join('\n')}`;
  };

  if (/^(?:stoppuhr|stopuhr|stopwatch)(?:\s+(?:starten|start|los|an|beginnen|einschalten))?$|^(?:starte|start|beginne)\s+(?:die\s+|eine\s+|mit\s+der\s+)?(?:stoppuhr|stopuhr|zeitmessung|zeit\s+zu\s+messen)$|^zeit\s+messen$|^(?:stoppe|miss)\s+(?:die\s+)?zeit$/i.test(s)) {
    if (state?.running) return { text: `⏱️ Die Stoppuhr läuft bereits – aktuell **${formatStopwatch(elapsed)}**.${summary()}\n\n„Runde“ nimmt eine Zwischenzeit, „Stoppuhr stoppen“ hält an.`, source: 'stopwatch', widget: WIDGET };
    if (state && state.elapsed > 0) {
      return { text: `⏱️ **Stoppuhr läuft weiter** ab ${formatStopwatch(elapsed)}.${summary()}\n\n„Stoppuhr zurücksetzen“ startet bei null.`, source: 'stopwatch', widget: WIDGET, effect: set({ ...state, running: true, start: now }) };
    }
    return { text: '⏱️ **Stoppuhr gestartet.**\n\n„Runde“ oder „Zwischenzeit“ speichert eine Rundenzeit, „Stoppuhr stoppen“ hält an, „Stoppuhr zurücksetzen“ beginnt neu. Die Zeit läuft auch weiter, wenn du den Chat wechselst.', source: 'stopwatch', widget: WIDGET, effect: set({ start: now, elapsed: 0, running: true, laps: [] }) };
  }
  if (/^(?:stoppuhr|stopuhr|stopwatch)\s+(?:stoppen|stopp|stop|anhalten|pausieren|pause|halt)$|^(?:stoppe|halte|pausiere)\s+(?:die\s+)?(?:stoppuhr|stopuhr|zeitmessung)(?:\s+an)?$|^(?:stoppuhr|stopuhr)\s+aus$/i.test(s)) {
    if (!state) return { text: 'Es läuft keine Stoppuhr. „Stoppuhr starten“ beginnt die Zeitmessung.', source: 'stopwatch' };
    if (!state.running) return { text: `⏱️ Die Stoppuhr steht schon bei **${formatStopwatch(elapsed)}**.${summary()}\n\n„Stoppuhr weiter“ setzt fort, „Stoppuhr zurücksetzen“ löscht.`, source: 'stopwatch', widget: WIDGET };
    return { text: `⏱️ **Gestoppt bei ${formatStopwatch(elapsed)}.**${summary()}\n\n„Stoppuhr weiter“ setzt fort, „Stoppuhr zurücksetzen“ beginnt neu.`, source: 'stopwatch', widget: WIDGET, val: Math.round(elapsed / 100) / 10, effect: set({ ...state, running: false, elapsed, start: now }) };
  }
  if (/^(?:stoppuhr|stopuhr|stopwatch)\s+(?:weiter|fortsetzen|fortfahren|weiterlaufen|wieder\s+starten|resume)$|^(?:setze|lass)\s+(?:die\s+)?stoppuhr\s+(?:fort|weiterlaufen)$/i.test(s)) {
    if (!state) return { text: 'Es gibt keine angehaltene Stoppuhr. „Stoppuhr starten“ beginnt neu.', source: 'stopwatch' };
    if (state.running) return { text: `⏱️ Die Stoppuhr läuft bereits – **${formatStopwatch(elapsed)}**.`, source: 'stopwatch', widget: WIDGET };
    return { text: `⏱️ **Weiter ab ${formatStopwatch(elapsed)}.**`, source: 'stopwatch', widget: WIDGET, effect: set({ ...state, running: true, start: now }) };
  }
  if (/^(?:stoppuhr|stopuhr|stopwatch)\s+(?:zurücksetzen|zuruecksetzen|reset|löschen|loeschen|neu|nullen|auf\s+null)$|^(?:setze|stelle)\s+(?:die\s+)?stoppuhr\s+(?:zurück|zurueck|auf\s+null)$|^(?:lösche|loesche)\s+(?:die\s+)?stoppuhr$/i.test(s)) {
    if (!state) return { text: 'Die Stoppuhr steht ohnehin auf null.', source: 'stopwatch' };
    return { text: `⏱️ **Stoppuhr zurückgesetzt** (stand bei ${formatStopwatch(elapsed)}).`, source: 'stopwatch', effect: set(null) };
  }
  if (/^(?:(?:stoppuhr|stopuhr)\s+)?(?:runde|zwischenzeit|rundenzeit|lap|split)(?:\s+(?:nehmen|speichern|stoppen|merken))?$|^(?:nimm|speichere|merke)\s+(?:eine\s+|die\s+)?(?:runde|zwischenzeit|rundenzeit)$/i.test(s)) {
    // A bare „Runde“ without any stopwatch is probably not meant for us.
    if (!state || (!state.running && !state.elapsed)) return /stop+uhr/i.test(s) ? { text: 'Dafür muss die Stoppuhr laufen – „Stoppuhr starten“.', source: 'stopwatch' } : null;
    const laps = [...state.laps, elapsed];
    const previous = state.laps.length ? state.laps[state.laps.length - 1] : 0;
    return {
      text: `⏱️ **Runde ${laps.length}: ${formatStopwatch(elapsed - previous)}** (gesamt ${formatStopwatch(elapsed)})${state.running ? '' : ' – Stoppuhr ist angehalten'}.`,
      source: 'stopwatch', widget: WIDGET, val: Math.round((elapsed - previous) / 100) / 10, effect: set({ ...state, laps }),
    };
  }
  if (/^(?:stoppuhr|stopuhr|stopwatch)\s*(?:anzeigen|status|zeit|stand|zeigen|\?)?$|^(?:wie\s+lange\s+läuft\s+die\s+stoppuhr|wie\s+lange\s+laeuft\s+die\s+stoppuhr|wie\s+spät\s+ist\s+die\s+stoppuhr|zeig(?:e)?\s+(?:mir\s+)?die\s+stoppuhr|stoppuhr\s+stand)$/i.test(s)) {
    if (!state) return { text: 'Es läuft keine Stoppuhr. „Stoppuhr starten“ beginnt die Zeitmessung – komplett lokal.', source: 'stopwatch' };
    return { text: `⏱️ Stoppuhr: **${formatStopwatch(elapsed)}**${state.running ? ' (läuft)' : ' (angehalten)'}.${summary()}`, source: 'stopwatch', widget: WIDGET, val: Math.round(elapsed / 100) / 10 };
  }
  return null;
}

/* ---------------- Pomodoro (chained timers through the timer adapter) ---------------- */

export const POMODORO_KIND = 'pomodoro';

export function pomodoroPlan(focusMin: number, breakMin: number, rounds: number, longBreakMin: number): TimerStep[] {
  const steps: TimerStep[] = [];
  for (let i = 1; i <= rounds; i += 1) {
    steps.push({ dur: focusMin * 60, label: `🍅 Pomodoro – Fokus ${i}/${rounds}` });
    if (i < rounds) steps.push({ dur: breakMin * 60, label: `☕ Pomodoro – Pause ${i}/${rounds - 1}` });
    else steps.push({ dur: longBreakMin * 60, label: '🌿 Pomodoro – lange Pause' });
  }
  return steps;
}

function pomodoro(s: string, context: ToolContext): ToolResult | null {
  if (!/pomodoro/i.test(s)) return null;
  const running = context.timers.getTimers().filter((timer) => timer.kind === POMODORO_KIND);
  if (/^(?:pomodoro\s+(?:stoppen|stopp|stop|abbrechen|beenden|aus|löschen|loeschen)|(?:stoppe|beende|breche?)\s+(?:den\s+|das\s+|die\s+)?pomodoro(?:[-\s]?(?:timer|zyklus|session))?(?:\s+ab)?)$/i.test(s)) {
    if (!running.length) return { text: 'Es läuft gerade kein Pomodoro.', source: 'pomodoro' };
    const count = context.timers.stopAll(POMODORO_KIND);
    return { text: `🍅 Pomodoro beendet${count > 1 ? ` (${count} Phasen gestoppt)` : ''}. Gute Arbeit!`, source: 'pomodoro' };
  }
  if (/^(?:pomodoro\s+(?:status|stand|\?|anzeigen|wie\s+lange|rest)|wie\s+lange\s+(?:läuft|laeuft|noch|dauert)\s+(?:der|das|mein)\s+pomodoro(?:\s+noch)?|(?:welche|was\s+für\s+eine)\s+pomodoro[-\s]?phase)$/i.test(s)) {
    if (!running.length) return { text: 'Es läuft gerade kein Pomodoro. „Pomodoro starten“ beginnt mit 25 Minuten Fokus.', source: 'pomodoro' };
    const timer = running[0];
    const left = Math.max(0, Math.round((timer.paused ? Number(timer.left) || 0 : timer.end - context.now().getTime()) / 1000));
    const remaining = timer.chain?.length ?? 0;
    return { text: `${timer.label}: noch **${fmtN(Math.ceil(left / 60))} ${Math.ceil(left / 60) === 1 ? 'Minute' : 'Minuten'}**${timer.paused ? ' (pausiert)' : ''}. Danach folgen noch ${remaining} ${remaining === 1 ? 'Phase' : 'Phasen'}.`, source: 'pomodoro' };
  }
  const m = s.match(/^(?:(?:starte|start|beginne)\s+(?:einen?\s+|eine\s+|die\s+|das\s+|mit\s+)?)?pomodoro(?:[-\s]?(?:timer|technik|session|zyklus))?(?:\s+(?:starten|start|los|beginnen))?(?:\s+(?:mit\s+)?(\d{1,3})\s*(?:\/|min(?:uten)?\s*(?:\/|und|,)?)\s*(\d{1,3})\s*(?:min(?:uten)?)?)?(?:\s+(?:mit\s+)?(\d{1,3})\s*(?:min(?:uten)?(?:\s+fokus)?))?(?:\s*(?:,|mit|und|·)?\s*(\d{1,2})\s*(?:runden|zyklen|durchgänge|durchgaenge|wiederholungen|einheiten|x))?$/i);
  if (!m) return null;
  if (running.length) {
    return { text: `🍅 Es läuft schon ein Pomodoro: **${running[0].label}**. „Pomodoro stoppen“ beendet ihn, dann kannst du neu starten.`, source: 'pomodoro' };
  }
  const focus = Math.min(180, Math.max(1, Number(m[1] || m[3]) || 25));
  const pause = Math.min(60, Math.max(1, Number(m[2]) || Math.max(1, Math.round(focus / 5))));
  const rounds = Math.min(12, Math.max(1, Number(m[4]) || 4));
  const longBreak = Math.min(60, Math.max(pause, pause * 3));
  const plan = pomodoroPlan(focus, pause, rounds, longBreak);
  const total = plan.reduce((sum, step) => sum + step.dur, 0);
  const [first, ...rest] = plan;
  return {
    text: `🍅 **Pomodoro gestartet – Fokus 1/${rounds} (${focus} Minuten).**\n\n` +
      `Der Ablauf läuft automatisch weiter: ${rounds} × ${focus} Minuten Fokus, dazwischen ${pause} Minuten Pause, am Ende ${longBreak} Minuten lange Pause – insgesamt ${fmtN(Math.round(total / 60))} Minuten. ` +
      'Jede Phase meldet sich hier im Chat und oben rechts im Timer-Dock (dort auch anhalten). „Pomodoro status“ zeigt die Restzeit, „Pomodoro stoppen“ beendet alles.\n\n' +
      '_Tipp: Während der Fokusphase nur eine Aufgabe – Notizen für später einfach mit „Merke dir: …“ festhalten._',
    source: 'pomodoro',
    val: focus,
    effect: () => context.timers.start(first.dur, { label: first.label, kind: POMODORO_KIND, chain: rest }),
  };
}

export const productivityTool: Tool = {
  id: 'stopwatch',
  label: 'Stoppuhr & Pomodoro',
  help: '- **Stoppuhr & Pomodoro:** „Stoppuhr starten“, „Runde“, „Stoppuhr stoppen“ · „Pomodoro starten“, „Pomodoro 50/10“, „Pomodoro status“',
  run(input, context) {
    const s = clean(input);
    return stopwatch(s, context) || pomodoro(s, context);
  },
};
