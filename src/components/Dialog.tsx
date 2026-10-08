import { useEffect, useRef } from 'react';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!options) {
      previousFocus.current?.focus();
      previousFocus.current = null;
      return undefined;
    }
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('button:last-of-type')?.focus();
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onResult(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKey);
    };
  }, [onResult, options]);

  return (
    <div
      className={`dlg${options ? ' on' : ''}`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onResult(false); }}
      aria-hidden={!options}
    >
      {options && (
        <div ref={dialogRef} className="dbox" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
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
