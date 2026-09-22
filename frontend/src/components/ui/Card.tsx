import type { HTMLAttributes } from "react";

export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
}

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

const BASE_CLASSES = "rounded-lg bg-white shadow-card";

export default function Card({
  padding = "md",
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      className={[BASE_CLASSES, PADDING_CLASSES[padding], className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}