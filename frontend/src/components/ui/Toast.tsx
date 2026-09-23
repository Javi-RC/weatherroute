import { useEffect } from "react";
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimes, FaTimesCircle } from "react-icons/fa";
import type { IconType } from "react-icons";

export type ToastKind = "error" | "warning" | "info" | "success";

export const TOAST_AUTO_DISMISS_MS = 5000;

export interface ToastData {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ToastProps extends ToastData {
  onDismiss: (id: number) => void;
}

interface KindStyle {
  borderClass: string;
  icon: IconType;
  iconClass: string;
}

const KIND_STYLES: Record<ToastKind, KindStyle> = {
  error: { borderClass: "border-danger", icon: FaTimesCircle, iconClass: "text-danger" },
  warning: { borderClass: "border-warning", icon: FaExclamationTriangle, iconClass: "text-warning" },
  info: { borderClass: "border-info", icon: FaInfoCircle, iconClass: "text-info" },
  success: { borderClass: "border-success", icon: FaCheckCircle, iconClass: "text-success" },
};

export default function Toast({ id, kind, message, onDismiss }: ToastProps) {
  const { borderClass, icon: Icon, iconClass } = KIND_STYLES[kind];
  const role = kind === "error" ? "alert" : "status";

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), TOAST_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div
      role={role}
      className={[
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border-l-4 bg-white p-3 shadow-raise md:w-80",
        borderClass,
      ].join(" ")}
    >
      <Icon aria-hidden className={["mt-0.5 size-5 shrink-0", iconClass].join(" ")} />
      <p className="min-w-0 flex-1 text-sm leading-snug text-sand-800">{message}</p>
      <button
        type="button"
        aria-label="Cerrar notificación"
        onClick={() => onDismiss(id)}
        className="shrink-0 rounded-md p-1.5 text-sand-400 motion-safe:transition-colors motion-safe:hover:bg-sand-100 motion-safe:hover:text-sand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600 focus-visible:ring-offset-1"
      >
        <FaTimes aria-hidden className="size-4" />
      </button>
    </div>
  );
}