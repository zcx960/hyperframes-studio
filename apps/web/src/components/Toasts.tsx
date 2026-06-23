import type { Toast } from "../hooks/useToasts";

export function Toasts(props: {
  readonly toasts: readonly Toast[];
  readonly onDismiss: (id: number) => void;
}) {
  if (props.toasts.length === 0) {
    return null;
  }

  return (
    <div className="toasts" aria-live="polite">
      {props.toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`toast ${toast.tone}`}
          onClick={() => props.onDismiss(toast.id)}
        >
          <span className="toast-mark" aria-hidden="true" />
          <span className="toast-body">
            <strong>{toast.title}</strong>
            {toast.detail ? <span>{toast.detail}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
