import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import RouteForm, { type RouteFormValues } from "./components/RouteForm";
import RouteResults from "./components/RouteResults";
import { analyzeRoute } from "./services/api";
import type { RouteAnalysisResponse } from "./types";

export default function App() {
  const [result, setResult] = useState<RouteAnalysisResponse | null>(null);

  const mutation = useMutation({
    mutationFn: analyzeRoute,
    onSuccess: setResult,
  });

  function handleSubmit(values: RouteFormValues) {
    mutation.reset();
    setResult(null);
    mutation.mutate({
      ...values,
      departureTime: new Date(values.date + "T" + values.time).toISOString(),
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">WeatherRoute</h1>
      <RouteForm onSubmit={handleSubmit} loading={mutation.isPending} />
      {mutation.isError && (
        <p className="mt-4 text-red-600" role="alert">
          No se pudo calcular la ruta. Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
      {result && <RouteResults result={result} />}
    </main>
  );
}