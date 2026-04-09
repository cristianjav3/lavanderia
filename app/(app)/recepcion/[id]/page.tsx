"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { calcularCanastos, PRECIOS } from "@/lib/constants";

type ItemOriginal = { tipo: string; cantidad: number };

type Pedido = {
  id: string;
  tipoEntrega: string;
  total: number;
  pagado: number;
  items: ItemOriginal[];
  cliente: { nombre: string; telefono: string };
};

type CantidadesForm = Record<string, number>;

const TODOS_LOS_TIPOS = [
  { tipo: "canasto", label: "Canasto (ropa)" },
  { tipo: "acolchado", label: "Acolchado" },
  { tipo: "zapatillas", label: "Zapatillas" },
  { tipo: "secado", label: "Secado" },
];

export default function RecepcionPage() {
  const { id } = useParams();
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [cantidades, setCantidades] = useState<CantidadesForm>({});
  const [tiposActivos, setTiposActivos] = useState<string[]>([]);
  const [notas, setNotas] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [requiereValidacion, setRequiereValidacion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/pedidos/${id}`)
      .then((r) => r.json())
      .then((data: Pedido) => {
        setPedido(data);
        const inicial: CantidadesForm = {};
        const tipos: string[] = [];
        for (const item of data.items) {
          inicial[item.tipo] = item.cantidad;
          tipos.push(item.tipo);
        }
        setCantidades(inicial);
        setTiposActivos(tipos);
        setLoading(false);
      });
  }, [id]);

  function calcularTotal() {
    if (!pedido) return 0;
    let total = 0;
    for (const [tipo, cantidad] of Object.entries(cantidades)) {
      if (!cantidad) continue;
      if (tipo === "canasto") {
        total += calcularCanastos(cantidad) * PRECIOS.canasto;
      } else if (tipo === "acolchado") {
        total += cantidad * PRECIOS.acolchado;
      } else {
        total += cantidad * PRECIOS.canasto;
      }
    }
    if (pedido.tipoEntrega === "domicilio") total += PRECIOS.retiro;
    return total;
  }

  const totalCalculado = calcularTotal();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const items = tiposActivos
      .map((tipo) => ({ tipo, cantidad: cantidades[tipo] ?? 0 }))
      .filter((i) => i.cantidad > 0);

    const res = await fetch(`/api/pedidos/${id}/recepcion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, notas, observaciones, requiereValidacion }),
    });

    if (res.ok) {
      router.push(`/pedidos/${id}`);
    } else {
      const data = await res.json();
      setError(data.error || "Error al recepcionar");
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4 text-gray-400">Cargando...</div>;
  if (!pedido) return <div className="p-4 text-red-500">Pedido no encontrado</div>;

  const TIPO_LABELS: Record<string, string> = {
    canasto: "Canasto (prendas)",
    acolchado: "Acolchado",
    zapatillas: "Zapatillas",
    secado: "Secado",
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold mb-1">Recepción</h1>
      <p className="text-sm text-gray-500 mb-4">
        Pedido #{id?.toString().slice(-8)} — {pedido.cliente.nombre}
      </p>

      {/* Pedido original */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-sm mb-2 text-yellow-800">Pedido original</h2>
        {pedido.items.map((item, i) => (
          <p key={i} className="text-sm">
            {TIPO_LABELS[item.tipo] ?? item.tipo}:{" "}
            <strong>{item.cantidad}</strong>
            {item.tipo === "canasto" && ` prendas = ${calcularCanastos(item.cantidad)} canasto(s)`}
          </p>
        ))}
        <p className="text-sm mt-1">
          Total estimado: <strong>${pedido.total.toLocaleString()}</strong>
        </p>
        <p className="text-sm">Pagado: <strong>${pedido.pagado.toLocaleString()}</strong></p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cantidades reales por tipo */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <label className="block font-semibold">Cantidades reales</label>

          {tiposActivos.map((tipo) => (
            <div key={tipo} className="flex items-start gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">
                  {TIPO_LABELS[tipo] ?? tipo}
                  {tipo === "canasto" && <span className="text-gray-400 font-normal"> (prendas)</span>}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={cantidades[tipo] ?? ""}
                    onChange={(e) =>
                      setCantidades({ ...cantidades, [tipo]: parseInt(e.target.value) || 0 })
                    }
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-lg font-bold w-28 min-h-[44px]"
                  />
                  {tipo === "canasto" && (cantidades[tipo] ?? 0) > 0 && (
                    <span className="text-sm text-blue-600">
                      = {calcularCanastos(cantidades[tipo])} canasto(s) × ${PRECIOS.canasto.toLocaleString()}
                    </span>
                  )}
                  {tipo === "acolchado" && (cantidades[tipo] ?? 0) > 0 && (
                    <span className="text-sm text-blue-600">
                      × ${PRECIOS.acolchado.toLocaleString()} c/u
                    </span>
                  )}
                  {tipo !== "canasto" && (
                    <button
                      type="button"
                      onClick={() => {
                        setTiposActivos(tiposActivos.filter((t) => t !== tipo));
                        const next = { ...cantidades };
                        delete next[tipo];
                        setCantidades(next);
                      }}
                      className="text-red-400 hover:text-red-600 text-sm px-2 py-1 min-h-[44px]"
                      title="Quitar"
                    >
                      ✕ Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Agregar tipo no presente */}
          {TODOS_LOS_TIPOS.filter((t) => !tiposActivos.includes(t.tipo)).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dashed border-gray-200">
              <span className="text-sm text-gray-500">Agregar:</span>
              {TODOS_LOS_TIPOS.filter((t) => !tiposActivos.includes(t.tipo)).map((t) => (
                <button
                  key={t.tipo}
                  type="button"
                  onClick={() => {
                    setTiposActivos([...tiposActivos, t.tipo]);
                    setCantidades({ ...cantidades, [t.tipo]: 0 });
                  }}
                  className="text-sm bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-100 min-h-[40px]"
                >
                  + {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Resumen total */}
          <div className="p-3 bg-blue-50 rounded text-sm mt-2">
            {tiposActivos.map((tipo) => {
              const cant = cantidades[tipo] ?? 0;
              if (!cant) return null;
              if (tipo === "canasto") {
                const c = calcularCanastos(cant);
                return <p key={tipo}>{c} canasto(s) ({cant} prendas) × ${PRECIOS.canasto.toLocaleString()} = ${(c * PRECIOS.canasto).toLocaleString()}</p>;
              }
              if (tipo === "acolchado") return <p key={tipo}>{cant} acolchado(s) × ${PRECIOS.acolchado.toLocaleString()} = ${(cant * PRECIOS.acolchado).toLocaleString()}</p>;
              return <p key={tipo}>{cant} {tipo} × ${PRECIOS.canasto.toLocaleString()} = ${(cant * PRECIOS.canasto).toLocaleString()}</p>;
            })}
            {pedido.tipoEntrega === "domicilio" && (
              <p>+ Retiro: ${PRECIOS.retiro.toLocaleString()}</p>
            )}
            <p className="text-base font-bold mt-1 border-t pt-1">
              Total real: ${totalCalculado.toLocaleString()}
            </p>
            {totalCalculado !== pedido.total && (
              <p className="text-orange-600 text-xs mt-1">
                ⚠ Diferencia con presupuesto: ${Math.abs(totalCalculado - pedido.total).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* Notas */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div>
            <label className="block font-semibold mb-1">Notas internas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-20 resize-none"
              placeholder="Manchas, prendas especiales, etc."
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Observaciones (visibles al cliente)</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-20 resize-none"
              placeholder="Observaciones para informar al cliente..."
            />
          </div>
        </div>

        {/* Validación */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={requiereValidacion}
              onChange={(e) => setRequiereValidacion(e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <p className="font-semibold text-sm">Requiere validación del cliente</p>
              <p className="text-xs text-gray-500">
                El pedido quedará en estado &quot;validación&quot; hasta confirmar
              </p>
            </div>
          </label>
        </div>

        {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-orange-500 text-white py-3.5 rounded-lg font-semibold text-base hover:bg-orange-600 disabled:opacity-50 min-h-[52px]"
        >
          {saving ? "Guardando..." : "Confirmar recepción"}
        </button>
      </form>
    </div>
  );
}
