import { FaHistory, FaInfoCircle, FaRoute } from "react-icons/fa";
import Badge from "./ui/Badge";
import Button from "./ui/Button";

export interface HeaderProps {
  onOpenAbout?: () => void;
  onOpenHistory?: () => void;
}

export const CLAIM_TEXT = "Meteo en tu ruta, gratis, en cualquier lugar del mundo";

export default function Header({ onOpenAbout, onOpenHistory }: HeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-10 border-b border-sand-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2" data-testid="brand">
          <FaRoute aria-hidden className="size-6 text-ocean-600" />
          <h1 className="text-lg font-bold tracking-tight text-sand-900">WeatherRoute</h1>
          <Badge tone="success">Gratis · Sin registro</Badge>
        </div>
        <p className="hidden truncate text-sm text-sand-600 md:block">{CLAIM_TEXT}</p>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onOpenAbout}>
            <FaInfoCircle aria-hidden />
            Cómo funciona
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenHistory}>
            <FaHistory aria-hidden />
            Historial
          </Button>
        </div>
      </div>
    </header>
  );
}