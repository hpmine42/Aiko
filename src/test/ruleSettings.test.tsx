import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodeImport } from '../components/CodeImport';
import { Dialog, type DialogOptions } from '../components/Dialog';
import { Settings } from '../components/Settings';
import { DEFAULT_CONFIG } from '../data/defaultConfig';
import { useDialog } from '../hooks/useDialog';
import type { AikoConfig } from '../types';
import { clone, defaultUi } from '../utils/config';

const codeField = () => screen.getByRole('textbox', { name: 'Code einfügen (eine oder mehrere Regeln)' });
const pasteCode = (value: string) => fireEvent.change(codeField(), { target: { value } });

function configWithRules(): AikoConfig {
  return {
    ...clone(DEFAULT_CONFIG),
    pairs: [
      { id: 'old-hello', enabled: true, patterns: ['hallo'], response: 'Alte Begrüßung' },
      { id: 'old-weather', enabled: true, patterns: ['=wetter'], response: 'Alte Wetter-Antwort' },
    ],
  };
}

function renderImporter(config = configWithRules()) {
  const props = {
    config,
    onConfig: vi.fn<(next: AikoConfig) => void>(),
    confirm: vi.fn<(options: DialogOptions) => Promise<boolean>>().mockResolvedValue(true),
    toast: vi.fn<(message: string) => void>(),
  };
  return { ...render(<CodeImport {...props} />), props };
}

function SettingsHarness({ onChange }: { onChange: (config: AikoConfig) => void }) {
  const [config, setConfig] = useState(configWithRules);
  const dialog = useDialog();
  return (
    <>
      <Settings
        open config={config} ui={defaultUi()} chats={[]}
        onConfig={(next) => { setConfig(next); onChange(next); }}
        onUi={() => undefined} onChats={() => undefined} onClose={() => undefined}
        onClearChats={() => undefined} confirm={dialog.confirm} toast={() => undefined}
        modalOpen={Boolean(dialog.options)}
      />
      <Dialog options={dialog.options} onResult={dialog.result} />
    </>
  );
}

const rulesToggle = () => screen.getByRole('button', { name: /Antworten festlegen/ });

