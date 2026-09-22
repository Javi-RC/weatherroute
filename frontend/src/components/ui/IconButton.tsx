import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

const BASE_CLASSES =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-sand-700 transition-colors " +
  "hover:bg-sand-200 hover:text-sand-900 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600 focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50";

export default function IconButton({
  label,
  type,
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type ?? "button"}
      aria-label={label}
      className={[BASE_CLASSES, className].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}