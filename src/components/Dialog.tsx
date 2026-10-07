import { useEffect } from 'react';

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
  useEffect(() => {
    if (!options) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onResult(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onResult, options]);

  return (
    <div
      className={`dlg${options ? ' on' : ''}`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onResult(false); }}
      aria-hidden={!options}
    >
      {options && (
        <div className="dbox" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
          <h3 id="dialog-title">{options.title}</h3>
          <p>{options.text || ''}</p>
          <div className="dbtns">
            <button type="button" onClick={() => onResult(false)}>{options.cancel || 'Abbrechen'}</button>
            <button
              type="button"
              className={options.danger ? 'danger' : 'pri'}
              onClick={() => onResult(true)}
              autoFocus
            >
              {options.ok || 'OK'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
