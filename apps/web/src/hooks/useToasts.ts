import { useCallback, useRef, useState } from "react";

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  readonly id: number;
  readonly tone: ToastTone;
  readonly title: string;
  readonly detail?: string;
}

export function useToasts() {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, detail?: string) => {
      const id = nextId.current++;
      const toast: Toast = detail === undefined ? { id, tone, title } : { id, tone, title, detail };
      setToasts((current) => [...current, toast]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  return { toasts, push, dismiss };
}
