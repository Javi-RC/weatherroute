import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from "recharts";
import type { RouteSegment } from "../../types";
import SegmentedControl from "../ui/SegmentedControl";

export type ProfileMetric = "temperature" | "precipitation" | "wind";

export interface RouteProfileChartProps {
  segments: RouteSegment[];
  onHoverSegment: (index: number | null) => void;
}

const METRICS: Record<ProfileMetric, { label: string; unit: string; color: string; field: MetricField }> = {
  temperature: { label: "Temperatura", unit: "°C", color: "var(--color-sun-500)", field: "temperature" },
  precipitation: { label: "Lluvia", unit: "%", color: "var(--color-ocean-500)", field: "precipitation" },
  wind: { label: "Viento", unit: "km/h", color: "var(--color-sand-600)", field: "wind" },
};

type MetricField = "temperature" | "precipitation" | "wind";

interface Point {
  index: number;
  distanceKm: number;
  temperature: number | null;
  precipitation: number | null;
  wind: number | null;
  arrivalLabel: string;
}

export function toProfilePoints(segments: RouteSegment[]): Point[] {
  let cumulative = 0;
  return segments.map((segment, index) => {
    cumulative += segment.distanceKm;
    const weather = segment.weather;
    return {
      index,
      distanceKm: Math.round(cumulative * 10) / 10,
      temperature: weather?.temperatureC ?? null,
      precipitation: weather?.precipitationProbability ?? null,
      wind: weather?.windKmh ?? null,
      arrivalLabel: segment.arrivalTimeUtc
        ? new Date(segment.arrivalTimeUtc).toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : "—",
    };
  });
}

interface DotProps {
  index?: number;
  cx?: number;
  cy?: number;
  r?: number | string;
  fill?: string;
  stroke?: string;
  strokeWidth?: string | number;
  onHoverSegment: (index: number | null) => void;
}

function ProfileDot({ index = 0, cx, cy, r = 3, fill, stroke, strokeWidth, onHoverSegment }: DotProps) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      onMouseEnter={() => onHoverSegment(index)}
      onMouseLeave={() => onHoverSegment(null)}
    />
  );
}

export default function RouteProfileChart({ segments, onHoverSegment }: RouteProfileChartProps) {
  const [metric, setMetric] = useState<ProfileMetric>("temperature");
  const points = useMemo(() => toProfilePoints(segments), [segments]);
  const hasWeather = points.some((point) => point.temperature !== null);

  if (!hasWeather) {
    return <p className="text-sm text-sand-600">Sin previsión meteorológica para esta ruta.</p>;
  }

  const config = METRICS[metric];
  const summary =
    `Perfil meteorológico de la ruta. Eje horizontal: distancia acumulada en kilómetros. ` +
    `Métrica activa: ${config.label} en ${config.unit}. ${points.length} tramos.`;

  const renderDot = (dot: DotItemDotProps) => <ProfileDot {...dot} onHoverSegment={onHoverSegment} />;

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        ariaLabel="Métrica del perfil"
        value={metric}
        onChange={(value) => setMetric(value as ProfileMetric)}
        options={[
          { value: "temperature", label: "Temperatura" },
          { value: "precipitation", label: "Lluvia" },
          { value: "wind", label: "Viento" },
        ]}
      />
      <div role="img" aria-label={summary} className="h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--color-sand-200)" vertical={false} />
            <XAxis dataKey="distanceKm" tick={{ fontSize: 11 }} unit=" km" />
            <YAxis tick={{ fontSize: 11 }} width={44} unit={config.unit} />
            <Tooltip
              formatter={(_value, _name, entry) => [
                String((entry.payload as Point)[config.field]),
                config.label,
              ]}
              labelFormatter={(_label, payload) => {
                const point = payload?.[0]?.payload as Point | undefined;
                return point ? `${point.arrivalLabel} · ${point.distanceKm} km` : "";
              }}
            />
            {metric === "precipitation" ? (
              <Bar dataKey="precipitation" fill="var(--color-ocean-500)" radius={[3, 3, 0, 0]} />
            ) : (
              <Line
                type="monotone"
                dataKey={metric}
                stroke={config.color}
                strokeWidth={2}
                dot={renderDot}
                activeDot={{ r: 6 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
