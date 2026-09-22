import { Children, cloneElement, useId, useState, type ReactElement } from "react";

export interface TooltipProps {
  label: string;
  children: ReactElement;
  className?: string;
}

function callBoth(original: unknown, next: () => void) {
  return (...args: unknown[]) => {
    if (typeof original === "function") (original as (...a: unknown[]) => void)(...args);
    next();
  };
}

export default function Tooltip({ label, children, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  const element = Children.only(children) as ReactElement<Record<string, unknown>>;
  const trigger = cloneElement(element, {
    "aria-describedby": open ? tipId : undefined,
    onMouseEnter: callBoth(element.props.onMouseEnter, () => setOpen(true)),
    onMouseLeave: callBoth(element.props.onMouseLeave, () => setOpen(false)),
    onFocus: callBoth(element.props.onFocus, () => setOpen(true)),
    onBlur: callBoth(element.props.onBlur, () => setOpen(false)),
  });

  return (
    <span className={["relative inline-flex", className].filter(Boolean).join(" ")}>
      {trigger}
      <span
        id={tipId}
        role="tooltip"
        aria-hidden={!open}
        className={[
          "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-sand-900 px-2 py-1 text-xs font-medium text-white shadow-raise transition-opacity",
          open ? "visible opacity-100" : "invisible opacity-0",
        ].join(" ")}
      >
        {label}
      </span>
    </span>
  );
}