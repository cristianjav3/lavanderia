"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ClienteStat = {
  id: string;
  nombre: string;
  telefono: string;
  totalPedidos: number;
  totalGastado: number;
  ultimaCompra: string | null;
};

type Pedido = {
  id: string;
  numero: number;
  estado: string;
  estadoPago: string;
  total: number;
  pagado: number;
  saldo: number;
  tipoEntrega: string;
  createdAt: string;
  items: { tipo: string; cantidad: number }[];
};

const TIPO_LABELS: Record<string, string> = {
  canasto: "Canasto",
  acolchado: "Acolchado",
  zapatillas: "Zapatillas",
  secado: "Secado",
};

const ESTADO_COLORS: Record<string, string> = {
  pendiente_recepcion: "bg-yellow-100 text-yellow-800",
  por_lavar: "bg-blue-100 text-blue-800",
  listo: "bg-green-100 text-green-800",
  en_reparto: "bg-purple-100 text-purple-800",
  entregado: "bg-green-200 text-green-900",
  cancelado: "bg-red-200 text-red-900",
  deposito: "bg-gray-100 text-gray-800",
  no_entregado: "bg-red-100 text-red-800",
  en_sucursal: "bg-teal-100 text-teal-800",
  validacion: "bg-orange-100 text-orange-800",
};

