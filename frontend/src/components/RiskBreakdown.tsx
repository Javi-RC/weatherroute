import type { RiskFactor } from "../types";

interface Props {
  score: number;
  level: string;
  factors: RiskFactor[];
}

export default function RiskBreakdown({ score, level, factors }: Props) {
  return (
    <div className="mt-4 rounded-lg bg-slate-50 p-4">
      <p className="text-2xl font-bold">
        {score} <span className="text-base font-normal text-slate-500">/ 100 · {level}</span>
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {factors.length === 0 && <li className="text-slate-500">Sin factores de riesgo destacados.</li>}
        {factors.map((f) => (
          <li key={f.type} className="flex items-center justify-between">
            <span>{f.message}</span>
            <span className="font-mono text-slate-600">+{f.contribution}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
