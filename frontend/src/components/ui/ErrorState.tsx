import type { IconType } from "react-icons";
import { FaExclamationTriangle } from "react-icons/fa";
import Button from "./Button";
import Card from "./Card";

export interface ErrorStateProps {
  title?: string;
  message: string;
  hint?: string;
  onRetry: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
  icon?: IconType;
  className?: string;
}

export default function ErrorState({
  title = "Algo salió mal",
  message,
  hint,
  onRetry,
  retryLabel = "Reintentar",
  onDismiss,
  dismissLabel = "Mantener búsqueda",
  icon: Icon = FaExclamationTriangle,
  className,
}: ErrorStateProps) {
  return (
    <Card
      padding="lg"
      role="alert"
      className={["flex flex-col items-center gap-3 text-center", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-danger/10">
        <Icon aria-hidden className="size-8 text-danger" />
      </div>
      <h2 className="text-lg font-bold text-sand-900">{title}</h2>
      <p className="max-w-sm text-sm leading-relaxed text-sand-600">{message}</p>
      {hint && <p className="text-sm text-sand-500">{hint}</p>}
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button onClick={onRetry}>{retryLabel}</Button>
        {onDismiss && (
          <Button variant="ghost" onClick={onDismiss}>
            {dismissLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}