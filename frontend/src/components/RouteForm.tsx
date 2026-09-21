import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

export const routeSchema = z.object({
  origin: z.string().min(1, "Origen requerido"),
  destination: z.string().min(1, "Destino requerido"),
  activity: z.enum(["Walking", "Running", "Cycling", "Motorcycle", "Driving"]),
  date: z.string().min(1, "Fecha requerida"),
  time: z.string().min(1, "Hora requerida"),
});

export type RouteFormValues = z.infer<typeof routeSchema>;

interface Props {
  onSubmit: (values: RouteFormValues) => void;
  loading: boolean;
}

export default function RouteForm({ onSubmit, loading }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<RouteFormValues>({
    resolver: zodResolver(routeSchema),
    defaultValues: { activity: "Cycling", date: "2026-09-27", time: "08:00" },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-3">
      <label className="block">
        <span className="text-sm font-medium">Desde</span>
        <input {...register("origin")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Ciudad Real" />
        {errors.origin && <span className="text-sm text-red-600">{errors.origin.message}</span>}
      </label>
      <label className="block">
        <span className="text-sm font-medium">Hasta</span>
        <input {...register("destination")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Almagro" />
        {errors.destination && <span className="text-sm text-red-600">{errors.destination.message}</span>}
      </label>
      <label className="block">
        <span className="text-sm font-medium">Actividad</span>
        <select {...register("activity")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
          <option value="Walking">Caminar</option>
          <option value="Running">Correr</option>
          <option value="Cycling">Bici</option>
          <option value="Motorcycle">Moto</option>
          <option value="Driving">Coche</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Fecha</span>
        <input type="date" {...register("date")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Salida</span>
        <input type="time" {...register("time")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <div className="flex items-end">
        <button type="submit" disabled={loading} className="w-full rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {loading ? "Calculando…" : "Analizar ruta"}
        </button>
      </div>
    </form>
  );
}