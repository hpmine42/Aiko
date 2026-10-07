import { useMemo, useState } from 'react';
import type { AikoConfig, FollowUpKind, Rule } from '../types';
import { configureEngine, md, pickResponse, plain, ruleTitle, variantsOf, withName } from '../engine/aikoEngine';
import { Icon } from './Icon';
import { InfoBox } from './InfoBox';

const FOLLOW_UPS: Array<[FollowUpKind, string, string]> = [
  ['kuerzer', 'Kürzer', '„kürzer“, „kurz gesagt“, „tl;dr“'],
  ['einfacher', 'Einfacher', '„einfacher bitte“, „versteh ich nicht“'],
  ['warum', 'Warum?', '„warum?“, „wieso das?“'],
  ['beispiel', 'Beispiel', '„ein Beispiel?“, „zeig mal“'],
  ['mehr', 'Mehr Details', '„mehr dazu“, „erzähl mehr“, „genauer“'],
  ['nochmal', 'Noch einmal / anders', '„noch einen“, „nochmal“, „anders“'],
];

interface RuleEditorProps {
  config: AikoConfig;
  index: number | null;
  isNew: boolean;
  onConfig: (config: AikoConfig) => void;
  onClose: () => void;
  onDelete: (rule: Rule) => Promise<boolean>;
  toast: (message: string) => void;
}

