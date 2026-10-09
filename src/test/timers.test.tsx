import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTimers } from '../hooks/useTimers';

function TimerProbe({ onFire }: { onFire: (id: string) => void }) {
  const { timers } = useTimers({
    currentChatId: () => undefined,
    onFire: (timer) => onFire(timer.id),
  });
  return <output data-testid="timers">{timers.map((timer) => `${timer.id}:${timer.label}`).join('|')}</output>;
}

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
