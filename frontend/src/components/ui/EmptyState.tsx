import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { FaRoute } from "react-icons/fa";

export interface EmptyStateProps {
  icon?: IconType;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon = FaRoute,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={["flex flex-col items-center gap-3 px-6 py-10 text-center", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-ocean-50">
        <Icon aria-hidden className="size-8 text-ocean-700" />
      </div>
      <h2 className="text-lg font-bold text-sand-900">{title}</h2>
      <p className="max-w-sm text-sm leading-relaxed text-sand-600">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}