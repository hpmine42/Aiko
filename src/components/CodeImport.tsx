import { useMemo, useState } from 'react';
import type { AikoConfig, Rule } from '../types';
import { RULE_CODE_DOC } from '../data/ruleCodeDoc';
import { ruleTitle } from '../engine/aikoEngine';
import { checkRuleConflicts } from '../engine/ruleConflicts';
import { parseRuleCode, rulesWithIds } from '../engine/ruleParser';
import { copyText } from '../utils/browser';
import type { DialogOptions } from './Dialog';
import { InfoBox } from './InfoBox';

interface CodeImportProps {
  config: AikoConfig;
  onConfig: (config: AikoConfig) => void;
  confirm: (options: DialogOptions) => Promise<boolean>;
  toast: (message: string) => void;
}

export function CodeImport({ config, onConfig, confirm, toast }: CodeImportProps) {
  const [draft, setDraft] = useState('');
  const result = useMemo(() => parseRuleCode(draft), [draft]);
  const ready = Boolean(draft.trim() && !result.errors.length && result.rules.length);
  // Preview IDs are never stored. References distinguish existing/new rules
  // even if an old backup contains duplicate IDs.
  const previewRules = useMemo(() => result.rules.map((rule, index) => ({ ...rule, id: `import-preview-${index}` })), [result]);
  const check = useMemo(() => ready
    ? checkRuleConflicts(config.pairs, previewRules)
    : { conflicts: [], hasRegex: false }, [config.pairs, previewRules, ready]);
  const hasConflicts = check.conflicts.length > 0;

  const message = !draft.trim()
    ? 'Füge Code ein – Syntax und Regelkonflikte werden sofort geprüft.'
    : result.errors.length
      ? `${result.errors.slice(0, 3).join(' · ')}${result.errors.length > 3 ? ' …' : ''}`
      : hasConflicts
        ? `⚠ ${check.conflicts.length} ${check.conflicts.length === 1 ? 'möglicher Regelkonflikt' : 'mögliche Regelkonflikte'} gefunden. Bitte vor dem Hinzufügen prüfen.`
        : `✓ ${result.rules.length}${result.rules.length === 1 ? ' Regel bereit.' : ' Regeln bereit.'} Keine Konflikte in den Beispielfragen gefunden.`;

  const label = (rule: Rule) => {
    const index = previewRules.indexOf(rule);
    return `${index < 0 ? 'Vorhandene Regel' : `Neue Regel ${index + 1}`} „${ruleTitle(rule)}“`;
  };

  const add = async () => {
    if (!ready) return;
    if (hasConflicts && !(await confirm({
      title: 'Trotz Regelkonflikten hinzufügen?',
      text: `${check.conflicts.length} ${check.conflicts.length === 1 ? 'möglicher Regelkonflikt wurde' : 'mögliche Regelkonflikte wurden'} gefunden. Vorhandene Regeln bleiben erhalten, können aber durch die neuen Regeln verdrängt werden. Prüfe die Hinweise oder passe Stichwörter, Priorität und Ausschlüsse im Code an.`,
      ok: 'Trotzdem hinzufügen',
    }))) return;
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
          aria-describedby={`ruleCodeFeedback${ready && check.hasRegex ? ' ruleCodeRegexHint' : ''}`}
          aria-invalid={Boolean(draft.trim() && result.errors.length)}
          placeholder={'regel: wie alt bist du | dein alter\nantwort: Ein Geheimnis! ||| So alt wie {name}.'}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
      <div id="ruleCodeFeedback" role="status" aria-atomic="true" className={`help${result.errors.length && draft.trim() ? ' err' : hasConflicts ? ' warn' : ready ? ' ok' : ''}`}>{message}</div>
      {hasConflicts && (
        <div className="rule-conflicts" role="region" aria-label="Mögliche Regelkonflikte">
          <ul>
            {check.conflicts.map((conflict, index) => (
              <li key={index}>
                <b>{label(conflict.incoming)}</b>
                <div>überschneidet sich mit {label(conflict.other)}.</div>
                {conflict.query !== null && conflict.winner
                  ? <div>Beispielfrage: <code>{conflict.query}</code><br />Unter den Regeln gewinnt: {label(conflict.winner)} (Priorität {conflict.winner.priority || 0}).</div>
                  : <div>Gleiches RegEx-Muster. Bitte mit einer eigenen Beispielfrage testen.</div>}
              </li>
            ))}
          </ul>
          <p>Höhere Priorität gewinnt, danach der bessere Treffer. Bei Gleichstand gewinnt die zuerst aufgeführte Regel. Du kannst die Überschneidung durch andere Stichwörter oder „nicht bei:“ vermeiden.</p>
        </div>
      )}
      {ready && check.hasRegex && <div className="help" id="ruleCodeRegexHint">RegEx werden gegen die Beispielfragen mitgeprüft. Überschneidungen zwischen unterschiedlichen RegEx können unentdeckt bleiben – bei Bedarf mit eigenen Fragen testen.</div>}
      <div className="btns" style={{ gridTemplateColumns: '1fr' }}>
        <button type="button" className="btn pri" disabled={!ready} onClick={add}>{hasConflicts ? 'Trotz Konflikten hinzufügen' : result.rules.length === 1 ? 'Regel hinzufügen' : 'Regeln hinzufügen'}</button>
      </div>
    </>
  );
}
