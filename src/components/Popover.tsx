import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

interface PopoverProps {
  open: boolean;
  anchor: RefObject<HTMLElement | null>;
  align?: 'left' | 'right';
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Popover({ open, anchor, align = 'left', onClose, children, className = '' }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });

  useLayoutEffect(() => {
    if (!open || !anchor.current || !ref.current) return;
    const rect = anchor.current.getBoundingClientRect();
    const width = ref.current.offsetWidth;
    const height = ref.current.offsetHeight;
    let left = align === 'right' ? rect.right - width : rect.left;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 6);
    setPosition({ left, top });
  }, [align, anchor, children, open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !anchor.current?.contains(target)) onClose();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', escape);
    };
  }, [anchor, onClose, open]);

  return (
    <div
      ref={ref}
      className={`pop${open ? ' on' : ''}${className ? ` ${className}` : ''}`}
      style={{ left: position.left, top: position.top }}
      role="menu"
    >
      {open ? children : null}
    </div>
  );
}
