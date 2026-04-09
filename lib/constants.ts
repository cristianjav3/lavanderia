export const PRECIOS = {
  canasto: 10000,
  acolchado: 25000,
  retiro: 5000,
  reintento: 2500,
};

export const PRENDAS_POR_CANASTO = 12;

export function calcularCanastos(prendas: number): number {
  return Math.ceil(prendas / PRENDAS_POR_CANASTO);
}

export const ESTADO_LABELS: Record<string, string> = {
  pendiente_recepcion: "Pendiente recepción",
  validacion: "Validación",
  por_lavar: "Por lavar",
  listo: "Listo",
  en_reparto: "En reparto",
  no_entregado: "No entregado",
  en_sucursal: "En sucursal",
  deposito: "Depósito",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const ESTADO_COLORS: Record<string, string> = {
  pendiente_recepcion: "bg-yellow-100 text-yellow-800",
  validacion: "bg-orange-100 text-orange-800",
  por_lavar: "bg-blue-100 text-blue-800",
  listo: "bg-green-100 text-green-800",
  en_reparto: "bg-purple-100 text-purple-800",
  no_entregado: "bg-red-100 text-red-800",
  en_sucursal: "bg-teal-100 text-teal-800",
  deposito: "bg-gray-100 text-gray-800",
  entregado: "bg-green-200 text-green-900",
  cancelado: "bg-red-200 text-red-900",
};

export const PAGO_COLORS: Record<string, string> = {
  pendiente: "bg-red-100 text-red-700",
  parcial: "bg-yellow-100 text-yellow-700",
  pagado: "bg-green-100 text-green-700",
};

export const FRANJAS = [
  "08:00 - 10:00",
  "10:00 - 12:00",
  "12:00 - 14:00",
  "14:00 - 16:00",
  "16:00 - 18:00",
  "18:00 - 20:00",
];
