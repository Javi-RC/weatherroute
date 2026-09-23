import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { FaChevronDown, FaLocationArrow } from "react-icons/fa";
import Button from "../ui/Button";
import Field from "../ui/Field";
import TextInput from "../ui/TextInput";

export interface PlaceFieldErrors {
  origin?: string;
  destination?: string;
}

export interface OriginDestinationFieldsProps {
  origin: string;
  destination: string;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
}

export interface OriginDestinationFieldsHandle {
  validate: () => PlaceFieldErrors | null;
}

export const ORIGIN_REQUIRED = "Origen requerido";
export const DESTINATION_REQUIRED = "Destino requerido";

export function validatePlace(field: "origin" | "destination", value: string): string | undefined {
  if (value.trim() !== "") return undefined;
  return field === "origin" ? ORIGIN_REQUIRED : DESTINATION_REQUIRED;
}

function hasErrors(errors: PlaceFieldErrors): boolean {
  return errors.origin !== undefined || errors.destination !== undefined;
}

const OriginDestinationFields = forwardRef<
  OriginDestinationFieldsHandle,
  OriginDestinationFieldsProps
>(function OriginDestinationFields(
  { origin, destination, onOriginChange, onDestinationChange },
  ref,
) {
  const [errors, setErrors] = useState<PlaceFieldErrors>({});

  const latest = useRef({ origin, destination });
  latest.current = { origin, destination };

  function recompute(
    fields: Partial<Record<"origin" | "destination", string>>,
  ): PlaceFieldErrors {
    const next = { ...errors };
    if (fields.origin !== undefined) {
      next.origin = validatePlace("origin", fields.origin);
    }
    if (fields.destination !== undefined) {
      next.destination = validatePlace("destination", fields.destination);
    }
    setErrors(next);
    return next;
  }

  useImperativeHandle(ref, () => ({
    validate(): PlaceFieldErrors | null {
      const next = recompute(latest.current);
      return hasErrors(next) ? next : null;
    },
  }));

  function handleBlur(field: "origin" | "destination") {
    recompute({ [field]: latest.current[field] });
  }

  function handleChange(field: "origin" | "destination", value: string) {
    if (field === "origin") {
      onOriginChange(value);
    } else {
      onDestinationChange(value);
    }
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" size="sm" disabled className="self-start">
        <FaLocationArrow aria-hidden />
        Usar mi ubicación
      </Button>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <Field label="Desde" error={errors.origin} required>
            <TextInput
              value={origin}
              placeholder="Ciudad de salida"
              onChange={(event) => handleChange("origin", event.target.value)}
              onBlur={() => handleBlur("origin")}
              className="pr-8"
            />
          </Field>
          <FaChevronDown
            aria-hidden
            data-testid="origin-autocomplete-hint"
            className="pointer-events-none absolute right-2.5 top-[2.75rem] text-xs text-sand-400"
          />
        </div>
        <div className="relative">
          <Field label="Hasta" error={errors.destination} required>
            <TextInput
              value={destination}
              placeholder="Ciudad de llegada"
              onChange={(event) => handleChange("destination", event.target.value)}
              onBlur={() => handleBlur("destination")}
              className="pr-8"
            />
          </Field>
          <FaChevronDown
            aria-hidden
            data-testid="destination-autocomplete-hint"
            className="pointer-events-none absolute right-2.5 top-[2.75rem] text-xs text-sand-400"
          />
        </div>
      </div>
    </div>
  );
});

export default OriginDestinationFields;