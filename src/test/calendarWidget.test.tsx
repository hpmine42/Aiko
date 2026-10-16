import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';

describe('calendar widget', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('nova.ui.v1', JSON.stringify({ stream: false, think: false, saveHistory: true, suggest: true, theme: 'dark', calm: true }));
  });

  it('places the 1st of March 2026 on Sunday and shows the working days', async () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Frag mich alles'), { target: { value: 'Kalender März 2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
    await waitFor(() => expect(screen.getByRole('group', { name: 'Kalender März 2026' })).toBeInTheDocument(), { timeout: 2_000 });

    const grid = screen.getByRole('group', { name: 'Kalender März 2026' }).querySelector('.wcal-g')!;
    const cells = Array.from(grid.children);
    // 8 header cells (KW + Mo–So), then week 9: KW label, six empty cells, then "1" in the Sunday column.
    expect(cells[8].textContent).toBe('9');
    expect(cells[15].textContent).toBe('1');
    expect(cells[15].getAttribute('aria-label')).toBe('1. März');
    expect(screen.getByText('22 Arbeitstage')).toBeInTheDocument();
  });
});
