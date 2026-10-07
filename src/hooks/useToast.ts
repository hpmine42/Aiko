import { useCallback, useRef, useState } from 'react';

export interface ToastState {
  message: string;
  action?: string;
  onAction?: () => void;
  visible: boolean;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({ message: '', visible: false });
  const timer = useRef<number | null>(null);

  const hide = useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
    setToast((current) => ({ ...current, visible: false }));
  }, []);

  const show = useCallback((message: string, action?: string, onAction?: () => void) => {
    if (timer.current != null) window.clearTimeout(timer.current);
    setToast({ message, action, onAction, visible: true });
    timer.current = window.setTimeout(() => {
      setToast((current) => ({ ...current, visible: false }));
      timer.current = null;
    }, action ? 5_000 : 2_200);
  }, []);

  const runAction = useCallback(() => {
    const callback = toast.onAction;
    hide();
    callback?.();
  }, [hide, toast.onAction]);

  return { toast, show, hide, runAction };
}
