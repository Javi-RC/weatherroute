import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import ToastList from "../components/ui/ToastList";
import type { ToastData, ToastKind } from "../components/ui/Toast";

export interface ToastAPI {
  addToast: (kind: ToastKind, message: string) => void;
}

const MAX_STACK_SIZE = 5;

const ToastContext = createContext<ToastAPI | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((kind: ToastKind, message: string) => {
    counterRef.current += 1;
    const id = counterRef.current;
    setToasts((current) => {
      if (current.some((toast) => toast.kind === kind && toast.message === message)) {
        return current;
      }
      const next = [...current, { id, kind, message }];
      return next.length > MAX_STACK_SIZE ? next.slice(next.length - MAX_STACK_SIZE) : next;
    });
  }, []);

  const api: ToastAPI = { addToast };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastList toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToasts(): ToastAPI {
  const api = useContext(ToastContext);
  if (api === null) {
    throw new Error("useToasts debe utilizarse dentro de un <ToastProvider>.");
  }
  return api;
}