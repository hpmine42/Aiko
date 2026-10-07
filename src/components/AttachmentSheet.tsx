import { Icon } from './Icon';

interface AttachmentSheetProps {
  open: boolean;
  onClose: () => void;
  toast: (message: string) => void;
}

export function AttachmentSheet({ open, onClose, toast }: AttachmentSheetProps) {
  const unavailable = () => {
    onClose();
    window.setTimeout(() => toast('Uploads sind gerade nicht verfügbar'), 250);
  };
  return (
    <>
      <button type="button" className={`scrim${open ? ' on' : ''}`} style={{ zIndex: 61 }} aria-label="Anhänge schließen" onClick={onClose} />
      <div className={`asheet${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="grab" />
        <div className="tiles">
          <button type="button" className="tile" onClick={unavailable}><Icon name="camera" />Kamera</button>
          <button type="button" className="tile" onClick={unavailable}><Icon name="image" />Fotos</button>
          <button type="button" className="tile" onClick={unavailable}><Icon name="file" />Dateien</button>
        </div>
      </div>
    </>
  );
}
