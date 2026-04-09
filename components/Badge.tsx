import { ESTADO_COLORS, ESTADO_LABELS, PAGO_COLORS } from "@/lib/constants";

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ESTADO_COLORS[estado] ?? "bg-gray-100 text-gray-700"}`}>
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}

export function PagoBadge({ estado }: { estado: string }) {
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    parcial: "Parcial",
    pagado: "Pagado",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${PAGO_COLORS[estado] ?? "bg-gray-100"}`}>
      {labels[estado] ?? estado}
    </span>
  );
}