const ESTADO_LABELS: Record<string, string> = {
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

function frecuenciaLabel(total: number) {
  if (total >= 10) return { label: "Muy frecuente", color: "bg-purple-100 text-purple-700" };
  if (total >= 5) return { label: "Frecuente", color: "bg-blue-100 text-blue-700" };
  if (total >= 2) return { label: "Regular", color: "bg-green-100 text-green-700" };
  return { label: "Ocasional", color: "bg-gray-100 text-gray-600" };
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteStat[]>([]);
  const [filtrados, setFiltrados] = useState<ClienteStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipoServicio, setTipoServicio] = useState("");
  const [minPedidos, setMinPedidos] = useState("");

  // Historial del cliente seleccionado
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteStat | null>(null);
  const [historial, setHistorial] = useState<Pedido[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  useEffect(() => {
    fetch("/api/clientes?stats=1")
      .then((r) => r.json())
      .then((data: ClienteStat[]) => {
        setClientes(data);
        setFiltrados(data);
        setLoading(false);
      });
  }, []);

  // Aplicar filtros
  useEffect(() => {
    let result = clientes;

    if (busqueda) {
      const q = busqueda.toLowerCase();
      result = result.filter(
        (c) => c.nombre.toLowerCase().includes(q) || c.telefono.includes(busqueda)
      );
    }

    if (minPedidos) {
      result = result.filter((c) => c.totalPedidos >= parseInt(minPedidos));
    }

    if (desde) {
      const desdeDate = new Date(desde);
      result = result.filter((c) => c.ultimaCompra && new Date(c.ultimaCompra) >= desdeDate);
    }

    if (hasta) {
      const hastaDate = new Date(hasta + "T23:59:59");
      result = result.filter((c) => c.ultimaCompra && new Date(c.ultimaCompra) <= hastaDate);
    }

    setFiltrados(result);
  }, [busqueda, desde, hasta, minPedidos, clientes]);

  async function verHistorial(c: ClienteStat) {
    if (clienteSeleccionado?.id === c.id) {
      setClienteSeleccionado(null);
      setHistorial([]);
      return;
    }
    setClienteSeleccionado(c);
    setLoadingHistorial(true);
    const res = await fetch(`/api/clientes/${c.id}`);
    const data: Pedido[] = await res.json();

    // Filtrar por tipo de servicio si está seleccionado
    const pedidos = tipoServicio
      ? data.filter((p) => p.items.some((i) => i.tipo === tipoServicio))
      : data;
    setHistorial(pedidos);
    setLoadingHistorial(false);
  }

  function limpiarFiltros() {
    setBusqueda("");
    setDesde("");
    setHasta("");
    setTipoServicio("");
    setMinPedidos("");
  }

  if (loading) return <div className="text-gray-400 p-4">Cargando...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Clientes</h1>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-600">Filtros</p>
          <button onClick={limpiarFiltros} className="text-xs text-gray-400 hover:underline">
            Limpiar
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Buscar cliente</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o teléfono..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Última compra desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo de servicio</label>
            <select
              value={tipoServicio}
              onChange={(e) => setTipoServicio(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
            >
              <option value="">Todos</option>
              <option value="canasto">Canasto</option>
              <option value="acolchado">Acolchado</option>
              <option value="zapatillas">Zapatillas</option>
              <option value="secado">Secado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mínimo de pedidos</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={minPedidos}
              onChange={(e) => setMinPedidos(e.target.value)}
              placeholder="Ej: 3"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400">{filtrados.length} de {clientes.length} clientes</p>
      </div>

      {/* ── TABLA clientes — desktop ────────────────────────────────────── */}
      <div className="hidden sm:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No hay clientes</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Cliente</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Teléfono</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Pedidos</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Total gastado</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Última compra</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Frecuencia</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map((c) => {
                const freq = frecuenciaLabel(c.totalPedidos);
                const seleccionado = clienteSeleccionado?.id === c.id;
                return (
                  <>
                    <tr
                      key={c.id}
                      className={`hover:bg-gray-50 cursor-pointer ${seleccionado ? "bg-blue-50" : ""}`}
                      onClick={() => verHistorial(c)}
                    >
                      <td className="px-4 py-2 font-medium">{c.nombre}</td>
                      <td className="px-4 py-2 text-gray-500">
                        <a
                          href={`https://wa.me/${c.telefono.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-green-600 hover:underline"
                        >
                          {c.telefono}
                        </a>
                      </td>
                      <td className="px-4 py-2 font-bold">{c.totalPedidos}</td>
                      <td className="px-4 py-2">${c.totalGastado.toLocaleString()}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString("es-AR") : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${freq.color}`}>
                          {freq.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-blue-600">
                        {seleccionado ? "▲ Ocultar" : "▼ Ver historial"}
                      </td>
                    </tr>

                    {seleccionado && (
                      <tr key={`${c.id}-historial`}>
                        <td colSpan={7} className="bg-blue-50 px-4 py-3">
                          <HistorialCliente
                            loading={loadingHistorial}
                            historial={historial}
                            nombre={c.nombre}
                            tipoServicio={tipoServicio}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── CARDS clientes — mobile ──────────────────────────────────────── */}
      <div className="sm:hidden space-y-2">
        {filtrados.length === 0 && (
          <div className="text-center py-8 text-gray-400">No hay clientes</div>
        )}
        {filtrados.map((c) => {
          const freq = frecuenciaLabel(c.totalPedidos);
          const seleccionado = clienteSeleccionado?.id === c.id;
          return (
            <div key={c.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button
                className={`w-full text-left p-4 ${seleccionado ? "bg-blue-50" : ""}`}
                onClick={() => verHistorial(c)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{c.nombre}</p>
                    <a
                      href={`https://wa.me/${c.telefono.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-green-600 text-sm"
                    >
                      {c.telefono}
                    </a>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${freq.color}`}>
                    {freq.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <span><strong>{c.totalPedidos}</strong> pedido{c.totalPedidos !== 1 ? "s" : ""}</span>
                  <span>${c.totalGastado.toLocaleString()} total</span>
                  {c.ultimaCompra && (
                    <span className="text-xs text-gray-400">{new Date(c.ultimaCompra).toLocaleDateString("es-AR")}</span>
                  )}
                </div>
                <p className="text-xs text-blue-600 mt-1">{seleccionado ? "▲ Ocultar historial" : "▼ Ver historial"}</p>
              </button>

              {seleccionado && (
                <div className="border-t border-blue-100 bg-blue-50 p-3">
                  <HistorialCliente
                    loading={loadingHistorial}
                    historial={historial}
                    nombre={c.nombre}
                    tipoServicio={tipoServicio}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Historial inline compartido ───────────────────────────────────────────────
function HistorialCliente({
  loading,
  historial,
  nombre,
  tipoServicio,
}: {
  loading: boolean;
  historial: Pedido[];
  nombre: string;
  tipoServicio: string;
}) {
  if (loading) return <p className="text-sm text-gray-400">Cargando historial...</p>;
  if (historial.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        {tipoServicio
          ? `No hay pedidos de tipo "${TIPO_LABELS[tipoServicio] ?? tipoServicio}" para este cliente.`
          : "Sin pedidos."}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-blue-800">
        Historial de {nombre} ({historial.length} pedido{historial.length !== 1 ? "s" : ""})
      </p>
      <div className="space-y-1.5">
        {historial.map((p) => (
          <Link
            key={p.id}
            href={`/pedidos/${p.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between bg-white rounded border border-blue-100 px-3 py-2 hover:border-blue-300 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-gray-400">#{p.numero}</span>
              <span className={`px-1.5 py-0.5 rounded ${ESTADO_COLORS[p.estado] ?? "bg-gray-100"}`}>
                {ESTADO_LABELS[p.estado] ?? p.estado}
              </span>
              <span className="text-gray-400 truncate hidden sm:inline">
                {p.items.map((i) => `${TIPO_LABELS[i.tipo] ?? i.tipo} ×${i.cantidad}`).join(", ")}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-medium">${p.total.toLocaleString()}</span>
              <span className={`px-1.5 py-0.5 rounded ${
                p.estadoPago === "pagado" ? "bg-green-100 text-green-700" :
                p.estadoPago === "parcial" ? "bg-yellow-100 text-yellow-700" :
                "bg-red-100 text-red-700"
              }`}>{p.estadoPago}</span>
              <span className="text-blue-600">Ver →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
