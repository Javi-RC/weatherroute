import { geocodePlace } from "../services/api";

export interface ResolvedPlace {
  label: string;
  lat: number;
  lon: number;
}

export async function resolvePlace(
  input: string,
): Promise<ResolvedPlace | null> {
  const label = input.trim();
  if (!label) return null;

  try {
    const result = await geocodePlace(label);
    if (!result) return null;
    return { label, lat: result.lat, lon: result.lon };
  } catch {
    return null;
  }
}