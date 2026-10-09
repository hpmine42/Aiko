import { useRef } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';

export interface DialogOptions {
  title: string;
  text?: string;
  ok?: string;
  cancel?: string;
  danger?: boolean;
}

interface DialogProps {
  options: DialogOptions | null;
  onResult: (result: boolean) => void;
}

export function Dialog({ options, onResult }: DialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocus<HTMLDivElement>(Boolean(options), {
    onEscape: () => onResult(false),
    initialFocusRef: confirmRef,
  });

  return (
    <div
      className={`dlg${options ? ' on' : ''}`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onResult(false); }}
      aria-hidden={!options}
    >
      {options && (
        <div ref={dialogRef} className="dbox" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}>
          <h3 id="dialog-title">{options.title}</h3>
          <p>{options.text || ''}</p>
          <div className="dbtns">
            <button type="button" onClick={() => onResult(false)}>{options.cancel || 'Abbrechen'}</button>
            <button
              ref={confirmRef}
              type="button"
              className={options.danger ? 'danger' : 'pri'}
              onClick={() => onResult(true)}
            >
              {options.ok || 'OK'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
