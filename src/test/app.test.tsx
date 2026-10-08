import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('React app', () => {
  it('renders the mobile chat shell without non-original plan promotion', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Seitenleiste öffnen' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Frag mich alles')).toBeInTheDocument();
    expect(screen.queryByText('Pläne ansehen')).not.toBeInTheDocument();
    expect(document.title).toBe('Aiko');
  });

  it('opens settings and exposes the verbatim code-import documentation', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Seitenleiste öffnen' }));
    fireEvent.click(screen.getByRole('button', { name: /Einstellungen/ }));
    expect(screen.getByRole('heading', { name: 'Einstellungen' })).toBeInTheDocument();
    const infoButton = screen.getByRole('button', { name: /Code-Format – für eine KI kopieren/ });
    fireEvent.click(infoButton);
    expect(screen.getByText(/Du erzeugst Chatbot-Regeln/)).toBeInTheDocument();
  });

  it('derives the fallback avatar letter from the configured AI name', () => {
    window.localStorage.setItem('nova.config.v1', JSON.stringify({ assistantName: 'Mika', userName: 'Jakob' }));
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Seitenleiste öffnen' }));
    expect(container.querySelector('.pav')).toHaveTextContent('M');
    expect(document.title).toBe('Mika');
  });

  it('sends a message and renders a local result', async () => {
    window.localStorage.setItem('nova.ui.v1', JSON.stringify({ stream: false, think: false, saveHistory: true, suggest: true, theme: 'dark', calm: true }));
    render(<App />);
    const input = screen.getByPlaceholderText('Frag mich alles');
    fireEvent.change(input, { target: { value: '2 + 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
    expect(screen.getAllByText('2 + 2').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument(), { timeout: 2_000 });
    expect(window.localStorage.getItem('nova.chats.v1')).toContain('2 + 2');
  });

  it('imports rule code sent in the chat and uses the new rule immediately', async () => {
    window.localStorage.setItem('nova.ui.v1', JSON.stringify({ stream: false, think: false, saveHistory: true, suggest: true, theme: 'dark', calm: true }));
    render(<App />);
    const input = screen.getByPlaceholderText('Frag mich alles');
    fireEvent.change(input, { target: { value: 'regel: =hallo\n\nantwort: Hallo {name}! Wie kann ich helfen?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));

    await waitFor(() => expect(screen.getByText(/1 Regel hinzugefügt/)).toBeInTheDocument(), { timeout: 2_000 });
    const savedConfig = JSON.parse(window.localStorage.getItem('nova.config.v1') || '{}') as { pairs?: Array<{ patterns?: string[] }> };
    expect(savedConfig.pairs?.some((rule) => rule.patterns?.includes('=hallo'))).toBe(true);

    fireEvent.change(input, { target: { value: 'hallo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
    await waitFor(() => expect(screen.getByText(/Hallo.*Wie kann ich helfen/)).toBeInTheDocument(), { timeout: 2_000 });
  });
});
