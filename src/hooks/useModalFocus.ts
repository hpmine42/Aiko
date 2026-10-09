import { useEffect, useRef, type RefObject } from 'react';

interface ModalFocusOptions {
  onEscape?: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const modalStack: symbol[] = [];
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => (
    !element.hidden
    && !element.closest('[hidden], .hidden, [inert], [aria-hidden="true"]')
  ));
}

/** Adds focus containment, Escape handling, and focus restoration to an open modal. */
export function useModalFocus<T extends HTMLElement>(
  open: boolean,
  { onEscape, initialFocusRef }: ModalFocusOptions = {},
): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const container = containerRef.current;
    if (!open || !container) return undefined;

    const token = Symbol('modal');
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalStack.push(token);

    const frame = window.requestAnimationFrame(() => {
      const initial = initialFocusRef?.current;
      const first = focusableElements(container)[0];
      const target = initial && container.contains(initial) ? initial : first;
      (target || container).focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== token) return;
      if (event.key === 'Escape') {
        if (onEscapeRef.current) {
          event.preventDefault();
          onEscapeRef.current();
        }
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = focusableElements(container);
      if (!focusable.length) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!container.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      const index = modalStack.lastIndexOf(token);
      if (index >= 0) modalStack.splice(index, 1);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [initialFocusRef, open]);

  return containerRef;
}
