import { FaSpinner } from "react-icons/fa";

export interface RefreshingIndicatorProps {
  visible: boolean;
}

export default function RefreshingIndicator({ visible }: RefreshingIndicatorProps) {
  if (!visible) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      data-testid="refreshing-indicator"
      className="inline-flex items-center gap-2 text-xs font-medium text-sand-600"
    >
      <FaSpinner aria-hidden className="h-3.5 w-3.5 animate-spin" />
      Actualizando…
    </p>
  );
}