import type { ToastState } from '../hooks/useToast';

interface ToastProps {
  toast: ToastState;
  onAction: () => void;
}

export function Toast({ toast, onAction }: ToastProps) {
  return (
    <div id="toast" className={toast.visible ? 'on' : ''} role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.action && <button type="button" onClick={onAction}>{toast.action}</button>}
    </div>
  );
}
