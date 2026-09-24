import type {
  AnalyzeRequest,
  GeocodeResult,
  PlaceCandidate,
  RouteAnalysisResponse,
} from "../types";

export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

export async function analyzeRoute(request: AnalyzeRequest): Promise<RouteAnalysisResponse> {
  const response = await fetch("/api/routes/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  return (await response.json()) as RouteAnalysisResponse;
}

export async function geocodePlace(q: string): Promise<GeocodeResult | null> {
  let response: Response;
  try {
    response = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  } catch {
    throw new ApiError("geocode_failed", "No encontramos ese lugar");
  }
  if (!response.ok) {
    throw new ApiError("geocode_failed", "No encontramos ese lugar");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("geocode_failed", "No encontramos ese lugar");
  }

  if (!isRecord(payload) || payload.coordinates == null) return null;

  const coordinates = payload.coordinates;
  if (!isRecord(coordinates)) {
    throw new ApiError("geocode_failed", "No encontramos ese lugar");
  }
  const { lat, lon } = coordinates;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) {
    throw new ApiError("geocode_failed", "No encontramos ese lugar");
  }
  return { lat, lon };
}

const MIN_SEARCH_LENGTH = 2;

export async function searchPlaces(query: string): Promise<PlaceCandidate[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_SEARCH_LENGTH) return [];

  let response: Response;
  try {
    response = await fetch(`/api/geocode/search?q=${encodeURIComponent(trimmed)}`);
  } catch {
    throw new ApiError("search_failed", "No pudimos buscar ese lugar");
  }
  if (!response.ok) {
    throw new ApiError("search_failed", "No pudimos buscar ese lugar");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("search_failed", "No pudimos buscar ese lugar");
  }

  if (!isRecord(payload) || !Array.isArray(payload.candidates)) return [];

  const candidates: PlaceCandidate[] = [];
  for (const item of payload.candidates) {
    if (!isRecord(item)) continue;
    const { label, latitude, longitude } = item;
    if (typeof label === "string" && isFiniteNumber(latitude) && isFiniteNumber(longitude)) {
      candidates.push({ label, lat: latitude, lon: longitude });
    }
  }
  return candidates;
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
  } catch {
    throw new ApiError("reverse_geocode_failed", "No pudimos identificar ese lugar");
  }
  if (!response.ok) {
    throw new ApiError("reverse_geocode_failed", "No pudimos identificar ese lugar");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("reverse_geocode_failed", "No pudimos identificar ese lugar");
  }

  if (!isRecord(payload) || typeof payload.label !== "string") return null;
  return payload.label;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}