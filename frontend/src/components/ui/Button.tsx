import { FaSpinner } from "react-icons/fa";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-ocean-600 text-white hover:bg-ocean-700 active:bg-ocean-800",
  secondary:
    "border border-sand-300 bg-white text-sand-800 hover:bg-sand-100 active:bg-sand-200",
  ghost: "text-ocean-700 hover:bg-ocean-50 hover:text-ocean-800 active:bg-ocean-100",
  danger: "bg-danger text-white hover:bg-red-700 active:bg-red-800",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 py-1.5 text-sm",
  md: "min-h-11 px-4 py-2 text-sm",
  lg: "min-h-11 px-5 py-2.5 text-base",
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600 focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50";

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel = "Cargando…",
  type,
  className,
  children,
  disabled,
  "aria-label": ariaLabel,
  ...rest
}: ButtonProps) {
  const actionLabel = typeof children === "string" ? children : undefined;

  return (
    <button
      {...rest}
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={ariaLabel ?? (loading ? actionLabel : undefined)}
      className={[BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className]
        .filter(Boolean)
        .join(" ")}
    >
      {loading && <FaSpinner aria-hidden className="animate-spin" />}
      {loading ? loadingLabel : children}
    </button>
  );
}