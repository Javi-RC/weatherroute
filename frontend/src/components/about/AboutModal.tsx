import { useEffect, useRef } from "react";
import { FaCloudSun, FaLeaf, FaRoute } from "react-icons/fa";
import { type FactorType, FACTOR_META, weightLabel } from "../../i18n/factors";
import { CONDITIONS_NOTE } from "../../i18n/risk";
import Badge from "../ui/Badge";
import Sheet from "../ui/Sheet";

export type AboutSection = "score";

export interface AboutModalProps {
  open: boolean;
  onClose: () => void;
  focusSection?: AboutSection | null;
}

const FACTOR_TYPES = Object.keys(FACTOR_META) as FactorType[];
const WEIGHT_SCALE = [40, 15, 0].map(weightLabel);

export default function AboutModal({ open, onClose, focusSection }: AboutModalProps) {
  const scoreSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open || focusSection !== "score") return;
    scoreSectionRef.current?.focus();
  }, [open, focusSection]);

  return (
    <Sheet open={open} onClose={onClose} title="Cómo funciona" position="side">
      <div className="space-y-6 pb-4">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-sand-700">Qué es WeatherRoute</h3>
          <p className="text-sm leading-relaxed text-sand-600">
            WeatherRoute es un planificador de rutas que tiene en cuenta el tiempo. Indica el
            origen, el destino, la actividad y la hora de salida, y compara rutas según la
            previsión meteorológica a lo largo del recorrido.
          </p>
        </section>

        <section
          id="about-score"
          ref={scoreSectionRef}
          tabIndex={-1}
          className="scroll-mt-4 space-y-2 rounded-lg outline-none focus:ring-2 focus:ring-ocean-500"
        >
          <h3 className="text-sm font-semibold text-sand-700">Índice de condiciones</h3>
          <p className="text-sm text-sand-600">Cada ruta recibe un índice de 0 a 100.</p>
          <p className="text-sm font-medium text-sand-800">{CONDITIONS_NOTE}.</p>
          <p className="text-sm text-sand-600">El índice combina estos factores:</p>
          <ul className="space-y-1.5">
            {FACTOR_TYPES.map((type) => {
              const meta = FACTOR_META[type];
              const Icon = meta.icon;
              return (
                <li
                  key={type}
                  className="flex items-center gap-2 rounded-lg bg-sand-50 px-3 py-2"
                >
                  <Icon aria-hidden className="shrink-0 text-sand-500" />
                  <span className="text-sm font-medium text-sand-800">{meta.label}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-sand-600">
            Cada factor influye con un peso: {WEIGHT_SCALE.join(", ")}.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-sand-700">Fuentes gratuitas</h3>
          <p className="text-sm text-sand-600">
            Todo funciona con datos abiertos y gratuitos:
          </p>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-2 rounded-lg bg-sand-50 px-3 py-2">
              <FaLeaf aria-hidden className="shrink-0 text-sand-500" />
              <span className="text-sm font-medium text-sand-800">
                Mapas: OpenStreetMap y OpenFreeMap
              </span>
            </li>
            <li className="flex items-center gap-2 rounded-lg bg-sand-50 px-3 py-2">
              <FaCloudSun aria-hidden className="shrink-0 text-sand-500" />
              <span className="text-sm font-medium text-sand-800">
                Previsión meteorológica: Open-Meteo
              </span>
            </li>
            <li className="flex items-center gap-2 rounded-lg bg-sand-50 px-3 py-2">
              <FaRoute aria-hidden className="shrink-0 text-sand-500" />
              <span className="text-sm font-medium text-sand-800">
                Rutas: perfil gratuito de OpenRouteService
              </span>
            </li>
          </ul>
        </section>

        <p>
          <Badge tone="success">Sin registro, sin pagos</Badge>
        </p>

        <p className="text-xs text-sand-500">Previsión disponible hasta 7 días.</p>
      </div>
    </Sheet>
  );
}