import type { AnalyzeRequest, RouteAnalysisResponse } from "../types";

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