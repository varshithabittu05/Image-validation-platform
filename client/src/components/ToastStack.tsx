import type { Toast } from "../hooks/useToasts";
import { CheckCircleIcon, CloseIcon, ErrorCircleIcon } from "./icons";

interface ToastStackProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.variant}`}>
          <span className="toast__icon">{toast.variant === "success" ? <CheckCircleIcon /> : <ErrorCircleIcon />}</span>
          <span className="toast__message">{toast.message}</span>
          <button type="button" className="toast__close" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
}
