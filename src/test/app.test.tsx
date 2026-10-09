import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('explains that the visible choices are response modes, not AI models', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Antwortmodus wählen' }));
    expect(screen.getByText(/hier werden keine KI-Modelle gewählt/)).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Schnell')).toBeInTheDocument();
    expect(screen.getByText('Denkpause')).toBeInTheDocument();
  });

  it('does not prefill a user name by default', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Seitenleiste öffnen' }));
    expect(screen.getByText('Profil')).toBeInTheDocument();
    expect(screen.queryByText('Jakob')).not.toBeInTheDocument();
  });

  it('opens the sidebar without focusing the search field and opening the mobile keyboard', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Seitenleiste öffnen' }));
    const search = screen.getByPlaceholderText('Chats durchsuchen');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Neuer Chat' })).toHaveFocus());
    expect(search).not.toHaveFocus();
  });

  it('does not reopen the mobile keyboard when the sidebar closes after being opened while the composer was focused', async () => {
    render(<App />);
    const composer = screen.getByPlaceholderText('Frag mich alles');
    composer.focus();
    expect(composer).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Seitenleiste öffnen' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Neuer Chat' })).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.getElementById('side')).toHaveAttribute('aria-hidden', 'true'));
    expect(composer).not.toHaveFocus();
  });

  it('keeps keyboard focus inside an open settings dialog', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Seitenleiste öffnen' }));
    fireEvent.click(screen.getByRole('button', { name: /Einstellungen/ }));
    const dialog = screen.getByRole('dialog', { name: 'Einstellungen' });
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href]'));
    const first = controls[0];
    const last = controls[controls.length - 1];
    await waitFor(() => expect(first).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();
  });

  it('derives the fallback avatar letter from the configured AI name', () => {
    window.localStorage.setItem('nova.config.v1', JSON.stringify({ assistantName: 'Mika', userName: 'Jakob' }));
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Seitenleiste öffnen' }));
    expect(container.querySelector('.pav')).toHaveTextContent('M');
    expect(document.title).toBe('Mika');
  });

  it('marks settings inert while a nested confirmation dialog is open', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Seitenleiste öffnen' }));
    fireEvent.click(screen.getByRole('button', { name: /Einstellungen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Auf Standard zurücksetzen' }));
    await screen.findByRole('alertdialog', { name: 'Auf Standard zurücksetzen?' });
    expect(document.getElementById('setPage')).toHaveAttribute('inert');
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(document.getElementById('setPage')).not.toHaveAttribute('inert'));
  });

  it('asks for permission before browser speech recognition and isolates the alert dialog', async () => {
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: class {} });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Diktieren' }));
    const alert = await screen.findByRole('alertdialog', { name: 'Diktieren aktivieren?' });
    expect(document.getElementById('app')).toHaveAttribute('inert');
    expect(alert).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(document.getElementById('app')).not.toHaveAttribute('inert');
  });

  it('shows a local image thumbnail with an accessible remove button', async () => {
    const createObjectURL = vi.fn(() => 'blob:local-preview');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Anhängen' }));
    const image = new File(['image bytes'], 'regenbogen.jpg', { type: 'image/jpeg' });
    const fileInputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInputs[2], { target: { files: [image] } });

    const preview = await screen.findByRole('img', { name: 'Vorschau für regenbogen.jpg' });
    expect(preview).toHaveAttribute('src', 'blob:local-preview');
    await waitFor(() => expect(screen.getByPlaceholderText('Frag mich alles')).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'regenbogen.jpg entfernen' }));
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Vorschau für regenbogen.jpg' })).not.toBeInTheDocument());
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-preview');
  });

  it('attaches files locally and tells the user their contents cannot be processed', async () => {
    window.localStorage.setItem('nova.ui.v1', JSON.stringify({ stream: false, think: false, saveHistory: true, suggest: true, theme: 'dark', calm: true }));
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Anhängen' }));
    expect(screen.getByRole('dialog', { name: 'Dateien anhängen' })).toBeInTheDocument();
    const file = new File(['PRIVATE FILE CONTENT'], 'notiz.txt', { type: 'text/plain' });
    const fileInputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInputs[2], { target: { files: [file] } });
    expect(screen.getByText('notiz.txt')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Frag mich alles'), { target: { value: 'Fasse die Datei zusammen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
    await waitFor(() => expect(screen.getByText(/kann ihren Inhalt aber noch nicht auslesen oder verarbeiten/)).toBeInTheDocument(), { timeout: 2_000 });

    const saved = window.localStorage.getItem('nova.chats.v2') || '';
    expect(saved).toContain('notiz.txt');
    expect(saved).not.toContain('PRIVATE FILE CONTENT');
  });

  it('sends a message and renders a local result', async () => {
    window.localStorage.setItem('nova.ui.v1', JSON.stringify({ stream: false, think: false, saveHistory: true, suggest: true, theme: 'dark', calm: true }));
    render(<App />);
    const input = screen.getByPlaceholderText('Frag mich alles');
    fireEvent.change(input, { target: { value: '2 + 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
    expect(screen.getAllByText('2 + 2').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument(), { timeout: 2_000 });
    expect(window.localStorage.getItem('nova.chats.v2')).toContain('2 + 2');
  });

  it('imports rule code sent in the chat and uses the new rule immediately', async () => {
    window.localStorage.setItem('nova.ui.v1', JSON.stringify({ stream: false, think: false, saveHistory: true, suggest: true, theme: 'dark', calm: true }));
    render(<App />);
    const input = screen.getByPlaceholderText('Frag mich alles');
    fireEvent.change(input, { target: { value: 'regel: =hallo\n\nantwort: Hallo {name}! Wie kann ich helfen?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));

    await waitFor(() => expect(screen.getByText(/1 Regel hinzugefügt/)).toBeInTheDocument(), { timeout: 2_000 });
    const savedConfig = JSON.parse(window.localStorage.getItem('nova.config.v2') || '{}') as { pairs?: Array<{ patterns?: string[] }> };
    expect(savedConfig.pairs?.some((rule) => rule.patterns?.includes('=hallo'))).toBe(true);

    fireEvent.change(input, { target: { value: 'hallo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
    await waitFor(() => expect(screen.getByText(/Hallo.*Wie kann ich helfen/)).toBeInTheDocument(), { timeout: 2_000 });
  });
});
