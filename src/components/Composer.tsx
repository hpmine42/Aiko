import { useEffect, useRef, useState } from 'react';
import { CMD_LIST } from '../data/commands';
import { formatFileSize } from '../utils/files';
import { Icon } from './Icon';

interface ComposerProps {
  busy: boolean;
  showToBottom: boolean;
  attachments: File[];
  speechRecognition: boolean;
  onSend: (text: string, attachments: File[]) => void;
  onRemoveAttachment: (index: number) => void;
  onStop: () => void;
  onAttachment: () => void;
  onRequestSpeechConsent: () => Promise<void>;
  onScrollBottom: () => void;
  toast: (message: string) => void;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function PendingAttachment({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!/^image\/(?:png|jpe?g|gif|webp|avif|bmp|heic|heif)$/i.test(file.type) || typeof URL.createObjectURL !== 'function') return undefined;
    try {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch {
      return undefined;
    }
  }, [file]);

  if (previewUrl) {
    return (
      <div className="attachment-card attachment-card-image">
        <img src={previewUrl} alt={`Vorschau für ${file.name}`} draggable={false} />
        <button type="button" className="attachment-remove" aria-label={`${file.name} entfernen`} onClick={onRemove}><Icon name="close" /></button>
      </div>
    );
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const isTextFile = file.type.startsWith('text/') || ['json', 'md', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'xml', 'csv'].includes(extension);
  return (
    <div className="attachment-card attachment-card-file">
      <span className="attachment-file-icon"><Icon name={isTextFile ? 'code' : 'file'} /></span>
      <span className="attachment-file-meta" title={file.name}>
        <span>{file.name}</span>
        <small>Datei · {formatFileSize(file.size)}</small>
      </span>
      <button type="button" className="attachment-remove" aria-label={`${file.name} entfernen`} onClick={onRemove}><Icon name="close" /></button>
    </div>
  );
}

export function Composer({
  busy,
  showToBottom,
  attachments,
  speechRecognition,
  onSend,
  onRemoveAttachment,
  onStop,
  onAttachment,
  onRequestSpeechConsent,
  onScrollBottom,
  toast,
}: ComposerProps) {
  const [value, setValue] = useState('');
  const [recording, setRecording] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandIndex, setCommandIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const previousAttachments = useRef(attachments);

  const commands = value.trim().startsWith('/')
    ? CMD_LIST.filter(([command]) => {
      const query = value.trim().slice(1).toLocaleLowerCase('de-DE');
      return query.length < 2 || command.toLocaleLowerCase('de-DE').includes(query);
    })
    : [];

  useEffect(() => {
    setCommandIndex((index) => commands.length ? Math.min(index, commands.length - 1) : 0);
  }, [commands.length, value]);

  const chooseCommand = (index: number) => {
    const command = commands[index];
    if (!command) return;
    setValue(command[0].replace(/…$/, ''));
    setCommandOpen(false);
    textareaRef.current?.focus();
  };

  const resize = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(200, textarea.scrollHeight)}px`;
  };
  useEffect(resize, [value]);
  useEffect(() => {
    const changed = previousAttachments.current.length !== attachments.length;
    previousAttachments.current = attachments;
    if (!changed || attachments.length === 0) return undefined;
    const frame = window.requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [attachments]);
  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch { /* permission may already be gone */ }
  }, []);

  const submit = () => {
    const text = value.trim();
    if ((!text && !attachments.length) || busy) return;
    setValue('');
    setCommandOpen(false);
    onSend(text, attachments);
  };

  const dictate = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) { toast('Diktieren wird hier nicht unterstützt'); return; }
    if (!speechRecognition) {
      await onRequestSpeechConsent();
      return;
    }
    try {
      const recognition = new Constructor();
      const base = value ? value.replace(/\s*$/, ' ') : '';
      recognition.lang = 'de-DE';
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let transcript = '';
        for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
        setValue(base + transcript);
      };
      const reset = () => { setRecording(false); recognitionRef.current = null; };
      recognition.onend = reset;
      recognition.onerror = reset;
      recognitionRef.current = recognition;
      setRecording(true);
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setRecording(false);
      toast('Diktieren konnte nicht gestartet werden');
    }
  };

  const mode = busy ? 'stop' : value.trim() || attachments.length ? 'send' : 'voice';
  return (
    <footer id="bottom">
      <button
        type="button"
        id="toBottom"
        className={showToBottom ? 'on' : ''}
        aria-label="Nach unten scrollen"
        onClick={onScrollBottom}
      ><Icon name="arrowD" /></button>
      <div className="cwrap">
        <div id="cmdpop" className={commandOpen && commands.length ? 'on' : ''}>
          {commands.map(([command, description], index) => (
            <button
              type="button"
              className={`ci${index === commandIndex ? ' selected' : ''}`}
              key={command}
              aria-selected={index === commandIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseCommand(index)}
            >
              <b>{command}</b><span>{description}</span>
            </button>
          ))}
        </div>
        <div id="composer" onClick={(event) => {
          if (event.target === event.currentTarget || (event.target as HTMLElement).classList.contains('crow')) textareaRef.current?.focus();
        }}>
          {attachments.length > 0 && (
            <div className="attachment-list" aria-label="Dateien zum Anhängen">
              {attachments.map((file, index) => (
                <PendingAttachment
                  file={file}
                  key={`${file.name}-${file.lastModified}-${index}`}
                  onRemove={() => onRemoveAttachment(index)}
                />
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            id="in"
            rows={1}
            placeholder="Frag mich alles"
            autoComplete="off"
            enterKeyHint="send"
            value={value}
            onFocus={() => setCommandOpen(value.trim().startsWith('/'))}
            onBlur={() => window.setTimeout(() => setCommandOpen(false), 180)}
            onChange={(event) => {
              setValue(event.target.value);
              setCommandOpen(event.target.value.trim().startsWith('/'));
            }}
            onKeyDown={(event) => {
              if (commandOpen && commands.length) {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setCommandIndex((index) => (index + 1) % commands.length);
                  return;
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setCommandIndex((index) => (index - 1 + commands.length) % commands.length);
                  return;
                }
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  chooseCommand(commandIndex);
                  return;
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setCommandOpen(false);
                  return;
                }
              }
              const fine = window.matchMedia?.('(pointer:fine)').matches;
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && fine) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <div className="crow">
            <button type="button" className="cbtn" id="bPlus" aria-label="Anhängen" onClick={onAttachment}><Icon name="plus" /></button>
            <div className="spacer" />
            <button type="button" className={`cbtn${recording ? ' rec' : ''}`} id="bMic" aria-label={recording ? 'Diktieren stoppen' : 'Diktieren'} aria-pressed={recording} onClick={() => { void dictate(); }}><Icon name="mic" /></button>
            <button
              type="button"
              className="cbtn send"
              id="bSend"
              aria-label={mode === 'stop' ? 'Antwort stoppen' : mode === 'send' ? 'Senden' : 'Sprachmodus'}
              onClick={() => {
                if (busy) onStop();
                else if (value.trim() || attachments.length) submit();
                else toast('Der Sprachmodus ist gerade nicht verfügbar');
              }}
            >
              <Icon name={mode === 'stop' ? 'stop' : mode === 'send' ? 'up' : 'wave'} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