describe('code-field conflict feedback', () => {
  it('keeps imports disabled for empty or invalid code and clears obsolete conflict warnings', () => {
    const { props } = renderImporter();
    expect(screen.getByRole('button', { name: 'Regeln hinzufügen' })).toBeDisabled();
    pasteCode('regel: hallo\nantwort: Neu');
    expect(screen.getByRole('region', { name: 'Mögliche Regelkonflikte' })).toBeInTheDocument();

    pasteCode('regel: hallo');
    expect(screen.getByRole('status')).toHaveTextContent('„antwort:“ fehlt');
    expect(codeField()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('region', { name: 'Mögliche Regelkonflikte' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regel hinzufügen' })).toBeDisabled();
    expect(props.onConfig).not.toHaveBeenCalled();
    expect(props.confirm).not.toHaveBeenCalled();
  });

  it('checks conflicts as soon as valid code is pasted, before any button is pressed', () => {
    const { props } = renderImporter();
    pasteCode('regel: hallo\nantwort: Neu\npriorität: 2');
    expect(screen.getByRole('status')).toHaveTextContent('1 möglicher Regelkonflikt');
    const conflicts = screen.getByRole('region', { name: 'Mögliche Regelkonflikte' });
    expect(conflicts).toHaveTextContent('Neue Regel 1 „hallo“');
    expect(conflicts).toHaveTextContent('Vorhandene Regel „hallo“');
    expect(conflicts).toHaveTextContent('Beispielfrage: hallo');
    expect(conflicts).toHaveTextContent('Unter den Regeln gewinnt: Neue Regel 1 „hallo“ (Priorität 2)');
    expect(codeField()).toHaveAttribute('aria-invalid', 'false');
    expect(props.onConfig).not.toHaveBeenCalled();
    expect(props.confirm).not.toHaveBeenCalled();
  });

  it('imports unrelated rules normally without a confirmation', async () => {
    const { props } = renderImporter();
    pasteCode('regel: =sonne\nantwort: Sonnig');
    expect(screen.getByRole('status')).toHaveTextContent('Keine Konflikte in den Beispielfragen gefunden');
    fireEvent.click(screen.getByRole('button', { name: 'Regel hinzufügen' }));
    await waitFor(() => expect(props.onConfig).toHaveBeenCalledOnce());
    const next = props.onConfig.mock.calls[0][0];
    expect(next.pairs).toHaveLength(3);
    expect(next.pairs[0]).toBe(props.config.pairs[0]);
    expect(next.pairs[2]).toMatchObject({ patterns: ['=sonne'], response: 'Sonnig' });
    expect(next.pairs[2].id).not.toContain('import-preview');
    expect(props.confirm).not.toHaveBeenCalled();
    expect(props.toast).toHaveBeenCalledWith('Regel hinzugefügt');
    expect(codeField()).toHaveValue('');
  });

  it('does not import or clear the draft when a conflict confirmation is cancelled', async () => {
    const { props } = renderImporter();
    props.confirm.mockResolvedValue(false);
    const draft = 'regel: hallo\nantwort: Neu';
    pasteCode(draft);
    fireEvent.click(screen.getByRole('button', { name: 'Trotz Konflikten hinzufügen' }));
    await waitFor(() => expect(props.confirm).toHaveBeenCalledOnce());
    expect(props.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Trotz Regelkonflikten hinzufügen?', ok: 'Trotzdem hinzufügen' }));
    expect(props.onConfig).not.toHaveBeenCalled();
    expect(props.toast).not.toHaveBeenCalled();
    expect(codeField()).toHaveValue(draft);
  });

  it('requires an explicit confirmation for conflicts and preserves existing rules on import', async () => {
    const { props } = renderImporter();
    pasteCode('regel: hallo\nantwort: Neu\npriorität: 2');
    fireEvent.click(screen.getByRole('button', { name: 'Trotz Konflikten hinzufügen' }));
    await waitFor(() => expect(props.onConfig).toHaveBeenCalledOnce());
    expect(props.confirm).toHaveBeenCalledOnce();
    const next = props.onConfig.mock.calls[0][0];
    expect(next.pairs.slice(0, 2)).toEqual(props.config.pairs);
    expect(next.pairs[2]).toMatchObject({ patterns: ['hallo'], response: 'Neu', priority: 2 });
    expect(codeField()).toHaveValue('');
    expect(screen.queryByRole('region', { name: 'Mögliche Regelkonflikte' })).not.toBeInTheDocument();
  });

  it('updates the preview when the stored rules change while the draft stays the same', () => {
    const config = { ...configWithRules(), pairs: [] };
    const { props, rerender } = renderImporter(config);
    pasteCode('regel: hallo\nantwort: Neu');
    expect(screen.getByRole('status')).toHaveTextContent('Keine Konflikte');
    rerender(<CodeImport {...props} config={configWithRules()} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 möglicher Regelkonflikt');
    const disabled = configWithRules();
    disabled.pairs[0].enabled = false;
    rerender(<CodeImport {...props} config={disabled} />);
    expect(screen.getByRole('status')).toHaveTextContent('Keine Konflikte');
    expect(codeField()).toHaveValue('regel: hallo\nantwort: Neu');
    expect(props.onConfig).not.toHaveBeenCalled();
  });

  it('checks multiple new rules against each other and clears feedback when the draft changes', () => {
    const { props } = renderImporter({ ...configWithRules(), pairs: [] });
    pasteCode('regel: hallo\nantwort: Eins\n---\nregel: hallo\nantwort: Zwei');
    expect(screen.getByRole('status')).toHaveTextContent('1 möglicher Regelkonflikt');
    const conflicts = screen.getByRole('region', { name: 'Mögliche Regelkonflikte' });
    expect(conflicts).toHaveTextContent('Neue Regel 1 „hallo“');
    expect(conflicts).toHaveTextContent('Neue Regel 2 „hallo“');
    expect(conflicts).not.toHaveTextContent('Vorhandene Regel');
    pasteCode('regel: =sonne\nantwort: Neu');
    expect(screen.queryByRole('region', { name: 'Mögliche Regelkonflikte' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regel hinzufügen' })).toBeEnabled();
    pasteCode('');
    expect(screen.getByRole('status')).toHaveTextContent('Syntax und Regelkonflikte werden sofort geprüft');
    expect(props.onConfig).not.toHaveBeenCalled();
  });

  it('explains incomplete regex coverage rather than claiming all conflicts are ruled out', () => {
    const config = { ...configWithRules(), pairs: [{ id: 'old', enabled: true, patterns: ['~/^a+$/'], response: 'Alt' }] };
    renderImporter(config);
    pasteCode('regel: ~/a$/\nantwort: Neu');
    expect(screen.getByText(/Überschneidungen zwischen unterschiedlichen RegEx können unentdeckt bleiben/)).toBeInTheDocument();
    expect(codeField()).toHaveAttribute('aria-describedby', 'ruleCodeFeedback ruleCodeRegexHint');
    pasteCode('regel: ~/^a+$/\nantwort: Neu');
    expect(screen.getByRole('status')).toHaveTextContent('1 möglicher Regelkonflikt');
    expect(screen.getByRole('region', { name: 'Mögliche Regelkonflikte' })).toHaveTextContent('Gleiches RegEx-Muster');
  });
});

describe('collapsible rules in settings', () => {
  it('collapses only the existing list, preserves the draft and leaves all rule tools visible', () => {
    const onChange = vi.fn();
    render(<SettingsHarness onChange={onChange} />);
    const list = document.getElementById('rules-content')!;
    const oldRule = within(list).getByRole('button', { name: /^hallo/ });
    pasteCode('regel: =sonne\nantwort: Neu');
    expect(oldRule).toBeVisible();
    fireEvent.click(rulesToggle());
    expect(rulesToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(rulesToggle()).toHaveAttribute('aria-controls', 'rules-content');
    expect(list).toHaveAttribute('hidden');
    expect(oldRule).not.toBeVisible();
    expect(screen.getByRole('button', { name: 'Neue Regel' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Alle Regeln testen' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Code-Format – für eine KI kopieren/ })).toBeVisible();
    expect(codeField()).toBeVisible();
    expect(codeField()).toHaveValue('regel: =sonne\nantwort: Neu');
    fireEvent.click(rulesToggle());
    expect(rulesToggle()).toHaveAttribute('aria-expanded', 'true');
    expect(oldRule).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('can still run and hide the rule test report with the list collapsed', () => {
    const onChange = vi.fn();
    render(<SettingsHarness onChange={onChange} />);
    fireEvent.click(rulesToggle());
    fireEvent.click(screen.getByRole('button', { name: 'Alle Regeln testen' }));
    expect(screen.getByText('2 von 2 Prüfungen in Ordnung')).toBeVisible();
    expect(rulesToggle()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Alle Regeln testen' }));
    expect(screen.queryByText('2 von 2 Prüfungen in Ordnung')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('can create a rule while collapsed and removes an untouched new rule on closing the editor', () => {
    const onChange = vi.fn();
    render(<SettingsHarness onChange={onChange} />);
    fireEvent.click(rulesToggle());
    fireEvent.click(screen.getByRole('button', { name: 'Neue Regel' }));
    expect(screen.getByRole('dialog', { name: 'Neue Regel' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(rulesToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(rulesToggle()).toHaveTextContent('2 Regeln');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('imports with the list collapsed, updates the count and does not automatically expand it', () => {
    const onChange = vi.fn();
    render(<SettingsHarness onChange={onChange} />);
    fireEvent.click(rulesToggle());
    pasteCode('regel: =sonne\nantwort: Sonnig');
    fireEvent.click(screen.getByRole('button', { name: 'Regel hinzufügen' }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(rulesToggle()).toHaveTextContent('3 Regeln');
    expect(rulesToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('rules-content')).not.toBeVisible();
    expect(codeField()).toHaveValue('');
    fireEvent.click(rulesToggle());
    expect(within(document.getElementById('rules-content')!).getByRole('button', { name: /^=sonne/ })).toBeVisible();
  });

  it('uses the real confirmation dialog and keeps settings isolated until the user decides', async () => {
    const onChange = vi.fn();
    render(<SettingsHarness onChange={onChange} />);
    fireEvent.click(rulesToggle());
    const draft = 'regel: hallo\nantwort: Neue Begrüßung\npriorität: 2';
    pasteCode(draft);
    fireEvent.click(screen.getByRole('button', { name: 'Trotz Konflikten hinzufügen' }));
    await screen.findByRole('alertdialog', { name: 'Trotz Regelkonflikten hinzufügen?' });
    expect(document.getElementById('setPage')).toHaveAttribute('inert');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(document.getElementById('setPage')).not.toHaveAttribute('inert'));
    expect(codeField()).toHaveValue(draft);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Trotz Konflikten hinzufügen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Trotzdem hinzufügen' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.getElementById('setPage')).not.toHaveAttribute('inert');
    expect(rulesToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(rulesToggle()).toHaveTextContent('3 Regeln');
    expect(codeField()).toHaveValue('');
  });
});
