"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { calcularCanastos, PRECIOS } from "@/lib/constants";

type Item = { tipo: string; cantidad: number; precioUnitario: number };
type PedidoItem = { id: string; nombreProducto: string; precioUnitario: number; cantidad: number };
type Pedido = {
  id: string;
  numero: number;
  total: number;
  pagado: number;
  saldo: number;
  tipoEntrega: string;
  sucursal?: string;
  createdAt: string;
  cliente: { nombre: string; telefono: string; direccion?: string };
  items: Item[];
  pedidoItems: PedidoItem[];
};

const TIPO_LABELS: Record<string, string> = {
  canasto: "Ropa",
  acolchado: "Acolchado",
  zapatillas: "Zapatillas",
  secado: "Secado",
};

export default function ConfirmarPedidoPage() {
  const { id } = useParams();
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [accion, setAccion] = useState(false);

  useEffect(() => {
    fetch(`/api/pedidos/${id}`)
      .then((r) => r.json())
      .then((data: Pedido) => {
        setPedido(data);
        setLoading(false);
      });
  }, [id]);

  async function aceptar() {
    setAccion(true);
    await fetch(`/api/pedidos/${id}/aceptar`, { method: "POST" });
    // Marcar para que la página de impresión muestre el prompt
    sessionStorage.setItem(`imprimir_${id}`, "1");
    router.push(`/impresion/${id}`);
  }

  async function cancelar() {
    setAccion(true);
    await fetch(`/api/pedidos/${id}/estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "cancelado" }),
    });
    router.push("/pedidos");
  }

  if (loading) return <div className="p-8 text-gray-400">Cargando...</div>;
  if (!pedido) return <div className="p-8 text-red-500">Pedido no encontrado</div>;

  return (
    <div className="max-w-md mx-auto py-8 space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-2">🧺</div>
        <h1 className="text-2xl font-bold">Nuevo pedido recibido</h1>
        <p className="text-gray-500 text-sm mt-1">
          Ticket #{pedido.numero} — {new Date(pedido.createdAt).toLocaleString("es-AR")}
        </p>
      </div>

      {/* Resumen del pedido */}
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {/* Cliente */}
        <div className="p-4">
          <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">Cliente</p>
          <p className="font-bold text-lg">{pedido.cliente.nombre}</p>
          <p className="text-sm text-gray-500">{pedido.cliente.telefono}</p>
          {pedido.cliente.direccion && (
            <p className="text-sm text-gray-500">{pedido.cliente.direccion}</p>
          )}
        </div>

        {/* Items */}
        <div className="p-4">
          <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-2">Servicios</p>
          <div className="space-y-1">
            {pedido.items.map((item, i) => {
              const unidades = item.tipo === "canasto" ? calcularCanastos(item.cantidad) : item.cantidad;
              return (
                <div key={i} className="flex justify-between text-sm">
                  <span>
                    {item.tipo === "canasto"
                      ? `${unidades} canasto${unidades > 1 ? "s" : ""} (${item.cantidad} prendas)`
                      : `${unidades} ${TIPO_LABELS[item.tipo] ?? item.tipo}`}
                  </span>
                  <span className="font-medium">${(unidades * item.precioUnitario).toLocaleString()}</span>
                </div>
              );
            })}
            {pedido.pedidoItems?.map((pi) => (
              <div key={pi.id} className="flex justify-between text-sm">
                <span>{pi.cantidad > 1 ? `${pi.cantidad}x ` : ""}{pi.nombreProducto}</span>
                <span className="font-medium">${(pi.precioUnitario * pi.cantidad).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Entrega */}
        <div className="p-4">
          <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">Entrega</p>
          <p className="text-sm capitalize">{pedido.tipoEntrega}{pedido.sucursal ? ` — ${pedido.sucursal}` : ""}</p>
        </div>

        {/* Pago */}
        <div className="p-4">
          <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-2">Pago</p>
          <div className="flex justify-between text-sm">
            <span>Total</span>
            <span className="font-bold text-base">${pedido.total.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span>Pagado</span>
            <span className="text-green-600 font-medium">${pedido.pagado.toLocaleString()}</span>
          </div>
          {pedido.saldo > 0 && (
            <div className="flex justify-between text-sm mt-1 font-bold text-red-600">
              <span>Saldo pendiente</span>
              <span>${pedido.saldo.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={cancelar}
          disabled={accion}
          className="py-3 rounded-xl border-2 border-red-200 text-red-600 font-semibold text-base hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          ✗ Cancelar pedido
        </button>
        <button
          onClick={aceptar}
          disabled={accion}
          className="py-3 rounded-xl bg-green-600 text-white font-semibold text-base hover:bg-green-700 disabled:opacity-50 transition-colors shadow-md"
        >
          ✓ Aceptar
        </button>
      </div>

      <p className="text-center text-xs text-gray-400">
        Al aceptar, el pedido pasa directamente a <strong>Por lavar</strong>
      </p>
    </div>
  );
}
