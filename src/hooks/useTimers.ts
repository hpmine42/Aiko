import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TimerAdapter, TimerState } from '../types';
import { LS } from '../utils/config';
import { readLocalJson, writeLocalJson } from './useLocalStorage';

export function durationWords(seconds: number): string {
  const format = (value: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 }).format(value);
  if (seconds % 3_600 === 0 && seconds >= 3_600) return `${format(seconds / 3_600)}${seconds === 3_600 ? ' Stunde' : ' Stunden'}`;
  if (seconds % 60 === 0 && seconds >= 60) return `${format(seconds / 60)}${seconds === 60 ? ' Minute' : ' Minuten'}`;
  return `${format(seconds)}${seconds === 1 ? ' Sekunde' : ' Sekunden'}`;
}

export function timerRemaining(timer: TimerState, now = Date.now()): number {
  return Math.max(0, timer.paused ? Number(timer.left) || 0 : timer.end - now);
}

function loadTimers(): TimerState[] {
  const stored = readLocalJson<unknown>(LS.timers, []);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((entry): entry is TimerState => Boolean(entry && typeof entry === 'object' && Number(entry.end)))
    .map((entry) => ({
      id: String(entry.id || `t${Date.now().toString(36)}`),
      end: Number(entry.end),
      dur: Number(entry.dur) || 1,
      label: String(entry.label || durationWords(Number(entry.dur) || 1)),
      chat: entry.chat ? String(entry.chat) : undefined,
      paused: Boolean(entry.paused),
      left: entry.paused ? Math.max(0, Number(entry.left) || Number(entry.end) - Date.now()) : undefined,
    }));
}

function beep(): void {
  try {
    const AudioContextCtor = window.AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    ([[880, 0], [660, 0.22]] as const).forEach(([frequency, offset]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.35);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.4);
    });
    window.setTimeout(() => { void context.close().catch(() => undefined); }, 1_200);
  } catch {
    // Sound is a progressive enhancement and often requires a user gesture.
  }
}

interface UseTimersOptions {
  currentChatId: () => string | undefined;
  onFire: (timer: TimerState) => void;
}

export function useTimers({ currentChatId, onFire }: UseTimersOptions) {
  const [timers, setTimers] = useState<TimerState[]>(loadTimers);
  const timersRef = useRef(timers);
  const onFireRef = useRef(onFire);
  const currentChatRef = useRef(currentChatId);
  timersRef.current = timers;
  onFireRef.current = onFire;
  currentChatRef.current = currentChatId;

  const replace = useCallback((updater: (current: TimerState[]) => TimerState[]) => {
    setTimers((current) => {
      const next = updater(current);
      timersRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    writeLocalJson(LS.timers, timers.map(({ id, end, dur, label, chat, paused, left }) => ({
      id, end, dur, label, chat, paused, left: paused ? left : undefined,
    })));
  }, [timers]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const now = Date.now();
      const expired = timersRef.current.filter((timer) => !timer.paused && timer.end <= now);
      if (!expired.length) return;
      const ids = new Set(expired.map((timer) => timer.id));
      replace((current) => current.filter((timer) => !ids.has(timer.id)));
      expired.forEach((timer) => {
        onFireRef.current(timer);
        beep();
        try { navigator.vibrate?.([200, 100, 200]); } catch { /* unsupported */ }
      });
    }, 250);
    return () => window.clearInterval(tick);
  }, [replace]);

  const start = useCallback((seconds: number) => {
    const timer: TimerState = {
      id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      end: Date.now() + seconds * 1_000,
      dur: seconds,
      label: durationWords(seconds),
      chat: currentChatRef.current(),
      paused: false,
    };
    replace((current) => [...current, timer]);
  }, [replace]);

  const stop = useCallback((id: string) => {
    replace((current) => current.filter((timer) => timer.id !== id));
  }, [replace]);

  const stopAll = useCallback(() => {
    const count = timersRef.current.length;
    replace(() => []);
    return count;
  }, [replace]);

  const pause = useCallback((id: string) => {
    const now = Date.now();
    replace((current) => current.map((timer) => timer.id === id && !timer.paused
      ? { ...timer, paused: true, left: Math.max(0, timer.end - now) }
      : timer));
  }, [replace]);

  const resume = useCallback((id: string) => {
    replace((current) => current.map((timer) => timer.id === id && timer.paused
      ? { ...timer, paused: false, end: Date.now() + Math.max(1_000, Number(timer.left) || 0), left: undefined }
      : timer));
  }, [replace]);

  const adapter = useMemo<TimerAdapter>(() => ({
    getTimers: () => timersRef.current,
    start,
    stopAll,
  }), [start, stopAll]);

  return { timers, start, stop, stopAll, pause, resume, adapter };
}
