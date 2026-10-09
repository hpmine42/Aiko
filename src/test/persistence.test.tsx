import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../data/defaultConfig';
import { MessageWidget } from '../components/MessageWidget';
import App from '../App';
import { Settings } from '../components/Settings';
import { BACKUP_FORMAT_VERSION, LEGACY_LS, LS, STORAGE_FORMAT_VERSION, clone, defaultUi, normalizeBackup, normalizeChat, normalizeConfig } from '../utils/config';
import { useAiko } from '../hooks/useAiko';
import type { Chat } from '../types';

describe('saved chat and backup safety', () => {
  it('migrates version-one browser data to version-two keys and retires old keys after saving', async () => {
    window.localStorage.setItem(LEGACY_LS.cfg, JSON.stringify({ ...clone(DEFAULT_CONFIG), assistantName: 'Aiko Alt' }));
    window.localStorage.setItem(LEGACY_LS.ui, JSON.stringify({ stream: false, think: false, saveHistory: true, theme: 'light' }));
    window.localStorage.setItem(LEGACY_LS.chats, JSON.stringify([{ id: 'old-chat', title: 'Alt', model: 'nova4', ts: 10, messages: [{ role: 'user', content: 'Alte Nachricht', ts: 10 }] }]));
    window.localStorage.setItem(LEGACY_LS.timers, JSON.stringify([{ id: 'old-timer', end: Date.now() + 60_000, dur: 60, label: 'Alt', paused: false }]));
    render(<App />);

    await waitFor(() => expect(window.localStorage.getItem(LS.cfg)).toContain('Aiko Alt'));
    expect(STORAGE_FORMAT_VERSION).toBe(2);
    expect(JSON.parse(window.localStorage.getItem(LS.chats) || '[]')).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(LS.timers) || '[]')).toHaveLength(1);
    for (const key of Object.values(LEGACY_LS)) expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('migrates legacy model labels and leaves the user name blank by default', () => {
    const config = normalizeConfig({
      userName: '   ',
      models: [
        { id: 'nova4', label: '4', desc: 'old' },
        { id: 'nova4mini', label: '4 mini', desc: 'old' },
        { id: 'nova4think', label: '4 Think', desc: 'old' },
      ],
    });
    expect(normalizeConfig(null).userName).toBe('');
    expect(config.userName).toBe('');
    expect(config.models.map((model) => model.label)).toEqual(['Standard', 'Schnell', 'Denkpause']);
  });

  it('syncs external-tab changes without writing them back over storage', async () => {
    window.localStorage.clear();
    const toast = vi.fn();
    function Probe() {
      const aiko = useAiko({ toast });
      const first = aiko.chats[0]?.messages[0];
      const content = first?.role === 'user' ? first.content : '';
      return <output data-testid="synced-state">{aiko.config.userName}|{aiko.ui.theme}|{content}</output>;
    }
    const { unmount } = render(<Probe />);
    const config = { ...clone(DEFAULT_CONFIG), userName: 'Anderer Tab' };
    const ui = { ...defaultUi(), theme: 'light' as const };
    const chats = [{ id: 'remote', title: 'Von Tab B', messages: [{ role: 'user', content: 'Externe Nachricht', ts: 10 }], model: 'nova4', ts: 10, greet: '', temp: false }];
    const values = [
      ['nova.config.v2', JSON.stringify(config)],
      ['nova.ui.v2', JSON.stringify(ui)],
      ['nova.chats.v2', JSON.stringify(chats)],
    ] as const;
    act(() => {
      for (const [key, newValue] of values) {
        window.localStorage.setItem(key, newValue);
        window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: window.localStorage }));
      }
    });
    await waitFor(() => expect(screen.getByTestId('synced-state')).toHaveTextContent('Anderer Tab|light|Externe Nachricht'));
    for (const [key, expected] of values) expect(window.localStorage.getItem(key)).toBe(expected);
    act(() => {
      for (const key of [LEGACY_LS.cfg, LEGACY_LS.ui, LEGACY_LS.chats]) {
        window.dispatchEvent(new StorageEvent('storage', { key, oldValue: '{}', newValue: null, storageArea: window.localStorage }));
      }
    });
    expect(screen.getByTestId('synced-state')).toHaveTextContent('Anderer Tab|light|Externe Nachricht');
    unmount();
  });

  it('supports old backups, blocks future versions, and never imports dictation consent', () => {
    const restored = normalizeBackup({
      app: 'nova', version: 2, config: clone(DEFAULT_CONFIG),
      ui: { stream: false, speechRecognition: true }, chats: [],
    });
    expect(BACKUP_FORMAT_VERSION).toBe(3);
    expect(restored.version).toBe(2);
    expect(restored.ui?.speechRecognition).toBe(false);
    expect(restored.chats).toEqual([]);
    expect(() => normalizeBackup({ app: 'aiko', version: 4, config: clone(DEFAULT_CONFIG) })).toThrow(/neueren Aiko-Version/);
    expect(() => normalizeBackup({ version: 2, chats: [] })).toThrow(/Konfiguration/);
  });

  it('keeps only safe attachment metadata when restoring chats', () => {
    const chat = normalizeChat({ id: 'files', messages: [{
      role: 'user', content: 'Bitte lies das', attachments: [
        { name: 'notiz.txt', size: 12, type: 'text/plain', lastModified: 7, content: 'PRIVATE FILE BODY' },
        { name: '', size: -1, type: 'text/plain' },
      ],
    }] }, clone(DEFAULT_CONFIG));
    expect(chat?.messages[0]).toMatchObject({ role: 'user', attachments: [{ name: 'notiz.txt', size: 12, type: 'text/plain', lastModified: 7 }] });
    expect(JSON.stringify(chat)).not.toContain('PRIVATE FILE BODY');
  });

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

  it('rejects an oversized backup before reading or applying it', async () => {
    const confirm = vi.fn(async () => true);
    const toast = vi.fn();
    const { container } = render(<Settings
      open config={clone(DEFAULT_CONFIG)}
      ui={{ stream: true, think: true, suggest: true, saveHistory: true, speechRecognition: false, theme: 'dark', calm: false }}
      chats={[]} onConfig={vi.fn()} onUi={vi.fn()} onChats={vi.fn()}
      onClose={vi.fn()} onClearChats={vi.fn()} confirm={confirm} toast={toast}
    />);
    const input = container.querySelector<HTMLInputElement>('input[accept="application/json,.json"]')!;
    const file = new File(['{}'], 'oversized.json', { type: 'application/json' });
    Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Backup zu groß · maximal 20 MB'));
    expect(confirm).not.toHaveBeenCalled();
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
      ui={{ stream: false, think: false, suggest: true, saveHistory: true, speechRecognition: false, theme: 'dark', calm: false }}
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
