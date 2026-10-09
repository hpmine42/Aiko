import { useMemo, useState } from 'react';
import type { AikoConfig } from '../types';
import { RULE_CODE_DOC } from '../data/ruleCodeDoc';
import { parseRuleCode, rulesWithIds } from '../engine/ruleParser';
import { copyText } from '../utils/browser';
import { InfoBox } from './InfoBox';

interface CodeImportProps {
  config: AikoConfig;
  onConfig: (config: AikoConfig) => void;
  toast: (message: string) => void;
}

export function CodeImport({ config, onConfig, toast }: CodeImportProps) {
  const [draft, setDraft] = useState('');
  const result = useMemo(() => parseRuleCode(draft), [draft]);
  const ready = Boolean(draft.trim() && !result.errors.length && result.rules.length);

  const message = !draft.trim()
    ? 'Füge Code ein – bei gültigem Code wird der Button unten aktiv.'
    : result.errors.length
      ? `${result.errors.slice(0, 3).join(' · ')}${result.errors.length > 3 ? ' …' : ''}`
      : `✓ ${result.rules.length}${result.rules.length === 1 ? ' Regel bereit.' : ' Regeln bereit.'}`;

  const add = () => {
    if (!ready) return;
    const rules = rulesWithIds(result);
    onConfig({ ...config, pairs: [...config.pairs, ...rules] });
    setDraft('');
    toast(rules.length === 1 ? 'Regel hinzugefügt' : `${rules.length} Regeln hinzugefügt`);
  };

  return (
    <>
      <div className="sec" style={{ marginTop: 18 }}>Regeln per Code hinzufügen</div>
      <InfoBox title="Code-Format – für eine KI kopieren">
        <pre className="codepre">{RULE_CODE_DOC}</pre>
        <button type="button" className="btn" onClick={async () => { toast(await copyText(RULE_CODE_DOC) ? 'Vorlage kopiert' : 'Kopieren fehlgeschlagen'); }}>Vorlage kopieren</button>
      </InfoBox>
      <div className="field">
        <label htmlFor="ruleCodeIn">Code einfügen (eine oder mehrere Regeln)</label>
        <textarea
          id="ruleCodeIn"
          rows={7}
          className="mono codein"
          spellCheck={false}
          placeholder={'regel: wie alt bist du | dein alter\nantwort: Ein Geheimnis! ||| So alt wie {name}.'}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
      <div className={`help${result.errors.length && draft.trim() ? ' err' : ready ? ' ok' : ''}`}>{message}</div>
      <div className="btns" style={{ gridTemplateColumns: '1fr' }}>
        <button type="button" className="btn pri" disabled={!ready} onClick={add}>{result.rules.length === 1 ? 'Regel hinzufügen' : 'Regeln hinzufügen'}</button>
      </div>
    </>
  );
}
