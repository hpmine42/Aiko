import { memo, useRef, useState, type MouseEvent } from 'react';
import type { AikoConfig, AssistantMessage, ChatMessage } from '../types';
import { md, plain, withName } from '../engine/aikoEngine';
import { copyText, plainCopy, shareText } from '../utils/browser';
import { formatFileSize } from '../utils/files';
import { Icon } from './Icon';
import { MessageWidget } from './MessageWidget';
import { Popover } from './Popover';

interface MessageProps {
  message: ChatMessage;
  index: number;
  config: AikoConfig;
  modelId: string;
  generating: boolean;
  thinking: boolean;
  onConfig: (config: AikoConfig) => void;
  onEdit: (index: number, text: string) => void;
  onRegenerate: (index: number) => void;
  onVariant: (index: number, variant: number) => void;
  onFeedback: (index: number, feedback: 'up' | 'down' | null) => void;
  onSuggestion: (text: string) => void;
  toast: (message: string) => void;
}

export const Message = memo(function Message({ message, ...props }: MessageProps) {
  if (message.role === 'user') return <UserMessage message={message} {...props} />;
  return <AssistantMessageView message={message} {...props} />;
});

type SharedProps = Omit<MessageProps, 'message'>;

function UserMessage({ message, index, onEdit, toast, generating }: { message: Extract<ChatMessage, { role: 'user' }> } & SharedProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(message.content);
  if (editing) {
    return (
      <div className="msg user" data-i={index}>
        <div className="editbox">
          <textarea
            rows={1}
            value={value}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            style={{ height: 'auto' }}
          />
          <div className="ebtn">
            <button type="button" className="eb2" onClick={() => { setValue(message.content); setEditing(false); }}>Abbrechen</button>
            <button type="button" className="eb1" onClick={() => {
              const next = value.trim();
              if (!next && !message.attachments?.length) return;
              setEditing(false);
              onEdit(index, next);
            }}>Senden</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="msg user" data-i={index}>
      {message.content && <div className="ubub">{message.content}</div>}
      {message.attachments && message.attachments.length > 0 && (
        <div className="uattachments" aria-label="Angehängte Dateien">
          {message.attachments.map((attachment, attachmentIndex) => (
            <div className="uattachment" key={`${attachment.name}-${attachment.lastModified}-${attachmentIndex}`}>
              <Icon name="file" />
              <span className="uattachment-name">{attachment.name}<small className="uattachment-size">{formatFileSize(attachment.size)}</small></span>
            </div>
          ))}
        </div>
      )}
      <div className="uacts">
        <button type="button" className="ab" aria-label="Kopieren" onClick={async () => { toast(await copyText(message.content) ? 'Kopiert' : 'Kopieren fehlgeschlagen'); }}><Icon name="copy" /></button>
        <button type="button" className="ab ux" aria-label="Teilen" onClick={async () => {
          const result = await shareText(message.content);
          if (result === 'shared') toast('Nachricht geteilt');
          else if (result === 'copied') toast('Text kopiert');
          else if (result === 'cancelled') toast('Teilen abgebrochen');
          else toast('Teilen und Kopieren fehlgeschlagen');
        }}><Icon name="share" /></button>
        <button type="button" className="ab ux" aria-label="Nachricht bearbeiten" disabled={generating} onClick={() => setEditing(true)}><Icon name="edit" /></button>
      </div>
    </div>
  );
}

function AssistantMessageView({
  message,
  index,
  config,
  modelId,
  generating,
  thinking,
  onConfig,
  onRegenerate,
  onVariant,
  onFeedback,
  onSuggestion,
  toast,
}: { message: AssistantMessage } & SharedProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const feedbackRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [speaking, setSpeaking] = useState(false);
  const raw = message.variants[message.vi] || '';
  const rendered = withName(raw);
  const meta = message.meta?.[message.vi] || { rule: null, cap: '', source: '', val: null };
  const rule = meta.rule ? config.pairs.find((entry) => entry.id === meta.rule) : undefined;
  const suggestions = !generating && rule ? (rule.suggest || []).slice(0, 4) : [];
  const thought = message.thoughts?.[message.vi];

  const onMarkdownClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('.cbcopy');
    if (!button) return;
    const code = button.closest('.cb')?.querySelector('code')?.textContent || '';
    void copyText(code).then((copied) => {
      button.innerHTML = copied
        ? `${iconMarkup('check')}<span>Kopiert</span>`
        : `${iconMarkup('copy')}<span>Fehlgeschlagen</span>`;
      window.setTimeout(() => {
        if (button.isConnected) button.innerHTML = `${iconMarkup('copy')}<span>Kopieren</span>`;
      }, 1_600);
    });
  };

  const speak = () => {
    if (!('speechSynthesis' in window)) { toast('Vorlesen wird hier nicht unterstützt'); return; }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(plain(rendered));
    utterance.lang = 'de-DE';
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  if (generating && !raw) {
    return (
      <div className="msg ai" data-i={index}>
        {thinking ? <div className="thinking" role="status" aria-live="polite">Denkt nach</div> : <div className="pulse" role="status" aria-label="Antwort wird erstellt" />}
      </div>
    );
  }

  return (
    <div className="msg ai" data-i={index}>
      {thought ? <div className="thought">Nachgedacht für {thought} s</div> : null}
      <div className="md" onClick={onMarkdownClick} dangerouslySetInnerHTML={{ __html: md(rendered) }} />
      {generating && <span className="cur" />}
      {!generating && <MessageWidget widget={meta.widget} config={config} onConfig={onConfig} toast={toast} />}
      {suggestions.length > 0 && (
        <div className="sugg">{suggestions.map((suggestion) => (
          <button type="button" key={suggestion} onClick={() => onSuggestion(suggestion)}>{suggestion}</button>
        ))}</div>
      )}
      {!generating && (
        <div className="acts">
          {message.variants.length > 1 && (
            <div className="pager">
              <button type="button" aria-label="Vorherige Antwort" disabled={message.vi === 0} onClick={() => onVariant(index, message.vi - 1)}><Icon name="chevL" /></button>
              <span>{message.vi + 1}/{message.variants.length}</span>
              <button type="button" aria-label="Nächste Antwort" disabled={message.vi === message.variants.length - 1} onClick={() => onVariant(index, message.vi + 1)}><Icon name="chevR" /></button>
            </div>
          )}
          <button type="button" className="ab" aria-label="Kopieren" onClick={async () => { toast(await copyText(plainCopy(rendered)) ? 'Kopiert' : 'Kopieren fehlgeschlagen'); }}><Icon name="copy" /></button>
          <button
            ref={feedbackRef}
            type="button"
            className={`ab${message.fb ? ' on' : ''}`}
            aria-label="Feedback geben"
            onClick={() => setFeedbackOpen((value) => !value)}
          >
            <Icon name={message.fb === 'up' ? 'thumbU' : message.fb === 'down' ? 'thumbD' : 'thumbs'} />
          </button>
          <button type="button" className="ab" aria-label="Teilen" onClick={async () => {
            const result = await shareText(plainCopy(rendered));
            if (result === 'shared') toast('Antwort geteilt');
            else if (result === 'copied') toast('Text kopiert');
            else if (result === 'cancelled') toast('Teilen abgebrochen');
            else toast('Teilen und Kopieren fehlgeschlagen');
          }}><Icon name="share" /></button>
          <button type="button" className="ab" aria-label="Neu generieren" onClick={() => onRegenerate(index)}><Icon name="regen" /></button>
          <button ref={moreRef} type="button" className="ab" aria-label="Weitere Aktionen" onClick={() => setMoreOpen((value) => !value)}><Icon name="dots" /></button>
        </div>
      )}

      <Popover open={feedbackOpen} anchor={feedbackRef} onClose={() => setFeedbackOpen(false)}>
        <button type="button" className="pi" onClick={() => {
          const value = message.fb === 'up' ? null : 'up';
          onFeedback(index, value);
          setFeedbackOpen(false);
          if (value) toast('Danke für dein Feedback!');
        }}>
          <Icon name="thumbU" /><span className="tx">Gute Antwort</span>{message.fb === 'up' && <span className="ck"><Icon name="check" /></span>}
        </button>
        <button type="button" className="pi" onClick={() => {
          const value = message.fb === 'down' ? null : 'down';
          onFeedback(index, value);
          setFeedbackOpen(false);
          if (value) toast('Danke für dein Feedback!');
        }}>
          <Icon name="thumbD" /><span className="tx">Schlechte Antwort</span>{message.fb === 'down' && <span className="ck"><Icon name="check" /></span>}
        </button>
      </Popover>

      <Popover open={moreOpen} anchor={moreRef} onClose={() => setMoreOpen(false)}>
        <button type="button" className="pi" onClick={() => { speak(); setMoreOpen(false); }}>
          <Icon name={speaking ? 'stop' : 'speaker'} /><span className="tx">{speaking ? 'Vorlesen stoppen' : 'Vorlesen'}</span>
        </button>
        <button type="button" className="pi" onClick={async () => { toast(await copyText(plainCopy(rendered)) ? 'Kopiert' : 'Kopieren fehlgeschlagen'); setMoreOpen(false); }}>
          <Icon name="copy" /><span className="tx">Als Text kopieren</span>
        </button>
        <button type="button" className="pi" onClick={() => { onRegenerate(index); setMoreOpen(false); }}>
          <Icon name="regen" /><span className="tx">Mit {config.models.find((model) => model.id === modelId)?.label || 'Standard'}-Modus neu generieren</span>
        </button>
      </Popover>
    </div>
  );
}

function iconMarkup(name: 'copy' | 'check'): string {
  const paths = name === 'check'
    ? '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
    : '<rect x="3.3" y="8.3" width="12.2" height="12.2" rx="3.2"/><path d="M8.3 8.3V6.5a3.2 3.2 0 0 1 3.2-3.2h6a3.2 3.2 0 0 1 3.2 3.2v6a3.2 3.2 0 0 1-3.2 3.2h-2"/>';
  return `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
}
