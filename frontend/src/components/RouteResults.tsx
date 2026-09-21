import type { RouteAnalysisResponse } from "../types";
import ComparisonTable from "./ComparisonTable";
import RiskBreakdown from "./RiskBreakdown";
import RouteMap from "./RouteMap";
import WeatherTimeline from "./WeatherTimeline";

export default function RouteResults({ result }: { result: RouteAnalysisResponse }) {
  if (result.routes.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
        No se pudieron calcular rutas.
        {result.routeAvailable === false && " No se pudo obtener una ruta para los datos indicados."}
        {result.weatherAvailable === false && " El proveedor meteorológico no está disponible."}
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-4">
      <RouteMap routes={result.routes} />
      {result.recommendation && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 font-medium">
          {result.recommendation}
        </div>
      )}
      {result.routes.length > 1 && <ComparisonTable routes={result.routes} />}
      {result.routes.map((route, i) => (
        <article key={route.providerId} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">Ruta #{i + 1}</h2>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${riskColor(route.riskLevel)}`}>
              {route.riskLevel} · {route.riskScore}/100
            </span>
          </div>
          <p className="text-slate-600">
            {route.distanceKm.toFixed(1)} km · {Math.floor(route.durationMinutes / 60)}h {route.durationMinutes % 60}m
          </p>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2">Tramo</th>
                <th>Llegada</th>
                <th>T</th>
                <th>Viento</th>
                <th>Lluvia</th>
                <th>Condición</th>
              </tr>
            </thead>
            <tbody>
              {route.segments.map((seg, j) => (
                <tr key={j} className="border-b border-slate-100">
                  <td className="py-2">{seg.distanceKm.toFixed(1)} km</td>
                  <td>{seg.arrivalTimeUtc ? new Date(seg.arrivalTimeUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td>{seg.weather?.temperatureC != null ? `${Math.round(seg.weather.temperatureC)}°C` : "—"}</td>
                  <td>{seg.weather?.windKmh != null ? `${Math.round(seg.weather.windKmh)} km/h` : "—"}</td>
                  <td>{seg.weather?.precipitationProbability != null ? `${seg.weather.precipitationProbability}%` : "—"}</td>
                  <td>{seg.weather?.condition ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <RiskBreakdown score={route.riskScore} level={route.riskLevel} factors={route.factors} />
          <WeatherTimeline route={route} />
        </article>
      ))}
    </section>
  );
}

function riskColor(level: string): string {
  switch (level) {
    case "Low": return "bg-emerald-100 text-emerald-800";
    case "Moderate": return "bg-amber-100 text-amber-800";
    case "High": return "bg-orange-100 text-orange-800";
    default: return "bg-red-100 text-red-800";
  }
}