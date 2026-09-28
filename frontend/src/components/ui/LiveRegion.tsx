export interface LiveRegionProps {
  message: string | null;
}

export default function LiveRegion({ message }: LiveRegionProps) {
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}