export type ActivityType = "Walking" | "Running" | "Cycling" | "Motorcycle" | "Driving";

export type RiskLevel = "Low" | "Moderate" | "High" | "Severe";

export interface AnalyzeRequest {
  origin: string;
  destination: string;
  activity: ActivityType;
  departureTime: string;
  maxDurationMinutes?: number | null;
}

export interface RiskFactor {
  type: string;
  level: string;
  contribution: number;
  message: string;
}

export interface ExternalWeather {
  temperatureC: number | null;
  windKmh: number | null;
  precipitationProbability: number | null;
  uvIndex: number | null;
  visibilityKm: number | null;
  condition: string;
}

export interface RouteSegment {
  fromIndex: number;
  toIndex: number;
  distanceKm: number;
  arrivalTimeUtc: string | null;
  weather: ExternalWeather | null;
}

export interface RouteCandidate {
  providerId: string;
  distanceKm: number;
  durationMinutes: number;
  riskLevel: RiskLevel;
  riskScore: number;
  factors: RiskFactor[];
  segments: RouteSegment[];
  polyline: { latitude: number; longitude: number }[];
}

export interface RouteAnalysisResponse {
  status: "full" | "partial";
  weatherAvailable: boolean;
  routeAvailable: boolean;
  recommendation: string | null;
  routes: RouteCandidate[];
}

export interface GeocodeResult {
  lat: number;
  lon: number;
}

export interface PlaceCandidate {
  label: string;
  lat: number;
  lon: number;
}