import { useState, type ReactNode } from 'react';

export function InfoBox({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`info${open ? ' open' : ''}`}>
      <button type="button" className="info-h" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="info-i">i</span>{title}<span className="info-c">▾</span>
      </button>
      <div className="info-b">{children}</div>
    </div>
  );
}
