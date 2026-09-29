import { useCallback, useRef, useState } from "react";

export interface Toast {
  id: string;
  variant: "success" | "error";
  message: string;
}

const AUTO_DISMISS_MS = 5000;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant: Toast["variant"], message: string) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, variant, message }]);
      timers.current.set(id, setTimeout(() => dismiss(id), AUTO_DISMISS_MS));
    },
    [dismiss]
  );

  return { toasts, push, dismiss };
}
