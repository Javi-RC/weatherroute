import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { resolvePlace } from "../../lib/places";
import { presetDeparture } from "../../lib/time";
import type { GeoPoint } from "../../lib/map";
import type { ActivityType, PlaceCandidate } from "../../types";
import Button from "../ui/Button";
import ActivityPicker, { ACTIVITY_OPTIONS } from "./ActivityPicker";
import OriginDestinationFields, {
  DESTINATION_REQUIRED,
  ORIGIN_REQUIRED,
  type OriginDestinationFieldsHandle,
} from "./OriginDestinationFields";
import TimeOptions from "./TimeOptions";

export interface PlannerSearch {
  origin: string;
  destination: string;
  originPoint: GeoPoint;
  destinationPoint: GeoPoint;
  activity: ActivityType;
  departureTime: string;
  maxDurationMinutes: number | null;
}

export interface PlannerFormProps {
  onSearch: (search: PlannerSearch) => void;
  onLocationError?: () => void;
  busy?: boolean;
}

const ACTIVITY_REQUIRED = "Actividad requerida";
const DEPARTURE_REQUIRED = "Salida requerida";
const DURATION_RANGE_ERROR = "Entre 1 y 1440 minutos";
const PLACE_UNRESOLVED_ERROR =
  "No encontramos ese lugar. Prueba otra ciudad o un nombre más concreto.";

const ACTIVITY_VALUES = ACTIVITY_OPTIONS.map((option) => option.value) as [
  ActivityType,
  ...ActivityType[],
];

const plannerSchema = z.object({
  origin: z.string().trim().min(1, ORIGIN_REQUIRED),
  destination: z.string().trim().min(1, DESTINATION_REQUIRED),
  activity: z.enum(ACTIVITY_VALUES, { errorMap: () => ({ message: ACTIVITY_REQUIRED }) }),
  departure: z.string().min(1, DEPARTURE_REQUIRED),
  maxDurationMinutes: z
    .number()
    .int(DURATION_RANGE_ERROR)
    .min(1, DURATION_RANGE_ERROR)
    .max(1440, DURATION_RANGE_ERROR)
    .optional(),
});

const VALIDATION_FIELDS = [
  "origin",
  "destination",
  "activity",
  "departure",
  "maxDurationMinutes",
] as const;

type ValidationField = (typeof VALIDATION_FIELDS)[number];
type ValidationErrors = Partial<Record<ValidationField, string>>;

function collectValidationErrors(error: z.ZodError): ValidationErrors {
  const errors: ValidationErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && (VALIDATION_FIELDS as readonly string[]).includes(key)) {
      const field = key as ValidationField;
      errors[field] ??= issue.message;
    }
  }
  return errors;
}

export default function PlannerForm({ onSearch, onLocationError, busy = false }: PlannerFormProps) {
  const fieldsRef = useRef<OriginDestinationFieldsHandle>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originResolved, setOriginResolved] = useState<PlaceCandidate | null>(null);
  const [destinationResolved, setDestinationResolved] = useState<PlaceCandidate | null>(null);
  const [activity, setActivity] = useState<ActivityType>("Cycling");
  const [departure, setDeparture] = useState(() => presetDeparture("now"));
  const [durationMax, setDurationMax] = useState<number | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [pending, setPending] = useState(false);

  function handleOriginChange(value: string) {
    setOrigin(value);
    setErrors((prev) => ({ ...prev, origin: undefined }));
    setOriginResolved((prev) => (prev && prev.label === value ? prev : null));
  }

  function handleDestinationChange(value: string) {
    setDestination(value);
    setErrors((prev) => ({ ...prev, destination: undefined }));
    setDestinationResolved((prev) => (prev && prev.label === value ? prev : null));
  }

  function handleActivityChange(value: ActivityType) {
    setActivity(value);
    setErrors((prev) => ({ ...prev, activity: undefined }));
  }

  function handleDepartureChange(iso: string) {
    setDeparture(iso);
    setErrors((prev) => ({ ...prev, departure: undefined }));
  }

  function handleDurationMaxChange(minutes: number | null) {
    setDurationMax(minutes);
    setErrors((prev) => ({ ...prev, maxDurationMinutes: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || busy) return;

    setErrors({});

    const parsed = plannerSchema.safeParse({
      origin,
      destination,
      activity,
      departure,
      maxDurationMinutes: durationMax ?? undefined,
    });

    if (!parsed.success) {
      const validationErrors = collectValidationErrors(parsed.error);
      if (validationErrors.origin !== undefined || validationErrors.destination !== undefined) {
        fieldsRef.current?.validate();
      }
      setErrors({
        activity: validationErrors.activity,
        departure: validationErrors.departure,
        maxDurationMinutes: validationErrors.maxDurationMinutes,
      });
      return;
    }

    setPending(true);
    try {
      const [originResult, destinationResult] = await Promise.allSettled([
        originResolved && originResolved.label === origin
          ? Promise.resolve(originResolved)
          : resolvePlace(origin),
        destinationResolved && destinationResolved.label === destination
          ? Promise.resolve(destinationResolved)
          : resolvePlace(destination),
      ]);
      const resolvedOrigin = originResult.status === "fulfilled" ? originResult.value : null;
      const resolvedDestination =
        destinationResult.status === "fulfilled" ? destinationResult.value : null;

      if (resolvedOrigin === null || resolvedDestination === null) {
        setErrors({
          origin: resolvedOrigin === null ? PLACE_UNRESOLVED_ERROR : undefined,
          destination: resolvedDestination === null ? PLACE_UNRESOLVED_ERROR : undefined,
        });
        return;
      }

      onSearch({
        origin: resolvedOrigin.label,
        destination: resolvedDestination.label,
        originPoint: { latitude: resolvedOrigin.lat, longitude: resolvedOrigin.lon },
        destinationPoint: { latitude: resolvedDestination.lat, longitude: resolvedDestination.lon },
        activity,
        departureTime: departure,
        maxDurationMinutes: durationMax,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <OriginDestinationFields
        ref={fieldsRef}
        origin={origin}
        destination={destination}
        onOriginChange={handleOriginChange}
        onDestinationChange={handleDestinationChange}
        onOriginResolved={setOriginResolved}
        onDestinationResolved={setDestinationResolved}
        onLocationError={onLocationError}
      />
      {(errors.origin !== undefined || errors.destination !== undefined) && (
        <div className="flex flex-col gap-1">
          {errors.origin !== undefined && (
            <p data-testid="origin-error" role="alert" className="text-sm text-danger">
              {errors.origin}
            </p>
          )}
          {errors.destination !== undefined && (
            <p data-testid="destination-error" role="alert" className="text-sm text-danger">
              {errors.destination}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-sand-800">Actividad</span>
        <ActivityPicker value={activity} onChange={handleActivityChange} />
        {errors.activity !== undefined && (
          <p role="alert" className="text-sm text-danger">
            {errors.activity}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-sand-800">Momento de salida</span>
        <TimeOptions
          departure={departure}
          onDepartureChange={handleDepartureChange}
          durationMax={durationMax}
          onDurationMaxChange={handleDurationMaxChange}
        />
        {errors.departure !== undefined && (
          <p role="alert" className="text-sm text-danger">
            {errors.departure}
          </p>
        )}
        {errors.maxDurationMinutes !== undefined && (
          <p role="alert" className="text-sm text-danger">
            {errors.maxDurationMinutes}
          </p>
        )}
      </div>
      <Button type="submit" loading={pending || busy} disabled={pending || busy} className="w-full">
        Buscar ruta
      </Button>
    </form>
  );
}
