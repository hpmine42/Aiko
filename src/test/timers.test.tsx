import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { nextChainTimer, useTimers } from '../hooks/useTimers';
import type { TimerState } from '../types';

function TimerProbe({ onFire, onReady }: { onFire: (id: string) => void; onReady?: (api: ReturnType<typeof useTimers>) => void }) {
  const api = useTimers({
    currentChatId: () => undefined,
    onFire: (timer) => onFire(timer.id),
  });
  onReady?.(api);
  const { timers } = api;
  return <output data-testid="timers">{timers.map((timer) => `${timer.id}:${timer.label}`).join('|')}</output>;
}

describe('chained timers (Pomodoro)', () => {
  it('derives the next step of a chain', () => {
    const timer: TimerState = { id: 'a', end: 0, dur: 60, label: 'Fokus', paused: false, kind: 'pomodoro', chain: [{ dur: 30, label: 'Pause' }, { dur: 60, label: 'Fokus 2' }] };
    const next = nextChainTimer(timer, 1_000);
    expect(next).toMatchObject({ dur: 30, label: 'Pause', kind: 'pomodoro', end: 31_000, chain: [{ dur: 60, label: 'Fokus 2' }] });
    expect(nextChainTimer(next!, 0)).toMatchObject({ dur: 60, label: 'Fokus 2', chain: undefined });
    expect(nextChainTimer({ ...timer, chain: undefined }, 0)).toBeNull();
  });

  it('starts the next phase automatically when a chained timer fires and stops by kind', async () => {
    window.localStorage.clear();
    const onFire = vi.fn();
    let api: ReturnType<typeof useTimers> | null = null;
    const { unmount } = render(<TimerProbe onFire={onFire} onReady={(value) => { api = value; }} />);
    act(() => { api!.adapter.start(1, { label: 'Fokus 1/1', kind: 'pomodoro', chain: [{ dur: 60, label: 'Lange Pause' }] }); });
    act(() => { api!.adapter.start(60); });
    expect(screen.getByTestId('timers')).toHaveTextContent('Fokus 1/1');
    await waitFor(() => expect(onFire).toHaveBeenCalledTimes(1), { timeout: 3_000 });
    await waitFor(() => expect(screen.getByTestId('timers')).toHaveTextContent('Lange Pause'));
    expect(JSON.parse(window.localStorage.getItem('nova.timers.v2') || '[]')).toHaveLength(2);
    let stopped = 0;
    act(() => { stopped = api!.adapter.stopAll('pomodoro'); });
    expect(stopped).toBe(1);
    expect(screen.getByTestId('timers')).not.toHaveTextContent('Lange Pause');
    expect(screen.getByTestId('timers')).toHaveTextContent('1 Minute');
    unmount();
  });
});

describe('timer multi-tab synchronization', () => {
  it('loads timer updates from another tab without echoing a storage write', async () => {
    window.localStorage.clear();
    const onFire = vi.fn();
    const { unmount } = render(<TimerProbe onFire={onFire} />);
    const external = [{ id: 'remote-timer', end: Date.now() + 60_000, dur: 60, label: 'Eine Minute', paused: false }];
    const raw = JSON.stringify(external);
    act(() => {
      window.localStorage.setItem('nova.timers.v2', raw);
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'nova.timers.v2', newValue: raw, storageArea: window.localStorage,
      }));
    });

    await waitFor(() => expect(screen.getByTestId('timers')).toHaveTextContent('remote-timer:Eine Minute'));
    expect(window.localStorage.getItem('nova.timers.v2')).toBe(raw);
    act(() => window.dispatchEvent(new StorageEvent('storage', {
      key: 'nova.timers.v1', oldValue: raw, newValue: null, storageArea: window.localStorage,
    })));
    expect(screen.getByTestId('timers')).toHaveTextContent('remote-timer:Eine Minute');
    expect(onFire).not.toHaveBeenCalled();
    unmount();
  });
});
