import Card from "./Card";

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      data-testid="skeleton-bar"
      className={["h-3 animate-pulse rounded bg-sand-200", className].filter(Boolean).join(" ")}
    />
  );
}

export default function LoadingState({
  label = "Cargando…",
  className,
}: LoadingStateProps) {
  return (
    <div role="status" className={["flex flex-col gap-4", className].filter(Boolean).join(" ")}>
      <span className="sr-only">{label}</span>
      <Card aria-hidden>
        <SkeletonBar className="mb-4 h-4 w-1/3" />
        <div className="mb-3 grid grid-cols-3 gap-3">
          <SkeletonBar />
          <SkeletonBar />
          <SkeletonBar />
        </div>
        <SkeletonBar className="mb-3 w-full" />
        <SkeletonBar className="mb-4 w-2/3" />
        <SkeletonBar className="mb-1 h-9 w-32 rounded-md" />
      </Card>
    </div>
  );
}