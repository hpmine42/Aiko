import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';

describe('stopwatch widget', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('nova.ui.v1', JSON.stringify({ stream: false, think: false, saveHistory: true, suggest: true, theme: 'dark', calm: true }));
  });

  it('starts a stopwatch from the chat and controls it through the widget', async () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Frag mich alles'), { target: { value: 'Stoppuhr starten' } });
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
    await waitFor(() => expect(screen.getByText(/Stoppuhr gestartet/)).toBeInTheDocument(), { timeout: 2_000 });
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByText('läuft')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Runde' }));
    await waitFor(() => expect(screen.getByText('Runde 1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Stopp' }));
    await waitFor(() => expect(screen.getByText('angehalten')).toBeInTheDocument());
    const stored = JSON.parse(window.localStorage.getItem('nova.config.v2') || '{}');
    expect(stored.stopwatch).toMatchObject({ running: false });
    expect(stored.stopwatch.laps).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    await waitFor(() => expect(screen.getByText(/Zurückgesetzt – „Stoppuhr starten“ beginnt neu/)).toBeInTheDocument());
  });
});
