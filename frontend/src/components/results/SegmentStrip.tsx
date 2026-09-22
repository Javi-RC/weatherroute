import { FaCloudRain, FaWind } from "react-icons/fa";
import {
  formatClockTime,
  formatPercent,
  formatTemperature,
  formatVisibility,
  formatWind,
} from "../../lib/format";
import { conditionMeta } from "../../i18n/conditions";
import type { ExternalWeather, RouteSegment } from "../../types";
import Tooltip from "../ui/Tooltip";

interface SegmentStripProps {
  segments: RouteSegment[];
  className?: string;
}

function fullDetail(weather: ExternalWeather | null): string {
  if (!weather) return "Sin datos meteorológicos";
  const parts: string[] = [];
  if (weather.windKmh != null) parts.push(`Viento ${formatWind(weather.windKmh)}`);
  if (weather.uvIndex != null) parts.push(`UV ${weather.uvIndex}`);
  if (weather.visibilityKm != null) parts.push(`Visibilidad ${formatVisibility(weather.visibilityKm)}`);
  if (weather.precipitationProbability != null) {
    parts.push(`Lluvia ${formatPercent(weather.precipitationProbability)}`);
  }
  parts.push(`Condición: ${conditionMeta(weather.condition).label}`);
  return parts.join(" · ");
}

export default function SegmentStrip({ segments, className }: SegmentStripProps) {
  return (
    <ul
      className={[
        "flex flex-col gap-2 md:flex-row md:items-stretch md:gap-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {segments.map((segment, i) => {
        const weather = segment.weather;
        const condition = conditionMeta(weather?.condition ?? "Unknown");
        const ConditionIcon = condition.icon;
        const time = segment.arrivalTimeUtc
          ? formatClockTime(segment.arrivalTimeUtc)
          : `T${i + 1}`;
        const detail = fullDetail(weather);
        return (
          <li
            key={`${segment.fromIndex}-${segment.toIndex}-${i}`}
            className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg bg-sand-50 px-3 py-2.5"
          >
            <span className="text-[11px] font-medium uppercase tracking-wide text-sand-400">
              Llegada
            </span>
            <span className="font-mono text-base font-bold leading-none text-sand-900">
              {time}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-sand-700">
              <ConditionIcon aria-hidden className="shrink-0" style={{ color: condition.color }} />
              {condition.label}
            </span>
            {weather?.temperatureC != null && (
              <span className="text-sm text-sand-700">
                {formatTemperature(weather.temperatureC)}
              </span>
            )}
            <div className="mt-auto flex items-center gap-3 pt-1">
              {weather ? (
                <Tooltip label={detail}>
                  <span
                    tabIndex={0}
                    aria-label={detail}
                    className="flex items-center gap-2.5 rounded text-xs text-sand-600 focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-1"
                  >
                    {weather.precipitationProbability != null && (
                      <span className="flex items-center gap-1">
                        <FaCloudRain aria-hidden className="text-cyan-600" />
                        {formatPercent(weather.precipitationProbability)}
                      </span>
                    )}
                    {weather.windKmh != null && (
                      <span className="flex items-center gap-1">
                        <FaWind aria-hidden className="text-sand-500" />
                        {formatWind(weather.windKmh)}
                      </span>
                    )}
                  </span>
                </Tooltip>
              ) : (
                <span className="text-xs text-sand-500">{detail}</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}