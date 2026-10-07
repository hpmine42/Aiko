import { useEffect, useMemo, useState } from 'react';
import type { TimerState } from '../types';
import { timerRemaining } from '../hooks/useTimers';
import { Icon } from './Icon';

interface TimerDockProps {
  timers: TimerState[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onStop: (id: string) => void;
  onStopped: () => void;
}

function formatClock(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return `${hours ? `${hours}:${String(minutes).padStart(2, '0')}` : String(minutes)}:${String(remainder).padStart(2, '0')}`;
}

export function TimerDock({ timers, onPause, onResume, onStop, onStopped }: TimerDockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [, forceTick] = useState(0);
  const signature = useMemo(() => timers.map((timer) => `${timer.id}:${timer.paused}`).join('|'), [timers]);

  useEffect(() => {
    if (!timers.length) {
      setCollapsed(false);
      return undefined;
    }
    setCollapsed(false);
    const timeout = window.setTimeout(() => setCollapsed(true), 5_000);
    return () => window.clearTimeout(timeout);
  }, [signature, timers.length]);

  useEffect(() => {
    if (!timers.length || collapsed) return undefined;
    const interval = window.setInterval(() => forceTick((value) => value + 1), 500);
    return () => window.clearInterval(interval);
  }, [collapsed, timers.length]);

  const expand = () => {
    setCollapsed(false);
    window.setTimeout(() => setCollapsed(true), 5_000);
  };

  if (!timers.length) return <div id="timerDock" hidden />;
  if (collapsed) {
    return (
      <div id="timerDock">
        <button type="button" className="tdock-clock" aria-label="Timer anzeigen" onClick={expand}>
          <Icon name="clock" />
        </button>
      </div>
    );
  }

  return (
    <div id="timerDock">
      {timers.map((timer) => {
        const left = timerRemaining(timer);
        const percent = timer.dur > 0
          ? Math.min(100, Math.max(0, (1 - left / (timer.dur * 1_000)) * 100))
          : 0;
        return (
          <div className="tdock" data-id={timer.id} key={timer.id} onClick={expand}>
            <span className="tdock-t">{formatClock(left)}</span>
            <span className="tdock-bar"><i style={{ width: `${percent.toFixed(1)}%` }} /></span>
            <button
              type="button"
              className="tdock-b"
              aria-label={timer.paused ? 'Fortsetzen' : 'Anhalten'}
              onClick={(event) => {
                event.stopPropagation();
                if (timer.paused) onResume(timer.id); else onPause(timer.id);
              }}
            >
              <Icon name={timer.paused ? 'play' : 'pause'} />
            </button>
            <button
              type="button"
              className="tdock-b"
              aria-label="Timer stoppen"
              onClick={(event) => {
                event.stopPropagation();
                onStop(timer.id);
                onStopped();
              }}
            >
              <Icon name="close" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
