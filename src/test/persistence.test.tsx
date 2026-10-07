import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../data/defaultConfig';
import { MessageWidget } from '../components/MessageWidget';
import { Settings } from '../components/Settings';
import { clone, normalizeChat, normalizeConfig } from '../utils/config';
import type { Chat } from '../types';

describe('saved chat and backup safety', () => {
  it('rejects remote avatars and malformed models in imported config', () => {
    const config = normalizeConfig({ models: [null], avatar: 'https://example.com/tracker.png' });
    expect(config.models).toEqual(DEFAULT_CONFIG.models);
    expect(config.avatar).toBe('');
    expect(normalizeConfig({ avatar: 'data:image/jpeg;base64,AAAA' }).avatar).toBe('data:image/jpeg;base64,AAAA');
  });

  it('normalizes old messages and invalid variant or widget metadata', () => {
    const chat = normalizeChat({
      id: 'c1', messages: [
        { role: 'user', content: 'Hallo' },
        { role: 'assistant', content: 'Hi', vi: -1, meta: [null] },
        { role: 'assistant', variants: ['Antwort'], vi: 0, meta: [{ source: 'chart', widget: { type: 'chart', svg: 123 } }] },
      ],
    }, clone(DEFAULT_CONFIG));
    expect(chat?.messages[1]).toMatchObject({ role: 'assistant', variants: ['Hi'], vi: 0, meta: [{ widget: null }] });
    expect(chat?.messages[2]).toMatchObject({ role: 'assistant', meta: [{ widget: null }] });
  });

  it('shows a restored chart as an image, not executable inline SVG', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><text>Test</text></svg>';
    const { container } = render(<MessageWidget widget={{ type: 'chart', label: 'Test', svg }} config={clone(DEFAULT_CONFIG)} onConfig={vi.fn()} toast={vi.fn()} />);
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByRole('img', { name: 'Diagramm' })).toHaveAttribute('src', `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  });

  it('normalizes chats when restoring a backup and discards invalid entries', async () => {
    const onChats = vi.fn<(chats: Chat[]) => void>();
    const toast = vi.fn();
    const { container } = render(<Settings
      open config={clone(DEFAULT_CONFIG)}
      ui={{ stream: false, think: false, suggest: true, saveHistory: true, theme: 'dark', calm: false }}
      chats={[]} onConfig={vi.fn()} onUi={vi.fn()} onChats={onChats}
      onClose={vi.fn()} onClearChats={vi.fn()} confirm={async () => true} toast={toast}
    />);
    const input = container.querySelector<HTMLInputElement>('input[accept="application/json,.json"]')!;
    const file = new File([''], 'backup.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify({
      config: clone(DEFAULT_CONFIG),
      chats: [null, { id: 'c1', messages: [{ role: 'assistant', variants: ['Hallo'], vi: -1, meta: [null] }] }],
    }) });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onChats).toHaveBeenCalledOnce());
    expect(onChats.mock.calls[0][0]).toMatchObject([{ id: 'c1', messages: [{ vi: 0, meta: [{ widget: null }] }] }]);
  });
});
