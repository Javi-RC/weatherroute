import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { FaLocationArrow } from "react-icons/fa";
import { reverseGeocode } from "../../services/api";
import type { GeoPoint } from "../../lib/map";
import type { PlaceCandidate } from "../../types";
import Button from "../ui/Button";
import Field from "../ui/Field";
import PlaceAutocomplete from "./PlaceAutocomplete";

export interface PlaceFieldErrors {
  origin?: string;
  destination?: string;
}

export interface ExternalEndpoint {
  label: string;
  point: GeoPoint;
}

export interface OriginDestinationFieldsProps {
  origin: string;
  destination: string;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onOriginResolved?: (candidate: PlaceCandidate) => void;
  onDestinationResolved?: (candidate: PlaceCandidate) => void;
  onLocationError?: () => void;
  originOverride?: ExternalEndpoint | null;
  destinationOverride?: ExternalEndpoint | null;
  onClearOverride?: (field: "origin" | "destination") => void;
}

export interface OriginDestinationFieldsHandle {
  validate: () => PlaceFieldErrors | null;
}

export const ORIGIN_REQUIRED = "Origen requerido";
export const DESTINATION_REQUIRED = "Destino requerido";
const FALLBACK_LOCATION_LABEL = "Mi ubicación";

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
  {
    origin,
    destination,
    onOriginChange,
    onDestinationChange,
    onOriginResolved,
    onDestinationResolved,
    onLocationError,
    originOverride = null,
    destinationOverride = null,
    onClearOverride,
  },
  ref,
) {
  const [errors, setErrors] = useState<PlaceFieldErrors>({});
  const [locating, setLocating] = useState(false);

  const latest = useRef({ origin, destination });
  latest.current = { origin, destination };

  function recompute(
    fields: Partial<Record<"origin" | "destination", string>>,
  ): PlaceFieldErrors {
    const next = { ...errors };
    if (fields.origin !== undefined) {
      next.origin = originOverride ? undefined : validatePlace("origin", fields.origin);
    }
    if (fields.destination !== undefined) {
      next.destination = destinationOverride
        ? undefined
        : validatePlace("destination", fields.destination);
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

  function handleSelect(field: "origin" | "destination", candidate: PlaceCandidate) {
    handleChange(field, candidate.label);
    (field === "origin" ? onOriginResolved : onDestinationResolved)?.(candidate);
  }

  function handleUseLocation() {
    if (!("geolocation" in navigator)) {
      onLocationError?.();
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        reverseGeocode(latitude, longitude)
          .catch(() => null)
          .then((label) => {
            const resolvedLabel = label ?? FALLBACK_LOCATION_LABEL;
            handleSelect("origin", { label: resolvedLabel, lat: latitude, lon: longitude });
          })
          .finally(() => setLocating(false));
      },
      () => {
        setLocating(false);
        onLocationError?.();
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={handleUseLocation}
        loading={locating}
        loadingLabel="Localizando…"
      >
        <FaLocationArrow aria-hidden />
        Usar mi ubicación
      </Button>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Desde" error={errors.origin} required>
          {originOverride && origin === "" ? (
            <PickedEndpoint
              label={originOverride.label}
              onClear={() => onClearOverride?.("origin")}
            />
          ) : (
            <PlaceAutocomplete
              value={origin}
              placeholder="Ciudad de salida"
              onChange={(value) => handleChange("origin", value)}
              onSelect={(candidate) => handleSelect("origin", candidate)}
              onBlur={() => handleBlur("origin")}
            />
          )}
        </Field>
        <Field label="Hasta" error={errors.destination} required>
          {destinationOverride && destination === "" ? (
            <PickedEndpoint
              label={destinationOverride.label}
              onClear={() => onClearOverride?.("destination")}
            />
          ) : (
            <PlaceAutocomplete
              value={destination}
              placeholder="Ciudad de llegada"
              onChange={(value) => handleChange("destination", value)}
              onSelect={(candidate) => handleSelect("destination", candidate)}
              onBlur={() => handleBlur("destination")}
            />
          )}
        </Field>
      </div>
    </div>
  );
});

function PickedEndpoint({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="flex h-11 items-center justify-between gap-2 rounded-md border border-ocean-200 bg-ocean-50 px-3">
      <span className="truncate text-sm font-medium text-sand-900">{label}</span>
      <Button variant="ghost" size="sm" className="shrink-0" onClick={onClear}>
        Cambiar
      </Button>
    </div>
  );
}

export default OriginDestinationFields;
