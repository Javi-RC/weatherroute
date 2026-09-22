import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-sand-100 text-sand-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-cyan-100 text-cyan-800",
};

const BASE_CLASSES =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold";

export default function Badge({ tone = "neutral", className, children, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={[BASE_CLASSES, TONE_CLASSES[tone], className].filter(Boolean).join(" ")}
    >
      {children}
    </span>
  );
}