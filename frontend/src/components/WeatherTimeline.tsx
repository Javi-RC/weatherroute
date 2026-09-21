import { Area, AreaChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RouteCandidate } from "../types";

export default function WeatherTimeline({ route }: { route: RouteCandidate }) {
  const data = route.segments.map((s, i) => ({
    index: `T${i + 1}`,
    hour: s.arrivalTimeUtc
      ? new Date(s.arrivalTimeUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : `T${i + 1}`,
    temp: s.weather?.temperatureC ?? null,
    rain: s.weather?.precipitationProbability ?? null,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
          <YAxis hide />
          <Legend />
          <Tooltip />
          <Area type="monotone" name="Temp °C" dataKey="temp" stroke="#2563eb" fill="#dbeafe" />
          <Area type="monotone" name="Lluvia %" dataKey="rain" stroke="#0d9488" fill="#ccfbf1" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
