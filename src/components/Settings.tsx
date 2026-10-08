import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AikoConfig, Chat, Rule, RuleTestResult, UiPreferences } from '../types';
import { DEFAULT_CONFIG } from '../data/defaultConfig';
import { CMD_LIST, CMD_MORE } from '../data/commands';
import { SOURCE_LABEL, configureEngine, plain, ruleTitle, runRuleTests, variantsOf, withName } from '../engine/aikoEngine';
import { clone, normalizeChat, normalizeConfig, normalizeUi } from '../utils/config';
import { copyText, downloadBlob, resizeAvatar } from '../utils/browser';
import type { DialogOptions } from './Dialog';
import { CodeImport } from './CodeImport';
import { Icon } from './Icon';
import { RuleEditor } from './RuleEditor';

interface SettingsProps {
  open: boolean;
  config: AikoConfig;
  ui: UiPreferences;
  chats: Chat[];
  onConfig: (config: AikoConfig) => void;
  onUi: (ui: UiPreferences) => void;
  onChats: (chats: Chat[]) => void;
  onClose: () => void;
  onClearChats: () => void;
  confirm: (options: DialogOptions) => Promise<boolean>;
  toast: (message: string) => void;
  initialRulesOpen?: boolean;
}

export function Settings({
  open,
  config,
  ui,
  chats,
  onConfig,
  onUi,
  onChats,
  onClose,
  onClearChats,
  confirm,
  toast,
  initialRulesOpen,
}: SettingsProps) {
  const [ruleIndex, setRuleIndex] = useState<number | null>(null);
  const [newRule, setNewRule] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [testReport, setTestReport] = useState<RuleTestResult[] | null>(null);
  const avatarFile = useRef<HTMLInputElement>(null);
  const backupFile = useRef<HTMLInputElement>(null);
  const jsonFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !initialRulesOpen) return undefined;
    const timer = window.setTimeout(() => document.getElementById('rulesSec')?.scrollIntoView({ block: 'start' }), 40);
    return () => window.clearTimeout(timer);
  }, [initialRulesOpen, open]);

  if (!open) return null;

  const changeConfig = (next: AikoConfig) => {
    onConfig(next);
    configureEngine(next);
  };

  const openRule = (index: number, isNew = false) => {
    setNewRule(isNew);
    setRuleIndex(index);
  };

  const deleteRule = async (rule: Rule): Promise<boolean> => {
    if (!(await confirm({ title: 'Regel löschen?', text: `„${ruleTitle(rule)}“ wird entfernt.`, ok: 'Löschen', danger: true }))) return false;
    changeConfig({ ...config, pairs: config.pairs.filter((entry) => entry.id !== rule.id) });
    toast('Regel gelöscht');
    return true;
  };

  const backup = () => {
    const data = { app: 'nova', version: 2, created: new Date().toISOString(), config, ui, chats: chats.filter((chat) => !chat.temp) };
    downloadBlob(JSON.stringify(data, null, 2), 'application/json', `nova-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast('Backup gespeichert');
  };

  const restore = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { config?: unknown; ui?: unknown; chats?: unknown };
      if (!parsed || typeof parsed !== 'object' || !parsed.config) { toast('Das ist kein Nova-Backup'); return; }
      const nextConfig = normalizeConfig(parsed.config);
      const restoredChats = Array.isArray(parsed.chats)
        ? parsed.chats.map((chat) => normalizeChat(chat, nextConfig)).filter((chat): chat is Chat => Boolean(chat?.messages.length) && !chat?.temp)
        : [];
      if (!(await confirm({ title: 'Backup wiederherstellen?', text: 'Regeln, Einstellungen und Chats werden durch den Inhalt des Backups ersetzt.', ok: 'Wiederherstellen', danger: true }))) return;
      changeConfig(nextConfig);
      if (parsed.ui) onUi(normalizeUi(parsed.ui));
      if (Array.isArray(parsed.chats)) onChats(restoredChats);
      toast(`Wiederhergestellt · ${restoredChats.length} Chats, ${nextConfig.pairs.length} Regeln`);
    } catch {
      toast('Keine gültige Backup-Datei');
    }
  };

  const rules = config.pairs.map((rule, index) => {
    const variants = variantsOf(rule.response);
    return (
      <button type="button" className={`item rule${rule.enabled ? '' : ' off'}`} key={rule.id} onClick={() => openRule(index)}>
        <div className="rt">
          <div className="k">
            {ruleTitle(rule)}
            {variants.length > 1 && <span className="pill">{variants.length} Varianten</span>}
            {!rule.enabled && <span className="pill">aus</span>}
            {config.stats.rules[rule.id] ? <span className="statsline">{config.stats.rules[rule.id]}×</span> : null}
          </div>
          <div className="p">{plain(withName(variants[0] || '– keine Antwort –'))}</div>
        </div>
        <Icon name="chevR" className="i ch" />
      </button>
    );
  });

  return (
    <>
      <section className="page open" id="setPage" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="ph">
          <button type="button" className="ib" aria-label="Schließen" onClick={onClose}><Icon name="close" /></button>
          <h2 id="settings-title">Einstellungen</h2><span style={{ width: 40 }} />
        </div>
        <div className="pb"><div className="pbi">
          <Accordion id="profil" title="Profil" defaultOpen>
            <div className="card">
              <button type="button" className="item" onClick={() => avatarFile.current?.click()}>
                <span className="av">{config.avatar ? <img src={config.avatar} alt="" /> : (config.assistantName || 'Aiko')[0].toUpperCase()}</span>
                Profilbild {config.avatar ? 'ändern' : 'hinzufügen'}
              </button>
              {config.avatar && <button type="button" className="item danger" onClick={async () => {
                if (!(await confirm({ title: 'Profilbild löschen?', text: 'Es wird wieder der Buchstabe deines Namens angezeigt.', ok: 'Löschen', danger: true }))) return;
                changeConfig({ ...config, avatar: '' });
                toast('Profilbild gelöscht');
              }}>Profilbild löschen</button>}
              <label className="item">Dein Name<input className="txt" type="text" placeholder="optional" value={config.userName} onChange={(event) => changeConfig({ ...config, userName: event.target.value.trimStart() })} /></label>
              <label className="item">Name des Assistenten<input className="txt" type="text" value={config.assistantName} onChange={(event) => changeConfig({ ...config, assistantName: event.target.value || 'Aiko' })} /></label>
            </div>
          </Accordion>

          <Accordion id="look" title="Darstellung" defaultOpen>
            <div className="card">
              <div className="item">Design<div className="seg">
                {([['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']] as const).map(([theme, label]) => (
                  <button type="button" key={theme} className={ui.theme === theme ? 'on' : ''} onClick={() => onUi({ ...ui, theme })}>{label}</button>
                ))}
              </div></div>
              <label className="item">Animationen reduzieren<input type="checkbox" className="sw" checked={ui.calm} onChange={(event) => onUi({ ...ui, calm: event.target.checked })} /></label>
            </div>
          </Accordion>

          <Accordion id="behave" title="Antwortverhalten" defaultOpen>
            <div className="card">
              <SwitchItem label="Wort für Wort tippen" checked={ui.stream} onChange={(stream) => onUi({ ...ui, stream })} />
              <SwitchItem label="Kurz nachdenken vor der Antwort" checked={ui.think} onChange={(think) => onUi({ ...ui, think })} />
              <SwitchItem label="Vorschlags-Buttons unter Antworten" checked={ui.suggest} onChange={(suggest) => onUi({ ...ui, suggest })} />
              <SwitchItem label="Chatverlauf speichern" checked={ui.saveHistory} onChange={(saveHistory) => onUi({ ...ui, saveHistory })} />
            </div>
          </Accordion>

          <Accordion id="rules" title={`Antworten festlegen · ${config.pairs.length} Regeln`} defaultOpen>
            <div className="card">
              {rules}
              <button type="button" className="item" style={{ color: 'var(--accent2)' }} onClick={() => {
                const pairs = [...config.pairs, { id: `p${Date.now()}`, enabled: true, patterns: [], response: '', exclude: [], priority: 0, followups: {}, suggest: [] }];
                changeConfig({ ...config, pairs });
                openRule(pairs.length - 1, true);
              }}><Icon name="plus" />Neue Regel</button>
            </div>
            <div className="help">Tippe auf eine Regel, um Stichwörter, Antworten, Folgeantworten und Vorschlags-Buttons zu ändern. Mehrere Antworten mit <code>|||</code> trennen – dann wird zufällig gewählt.</div>
            <div className="card" style={{ marginTop: 18 }}>
              <button type="button" className="item" onClick={() => {
                if (testReport) setTestReport(null);
                else { configureEngine(config); setTestReport(runRuleTests()); }
              }}>Alle Regeln testen</button>
            </div>
            {testReport && <RuleTestReport rows={testReport} />}
            <CodeImport config={config} onConfig={changeConfig} toast={toast} />
          </Accordion>

          <Accordion
            id="cmds"
            title={`Integrierte Befehle · ${CMD_LIST.length + CMD_MORE.reduce((sum, group) => sum + group[1].length, 0)}`}
            defaultOpen
          >
            <div className="help">Alle folgenden Befehle sind fest eingebaut und funktionieren <b>mit oder ohne /</b> – tippe z. B. <code>timer 5 Minuten</code> oder <code>/timer 5 Minuten</code>. Deine eigenen Regeln stehen unter „Antworten festlegen“.</div>
            <div className="card cmdcard">
              <div className="cgrp">Menü-Befehle (erscheinen beim Tippen von /)</div>
              {CMD_LIST.map(([command, description]) => <CommandRow key={command} command={command} description={description} />)}
            </div>
            {CMD_MORE.map(([title, commands]) => (
              <div className="card cmdcard" key={title}>
                <div className="cgrp">{title}</div>
                {commands.map(([command, description]) => <CommandRow key={command} command={command} description={description} />)}
              </div>
            ))}
          </Accordion>

          <Accordion id="texts" title="Texte & Standardantworten">
            <TextField label="Wenn keine Regel passt (mit ||| trennen)" rows={4} value={config.fallback.join('\n|||\n')} onChange={(value) => changeConfig({ ...config, fallback: variantsOf(value) })} />
            <TextField label="Wenn jemand nachfragt („warum?“, „Beispiel?“) und die Regel keine Folgeantwort hat (mit ||| trennen)" rows={3} value={config.followFallback} onChange={(followFallback) => changeConfig({ ...config, followFallback })} />
            <TextField label="Begrüßungen auf dem Startbildschirm – eine pro Zeile, zufällig gewählt" rows={5} value={config.greetings.join('\n')} onChange={(value) => {
              const greetings = value.split('\n').map((entry) => entry.trim()).filter(Boolean);
              changeConfig({ ...config, greetings: greetings.length ? greetings : clone(DEFAULT_CONFIG.greetings) });
            }} />
            <div className="help"><code>{'{name}'}</code> wird überall durch deinen Namen ersetzt – auch in Antworten, z. B. <code>Hallo {'{name}'}! 👋</code></div>
          </Accordion>

          <Accordion id="know" title="Wissen & Merkzettel">
            <TextField label={`Erinnerungen – was sich ${config.assistantName} über dich gemerkt hat (eine pro Zeile). Im Chat: „Merke dir: …“, „Vergiss …“`} rows={3} value={config.memory.join('\n')} onChange={(value) => changeConfig({ ...config, memory: value.split('\n').map((entry) => entry.trim()).filter(Boolean) })} />
            <TextField label="Wissenssammlung – eigene Notizen/FAQ. Abschnitte mit ## Überschrift trennen; passende Abschnitte werden bei Fragen mit Quelle zitiert." rows={7} mono value={config.knowledge} onChange={(knowledge) => changeConfig({ ...config, knowledge })} />
            <TextField label="Eigenes Wörterbuch – ergänzt das eingebaute Deutsch↔Englisch. Eine pro Zeile: deutsch = englisch" rows={3} mono value={config.dictionary} onChange={(dictionary) => changeConfig({ ...config, dictionary })} placeholder="Schmetterling = butterfly" />
          </Accordion>

          {Object.keys(config.stats.tools).length > 0 && (
            <Accordion id="stats" title="Nutzung – Werkzeuge">
              <div className="card">
                {Object.entries(config.stats.tools).filter(([key]) => (SOURCE_LABEL as Record<string, string>)[key]).map(([key, count]) => (
                  <div className="item" key={key}>{(SOURCE_LABEL as Record<string, string>)[key]}<span className="statsline">{count}×</span></div>
                ))}
              </div>
            </Accordion>
          )}

          <div className="sec">Daten</div>
          <div className="card">
            <button type="button" className="item" onClick={backup}>Komplettes Backup herunterladen</button>
            <button type="button" className="item" onClick={() => backupFile.current?.click()}>Backup wiederherstellen</button>
            <button type="button" className="item" onClick={() => { setJsonText(JSON.stringify(config, null, 2)); setJsonOpen(true); }}>Import / Export (JSON)<Icon name="chevR" className="i ch" /></button>
            <button type="button" className="item danger" onClick={async () => {
              if (!(await confirm({ title: 'Alle Chats löschen?', text: 'Dein gesamter Chatverlauf wird entfernt. Deine Regeln bleiben erhalten.', ok: 'Löschen', danger: true }))) return;
              onClearChats();
              toast('Alle Chats gelöscht');
            }}>Alle Chats löschen</button>
            <button type="button" className="item danger" onClick={async () => {
              if (!(await confirm({ title: 'Auf Standard zurücksetzen?', text: 'Alle eigenen Regeln, Namen und Einstellungen werden durch die Standardwerte ersetzt.', ok: 'Zurücksetzen', danger: true }))) return;
              changeConfig(normalizeConfig(null));
              onUi(normalizeUi({ stream: true, think: true, suggest: true, saveHistory: true, theme: 'dark', calm: false }));
              toast('Zurückgesetzt');
            }}>Auf Standard zurücksetzen</button>
          </div>
        </div></div>
      </section>

      <input ref={avatarFile} type="file" accept="image/*" hidden onChange={async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        try { changeConfig({ ...config, avatar: await resizeAvatar(file) }); toast('Profilbild geändert'); }
        catch { toast('Bild konnte nicht gelesen werden'); }
      }} />
      <input ref={backupFile} type="file" accept="application/json,.json" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void restore(file);
      }} />

      {ruleIndex != null && config.pairs[ruleIndex] && (
        <RuleEditor
          config={config}
          index={ruleIndex}
          isNew={newRule}
          onConfig={changeConfig}
          onClose={() => { setRuleIndex(null); setNewRule(false); }}
          onDelete={deleteRule}
          toast={toast}
        />
      )}

      {jsonOpen && (
        <section className="page z2 open" id="jsonPage" role="dialog" aria-modal="true" aria-labelledby="json-title">
          <div className="ph">
            <button type="button" className="ib" aria-label="Zurück" onClick={() => setJsonOpen(false)}><Icon name="chevL" /></button>
            <h2 id="json-title">Import / Export</h2><span style={{ width: 40 }} />
          </div>
          <div className="pb"><div className="pbi">
            <div className="help" style={{ paddingTop: 4 }}>Hier stehen alle Regeln als JSON. Kopiere den Text zum Sichern. Oder füge eine gesicherte Version ein und tippe auf „Übernehmen“.</div>
            <div className="field"><textarea className="mono" rows={16} spellCheck={false} style={{ marginTop: 12 }} value={jsonText} onChange={(event) => setJsonText(event.target.value)} /></div>
            <div className="btns">
              <button type="button" className="btn" onClick={() => { void copyText(jsonText); toast('Kopiert'); }}>Kopieren</button>
              <button type="button" className="btn pri" onClick={() => {
                try {
                  let parsed: unknown = JSON.parse(jsonText);
                  if (Array.isArray(parsed)) parsed = { pairs: parsed };
                  if (!parsed || typeof parsed !== 'object') throw new Error('Kein gültiges Objekt');
                  const next = normalizeConfig(parsed);
                  changeConfig(next);
                  toast(`Übernommen · ${next.pairs.length} Regeln`);
                } catch (error) { toast(`Ungültiges JSON: ${error instanceof Error ? error.message : 'Fehler'}`); }
              }}>Übernehmen</button>
              <button type="button" className="btn" onClick={() => downloadBlob(jsonText, 'application/json', 'nova-antworten.json')}>Als Datei sichern</button>
              <button type="button" className="btn" onClick={() => jsonFile.current?.click()}>Datei öffnen</button>
            </div>
            <input ref={jsonFile} type="file" accept=".json,application/json,text/plain" hidden onChange={async (event) => {
              const file = event.target.files?.[0]; event.target.value = '';
              if (file) { setJsonText(await file.text()); toast('Datei geladen – tippe auf „Übernehmen“'); }
            }} />
          </div></div>
        </section>
      )}
    </>
  );
}

function Accordion({ id, title, children, defaultOpen = false }: { id: string; title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <button
        id={id === 'rules' ? 'rulesSec' : undefined}
        type="button"
        className={`sec h${open ? '' : ' closed'}`}
        aria-expanded={open}
        aria-controls={`${id}-content`}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span><Icon name="chevD" />
      </button>
      <div id={`${id}-content`} className={`accb${open ? '' : ' hidden'}`}>{children}</div>
    </>
  );
}

function SwitchItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="item">{label}<input type="checkbox" className="sw" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function TextField({ label, value, onChange, rows, mono, placeholder }: { label: string; value: string; onChange: (value: string) => void; rows: number; mono?: boolean; placeholder?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea className={mono ? 'mono' : ''} rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function CommandRow({ command, description }: { command: string; description: string }) {
  return <div className="cmdrow"><b>{command}</b><span>{description}</span></div>;
}

function RuleTestReport({ rows }: { rows: RuleTestResult[] }) {
  const [showAll, setShowAll] = useState(false);
  const icons: Record<RuleTestResult['ok'], string> = { good: '✅', warn: '⚠️', bad: '❌', off: '⏸', skip: 'ℹ️' };
  const failed = rows.filter((row) => row.ok === 'bad' || row.ok === 'warn');
  const rest = rows.filter((row) => row.ok !== 'bad' && row.ok !== 'warn');
  const shown = showAll ? [...failed, ...rest] : failed;
  return (
    <div className="card">
      <div className="item"><div className="rt">
        <div className="k">{rows.filter((row) => row.ok === 'good').length} von {rows.length} Prüfungen in Ordnung{failed.length ? ` · ${failed.length} ${failed.length === 1 ? 'Problem' : 'Probleme'}` : ''}</div>
        <div className="p">{failed.length ? 'Hier stehen die fehlgeschlagenen Prüfungen – mit Grund.' : 'Alles bestanden.'}</div>
      </div></div>
      {shown.map((row, index) => (
        <div className="item" key={`${row.p.id}-${row.q}-${index}`}><div className="rt"><div className="k">{icons[row.ok]} {ruleTitle(row.p)}</div><div className="p">{row.q} → {row.msg}</div></div></div>
      ))}
      {rest.length > 0 && <button type="button" className="item" style={{ color: 'var(--accent2)' }} onClick={() => setShowAll((value) => !value)}>{showAll ? 'Weitere Prüfungen ausblenden' : `Alle ${rest.length} weiteren Prüfungen anzeigen`}</button>}
    </div>
  );
}
