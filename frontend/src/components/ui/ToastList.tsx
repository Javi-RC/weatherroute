import type { ToastData } from "./Toast";
import Toast from "./Toast";

export interface ToastListProps {
  toasts: ToastData[];
  onDismiss: (id: number) => void;
}

const STACK_CLASSES =
  "pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-3 px-4 " +
  "md:inset-x-auto md:bottom-6 md:right-6 md:top-auto md:items-end md:px-0";

export default function ToastList({ toasts, onDismiss }: ToastListProps) {
  if (toasts.length === 0) return null;

  return (
    <div aria-live="polite" className={STACK_CLASSES}>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}