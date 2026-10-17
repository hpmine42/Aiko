import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';

describe('Favoriten', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('nova.ui.v1', JSON.stringify({ stream: false, think: false, saveHistory: true, suggest: true, theme: 'dark', calm: true }));
  });

  it('markiert eine Antwort mit Stern und verwaltet sie in der Favoriten-Ansicht', async () => {
    render(<App />);

    // Antwort erzeugen
    fireEvent.change(screen.getByPlaceholderText('Frag mich alles'), { target: { value: 'Spruch des Tages' } });
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Als Favorit merken' })).toBeInTheDocument(), { timeout: 2_000 });

    // Stern setzen
    fireEvent.click(screen.getByRole('button', { name: 'Als Favorit merken' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Favorit entfernen' })).toBeInTheDocument());

    // Favoriten über das Chat-Menü öffnen
    fireEvent.click(screen.getByRole('button', { name: 'Chat-Optionen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Favoriten' }));
    const dialog = await screen.findByRole('dialog', { name: 'Favoriten' });
    expect(within(dialog).getByText(/Kein Meister fällt vom Himmel/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Spruch des Tages · 17\.10\.2026/)).toBeInTheDocument();

    // Persistenz: Flag landet im gespeicherten Chat
    const stored = JSON.parse(window.localStorage.getItem('nova.chats.v2') || '[]');
    const saved = stored.flatMap((chat: { messages?: unknown[] }) => chat.messages || []);
    expect(saved.some((message: unknown) => typeof message === 'object' && message !== null && (message as { fav?: boolean }).fav === true)).toBe(true);

    // Favorit entfernen → Leerzustand
    fireEvent.click(within(dialog).getByRole('button', { name: 'Favorit entfernen' }));
    await waitFor(() => expect(within(dialog).getByText(/Noch keine Favoriten/)).toBeInTheDocument());
  });
});
