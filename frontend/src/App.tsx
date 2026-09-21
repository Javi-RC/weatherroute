import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import RouteForm, { type RouteFormValues } from "./components/RouteForm";
import RouteResults from "./components/RouteResults";
import { analyzeRoute } from "./services/api";
import type { AnalyzeRequest, RouteAnalysisResponse } from "./types";

export default function App() {
  const [result, setResult] = useState<RouteAnalysisResponse | null>(null);
  const [last, setLast] = useState<AnalyzeRequest | null>(null);

  const mutation = useMutation({
    mutationFn: analyzeRoute,
    onSuccess: setResult,
  });

  function toRequest(values: RouteFormValues): AnalyzeRequest {
    return {
      ...values,
      departureTime: new Date(values.date + "T" + values.time).toISOString(),
    };
  }

  function handleSubmit(values: RouteFormValues) {
    const request = toRequest(values);
    setLast(request);
    setResult(null);
    mutation.mutate(request);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">WeatherRoute</h1>
      <RouteForm onSubmit={handleSubmit} loading={mutation.isPending} />
      {mutation.isPending && (
        <div className="mt-6 grid gap-4 md:grid-cols-2" role="status" aria-label="cargando">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}
      {mutation.isError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-red-700">No se pudo calcular la ruta. Revisa tu conexión e inténtalo de nuevo.</p>
          {last && (
            <button
              type="button"
              onClick={() => mutation.mutate(last)}
              className="mt-2 rounded-md bg-red-700 px-3 py-1.5 text-sm font-semibold text-white"
            >
              Reintentar
            </button>
          )}
        </div>
      )}
      {result && <RouteResults result={result} />}
    </main>
  );
}