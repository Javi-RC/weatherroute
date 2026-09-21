import type { RouteCandidate } from "../types";

export default function ComparisonTable({ routes }: { routes: RouteCandidate[] }) {
  const rain = (r: RouteCandidate) =>
    Math.max(...r.segments.map((s) => s.weather?.precipitationProbability ?? 0), 0);
  const wind = (r: RouteCandidate) =>
    Math.max(...r.segments.map((s) => s.weather?.windKmh ?? 0), 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-slate-600">
          <tr>
            <th className="p-3">#</th>
            <th>Distancia</th>
            <th>Duración</th>
            <th>Lluvia máx.</th>
            <th>Viento máx.</th>
            <th>Riesgo</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r, i) => (
            <tr key={r.providerId} className="border-b border-slate-100">
              <td className="p-3 font-semibold">{i + 1}</td>
              <td>{r.distanceKm.toFixed(1)} km</td>
              <td>{Math.floor(r.durationMinutes / 60)}h {r.durationMinutes % 60}m</td>
              <td>{rain(r).toFixed(0)}%</td>
              <td>{wind(r).toFixed(0)} km/h</td>
              <td>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskBadge(r.riskLevel)}`}>
                  {r.riskLevel} · {r.riskScore}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function riskBadge(level: string): string {
  switch (level) {
    case "Low": return "bg-emerald-100 text-emerald-800";
    case "Moderate": return "bg-amber-100 text-amber-800";
    case "High": return "bg-orange-100 text-orange-800";
    default: return "bg-red-100 text-red-800";
  }
}