export function RuleEditor({ config, index, isNew, onConfig, onClose, onDelete, toast }: RuleEditorProps) {
  const [test, setTest] = useState('');
  if (index == null || !config.pairs[index]) return <section className="page z2" id="rulePage" />;
  const rule = config.pairs[index];

  const update = (patch: Partial<Rule>) => {
    const pairs = config.pairs.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry);
    const next = { ...config, pairs };
    onConfig(next);
    configureEngine(next);
  };

  const close = () => {
    const touched = rule.patterns.length || rule.response.trim() || rule.priority || (rule.exclude || []).length
      || (rule.suggest || []).length || Object.keys(rule.followups || {}).length;
    if (isNew && !touched) onConfig({ ...config, pairs: config.pairs.filter((_, entryIndex) => entryIndex !== index) });
    onClose();
  };

  const variants = variantsOf(rule.response);
  const result = useMemo(() => {
    if (!test.trim()) return null;
    configureEngine(config);
    return pickResponse(test.trim(), null, null);
  }, [config, test]);

  let badge = '';
  let badgeClass = 'fb';
  if (result) {
    if (result.rule?.id === rule.id) { badge = `✓ Diese Regel greift${result.total > 1 ? ` · Variante ${result.index + 1} von ${result.total}` : ''}`; badgeClass = 'ok'; }
    else if (result.rule) { badge = `Eine andere Regel greift: „${ruleTitle(result.rule)}“`; badgeClass = 'warn'; }
    else badge = 'Keine Regel – stattdessen greift ein integriertes Werkzeug oder die Standardantwort';
  }

  return (
    <section className="page z2 open" id="rulePage">
      <div className="ph">
        <button type="button" className="ib" aria-label="Zurück" onClick={close}><Icon name="chevL" /></button>
        <h2>{isNew ? 'Neue Regel' : 'Regel bearbeiten'}</h2>
        <button type="button" className="ib" aria-label="Regel löschen" onClick={async () => {
          if (await onDelete(rule)) onClose();
        }}><Icon name="trash" /></button>
      </div>
      <div className="pb"><div className="pbi">
        <div className="card" style={{ marginTop: 6 }}>
          <label className="item">Regel aktiv<input type="checkbox" className="sw" checked={rule.enabled} onChange={(event) => update({ enabled: event.target.checked })} /></label>
        </div>
        <div className="field">
          <label htmlFor="rPat">Stichwörter / Fragen – eine pro Zeile</label>
          <textarea
            id="rPat"
            rows={5}
            className="mono"
            placeholder={'z. B.\nwie alt bist du\ndein alter'}
            value={rule.patterns.join('\n')}
            onChange={(event) => update({ patterns: event.target.value.split('\n').map((entry) => entry.trim()).filter(Boolean) })}
          />
        </div>
        <div className="help"><code>hallo</code> Nachricht enthält das Wort · <code>=hallo</code> Nachricht ist genau so · <code>~^hi\b</code> regulärer Ausdruck</div>
        <div className="field">
          <label htmlFor="rResp">Antwort</label>
          <textarea
            id="rResp"
            rows={9}
            placeholder={'Antwort 1\n|||\nAntwort 2'}
            value={variants.length > 1 ? variants.join('\n\n|||\n\n') : rule.response}
            onChange={(event) => update({ response: event.target.value })}
          />
        </div>
        <InfoBox title="Antworten & Markdown">
          <ul>
            <li>Mehrere Varianten mit <code>|||</code> trennen – davon wird zufällig eine gewählt.</li>
            <li><code>{'{name}'}</code> wird durch deinen Namen ersetzt.</li>
            <li>Markdown: <code>**fett**</code>, <code>*kursiv*</code>, <code>- Liste</code>, <code>### Überschrift</code>, Tabellen sowie Codeblöcke mit <code>```</code>.</li>
          </ul>
        </InfoBox>
        <div className="vars">
          <div className="vh">{variants.length === 0 ? 'Noch keine Antwort' : variants.length === 1 ? '1 Antwort' : `${variants.length} Varianten – eine wird zufällig gewählt`}</div>
          {variants.length > 1 && <ol>{variants.map((variant, variantIndex) => <li key={`${variant}-${variantIndex}`}>{plain(withName(variant))}</li>)}</ol>}
        </div>
        <div className="rowf">
          <div className="field">
            <label htmlFor="rPrio">Priorität (−9 … 9)</label>
            <input type="number" id="rPrio" min={-9} max={9} value={rule.priority || 0} onChange={(event) => update({ priority: Math.max(-9, Math.min(9, Number.parseInt(event.target.value, 10) || 0)) })} />
          </div>
          <div className="field">
            <label htmlFor="rEx">Nicht reagieren, wenn enthalten</label>
            <input type="text" id="rEx" placeholder="z. B. nicht, kein" value={(rule.exclude || []).join(', ')} onChange={(event) => update({ exclude: event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean) })} />
          </div>
        </div>
        <InfoBox title="Stichwörter, Priorität & Platzhalter – einfach erklärt">
          <ul>
            <li><b>Wer gewinnt?</b> Passen mehrere Regeln auf eine Nachricht, gewinnt die mit der <b>höchsten Priorität</b> (−9 bis 9, Standard 0). Ab Priorität <b>1</b> hat die Regel sogar Vorrang vor Rechner & Werkzeugen.</li>
            <li><b>Tippfehler?</b> Kein Problem: <code>hallo</code> findet auch „halo“ oder „Halllo“.</li>
            <li><b>Mehrere Begriffe verlangen:</b> <code>wetter & morgen</code> – beide Wörter müssen vorkommen.</li>
            <li><b>Rest übernehmen:</b> <code>ich mag {'{x}'}</code> setzt den übernommenen Text in <code>{'{x}'}</code> der Antwort ein.</li>
            <li><b>Automatische Platzhalter:</b> <code>{'{datum}'}</code>, <code>{'{uhrzeit}'}</code>, <code>{'{wochentag}'}</code> und <code>{'{name}'}</code>.</li>
          </ul>
        </InfoBox>
        <div className="field">
          <label htmlFor="rSug">Vorschlags-Buttons unter der Antwort (einer pro Zeile, max. 4)</label>
          <textarea id="rSug" rows={2} placeholder={'z. B.\nNoch ein Beispiel'} value={(rule.suggest || []).join('\n')} onChange={(event) => update({ suggest: event.target.value.split('\n').map((entry) => entry.trim()).filter(Boolean).slice(0, 4) })} />
        </div>
        <div className="btns">
          <button type="button" className="btn" onClick={() => {
            const duplicate: Rule = JSON.parse(JSON.stringify(rule)) as Rule;
            duplicate.id = `p${Date.now()}`;
            const pairs = [...config.pairs];
            pairs.splice(index + 1, 0, duplicate);
            onConfig({ ...config, pairs });
            toast('Regel dupliziert');
          }}>Regel duplizieren</button>
        </div>
        <div className="sec" style={{ marginTop: 14 }}>Folgeantworten (Kontext)</div>
        <InfoBox title="Wofür sind Folgeantworten?">
          Wird genutzt, wenn direkt nach dieser Antwort nachgefragt wird – z. B. „warum?“, „Beispiel?“ oder „Nochmal!“. Leer lassen = automatische Antwort. Mehrere Varianten mit <code>|||</code> trennen.
        </InfoBox>
        {FOLLOW_UPS.map(([kind, label, example]) => (
          <div className="field fu" key={kind}>
            <label htmlFor={`follow-${kind}`}>{label} <span style={{ opacity: 0.7 }}>– {example}</span></label>
            <textarea
              id={`follow-${kind}`}
              rows={2}
              value={rule.followups?.[kind] || ''}
              onChange={(event) => {
                const followups = { ...(rule.followups || {}) };
                if (event.target.value.trim()) followups[kind] = event.target.value;
                else delete followups[kind];
                update({ followups });
              }}
            />
          </div>
        ))}
        <div className="field">
          <label htmlFor="rTest">Testen – schreib eine Beispielfrage</label>
          <input type="text" id="rTest" placeholder="Wie würdest du fragen?" value={test} onChange={(event) => setTest(event.target.value)} />
        </div>
        {result && (
          <div className="testres">
            <span className={`badge ${badgeClass}`}>{badge}</span>
            <div className="md" dangerouslySetInnerHTML={{ __html: md(withName(result.text)) }} />
          </div>
        )}
        <div className="btns" style={{ gridTemplateColumns: '1fr' }}>
          <button type="button" className="btn pri" onClick={close}>Fertig</button>
        </div>
      </div></div>
    </section>
  );
}
