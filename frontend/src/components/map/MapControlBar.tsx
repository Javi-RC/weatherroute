import MapLegend from "./MapLegend";

export interface MapControlBarProps {
  compact: boolean;
}

export default function MapControlBar({ compact }: MapControlBarProps) {
  return (
    <div
      className={[
        "pointer-events-auto absolute bottom-4 z-20 flex items-center gap-2",
        compact ? "left-1/2 -translate-x-1/2" : "left-4",
      ].join(" ")}
    >
      <MapLegend />
    </div>
  );
}
