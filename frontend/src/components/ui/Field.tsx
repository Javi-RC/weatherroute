import { Children, cloneElement, useId, type ReactElement } from "react";

export interface FieldProps {
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  children: ReactElement;
  className?: string;
}

export default function Field({
  label,
  help,
  error,
  required,
  children,
  className,
}: FieldProps) {
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();

  const describedBy =
    [error ? errorId : null, help && !error ? helpId : null].filter(Boolean).join(" ") ||
    undefined;

  const input = cloneElement(Children.only(children) as ReactElement<Record<string, unknown>>, {
    id: inputId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  });

  return (
    <div className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>
      <label htmlFor={inputId} className="text-sm font-medium text-sand-800">
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>
      {input}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : help ? (
        <p id={helpId} className="text-xs text-sand-500">
          {help}
        </p>
      ) : null}
    </div>
  );
}