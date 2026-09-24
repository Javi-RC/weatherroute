import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { FaTimes } from "react-icons/fa";
import IconButton from "./IconButton";

export type SheetPosition = "bottom" | "side";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  position?: SheetPosition;
  role?: string;
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Sheet({
  open,
  onClose,
  title,
  children,
  position = "bottom",
  role = "dialog",
  className,
}: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const id = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(id);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  const isBottom = position === "bottom";

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="fixed inset-0 z-50" onKeyDown={handleKeyDown}>
      <div
        data-testid="sheet-backdrop"
        aria-hidden="true"
        onClick={handleBackdropClick}
        className={[
          "absolute inset-0 bg-sand-950/50 motion-safe:transition-opacity motion-safe:duration-300",
          visible ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={[
          "absolute flex flex-col bg-white shadow-raise outline-none",
          isBottom
            ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl sm:mx-auto sm:w-full sm:max-w-md"
            : "inset-y-0 right-0 h-full w-full max-w-md",
          "motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out",
          isBottom
            ? visible
              ? "translate-y-0"
              : "translate-y-full"
            : visible
              ? "translate-x-0"
              : "translate-x-full",
          className,
        ].filter(Boolean).join(" ")}
      >
        {title ? (
          <div className="flex items-center justify-between gap-4 px-6 pb-2 pt-5">
            <h2 id={titleId} className="text-lg font-bold text-sand-900">
              {title}
            </h2>
            <IconButton label="Cerrar" onClick={onClose}>
              <FaTimes />
            </IconButton>
          </div>
        ) : (
          <div className="flex justify-end px-4 pt-3">
            <IconButton label="Cerrar" onClick={onClose}>
              <FaTimes />
            </IconButton>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-3">{children}</div>
      </div>
    </div>
  );
}