import { useRef, type ChangeEvent } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';
import { Icon } from './Icon';

interface AttachmentSheetProps {
  open: boolean;
  onClose: () => void;
  onFiles: (files: File[]) => void;
}

export function AttachmentSheet({ open, onClose, onFiles }: AttachmentSheetProps) {
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocus<HTMLDivElement>(open, { onEscape: onClose, initialFocusRef: firstButtonRef });
  const cameraRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const chooseFiles = (input: HTMLInputElement | null) => {
    onClose();
    input?.click();
  };
  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = '';
    if (files.length) onFiles(files);
    onClose();
  };

  return (
    <>
      <button type="button" className={`scrim${open ? ' on' : ''}`} style={{ zIndex: 61 }} aria-label="Anhänge schließen" aria-hidden={!open} tabIndex={-1} onClick={onClose} />
      <div
        ref={dialogRef}
        className={`asheet${open ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="attachment-title"
        aria-hidden={!open}
        inert={!open ? true : undefined}
        tabIndex={-1}
      >
        <div className="grab" />
        <h2 id="attachment-title" className="asheet-title">Dateien anhängen</h2>
        <div className="tiles">
          <button ref={firstButtonRef} type="button" className="tile" onClick={() => chooseFiles(cameraRef.current)}><Icon name="camera" />Kamera</button>
          <button type="button" className="tile" onClick={() => chooseFiles(photosRef.current)}><Icon name="image" />Fotos</button>
          <button type="button" className="tile" onClick={() => chooseFiles(filesRef.current)}><Icon name="file" />Dateien</button>
        </div>
        <p className="asheet-note">Dateien bleiben auf diesem Gerät. Aiko kann ihre Inhalte derzeit nicht auslesen.</p>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFiles} />
      <input ref={photosRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
      <input ref={filesRef} type="file" multiple hidden onChange={handleFiles} />
    </>
  );
}
