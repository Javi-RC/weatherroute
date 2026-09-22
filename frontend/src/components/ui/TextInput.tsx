import { forwardRef, type InputHTMLAttributes } from "react";

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

const BASE_CLASSES =
  "w-full rounded-md border px-3 py-2 text-sand-900 placeholder:text-sand-400 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600 focus-visible:ring-offset-2";

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, invalid, ...props },
  ref,
) {
  const isInvalid =
    invalid || props["aria-invalid"] === true || props["aria-invalid"] === "true";

  return (
    <input
      {...props}
      ref={ref}
      className={[
        BASE_CLASSES,
        isInvalid ? "border-red-500 bg-red-50" : "border-sand-300 bg-white",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
});

export default TextInput;