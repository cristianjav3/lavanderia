"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

type Analytics = {
  periodo: string;
  desde: string;
  hasta: string;
  productos: { tipo: string; cantidad: number; subtotal: number; porcentaje: number }[];
  metodosPago: { metodoPago: string; total: number; cantidad: number; porcentaje: number }[];
  gastos: { nombre: string; total: number; cantidad: number }[];
  ingresos: { nombre: string; total: number; cantidad: number }[];
  evolucion: Record<string, number | string>[];
  cajaPorEmpleado: { userId: string; userName: string; sesiones: number; totalCobrado: number; totalGastos: number }[];
  totales: { cobrado: number; gastado: number; ingresosExtra: number };
};

const COLORES_METODO = {
  efectivo: "#10b981",
  tarjeta: "#3b82f6",
  mercadopago: "#8b5cf6",
};

const TIPO_LABELS: Record<string, string> = {
  canasto: "Canasto",
  acolchado: "Acolchado",
  zapatillas: "Zapatillas",
  secado: "Secado",
};

const COLORES_PRODUCTOS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

const METODO_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  mercadopago: "Mercado Pago",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("mensual");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => {
    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  async function cargar() {
    setLoading(true);
    const params = new URLSearchParams({ periodo });
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    const res = await fetch(`/api/admin/analytics?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  if (loading) return <div className="text-gray-400 p-4">Cargando analítica...</div>;
  if (!data) return null;

  const metodosData = data.metodosPago.map((m) => ({
    name: METODO_LABELS[m.metodoPago] ?? m.metodoPago,
    value: m.total,
    porcentaje: m.porcentaje,
    color: COLORES_METODO[m.metodoPago as keyof typeof COLORES_METODO] ?? "#94a3b8",
  }));

  const productosData = data.productos.map((p, i) => ({
    name: TIPO_LABELS[p.tipo] ?? p.tipo,
    subtotal: p.subtotal,
    cantidad: p.cantidad,
    fill: COLORES_PRODUCTOS[i % COLORES_PRODUCTOS.length],
  }));

  const gastosData = data.gastos.map((g) => ({
    name: g.nombre,
    total: g.total,
  }));

  const evolucionKeys = ["efectivo", "tarjeta", "mercadopago"].filter((k) =>
    data.evolucion.some((e) => e[k] !== undefined)
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Analítica de Caja</h1>

        {/* Controles */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex border border-gray-200 rounded overflow-hidden">
            {(["diario", "semanal", "mensual"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 text-sm capitalize ${periodo === p ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
          <button
            onClick={cargar}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
          >
            Aplicar
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Período: {new Date(data.desde).toLocaleDateString("es-AR")} — {new Date(data.hasta).toLocaleDateString("es-AR")}
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-100 rounded-lg p-4">
          <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Total cobrado</p>
          <p className="text-2xl font-bold text-green-700 mt-1">${data.totales.cobrado.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-lg p-4">
          <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Total gastos</p>
          <p className="text-2xl font-bold text-red-700 mt-1">${data.totales.gastado.toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Ingresos extra</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">${data.totales.ingresosExtra.toLocaleString()}</p>
        </div>
      </div>

      {/* Productos y métodos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Productos más vendidos */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-4 text-sm text-gray-600 uppercase tracking-wide">Productos vendidos</h2>
          {productosData.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={productosData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, "Subtotal"]} />
                  <Bar dataKey="subtotal" radius={[4, 4, 0, 0]}>
                    {productosData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {data.productos.map((p, i) => (
                  <div key={p.tipo} className="flex justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ background: COLORES_PRODUCTOS[i % COLORES_PRODUCTOS.length] }}
                      />
                      {TIPO_LABELS[p.tipo] ?? p.tipo}
                    </span>
                    <span className="text-gray-500">{p.porcentaje}% · ${p.subtotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Métodos de pago */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-4 text-sm text-gray-600 uppercase tracking-wide">Métodos de pago</h2>
          {metodosData.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={metodosData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {metodosData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, ""]} />
                  <Legend
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {data.metodosPago.map((m) => (
                  <div key={m.metodoPago} className="flex justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ background: COLORES_METODO[m.metodoPago as keyof typeof COLORES_METODO] ?? "#94a3b8" }}
                      />
                      {METODO_LABELS[m.metodoPago] ?? m.metodoPago}
                    </span>
                    <span className="text-gray-500">{m.porcentaje}% · ${m.total.toLocaleString()} ({m.cantidad} cobros)</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Evolución temporal */}
      {data.evolucion.length > 1 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-4 text-sm text-gray-600 uppercase tracking-wide">Evolución de cobros</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.evolucion} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="fecha"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => {
                  const d = new Date(v as string);
                  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
                }}
              />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleDateString("es-AR")}
                formatter={(v, name) => [`$${Number(v).toLocaleString()}`, METODO_LABELS[String(name)] ?? String(name)]}
              />
              <Legend formatter={(v) => <span className="text-xs">{METODO_LABELS[v] ?? v}</span>} />
              {evolucionKeys.map((k) => (
                <Bar
                  key={k}
                  dataKey={k}
                  stackId="a"
                  fill={COLORES_METODO[k as keyof typeof COLORES_METODO] ?? "#94a3b8"}
                  radius={k === evolucionKeys[evolucionKeys.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gastos */}
      {data.gastos.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3 text-sm text-gray-600 uppercase tracking-wide">
            Detalle de gastos — Total: ${data.totales.gastado.toLocaleString()}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              {gastosData.length === 0 ? (
                <p className="text-sm text-gray-400">Sin gastos</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(120, gastosData.length * 36)}>
                  <BarChart data={gastosData} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, "Total"]} />
                    <Bar dataKey="total" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="space-y-1.5">
              {data.gastos.map((g) => (
                <div key={g.nombre} className="flex justify-between text-sm border-b pb-1">
                  <span className="text-gray-700">{g.nombre}</span>
                  <span className="font-medium text-red-600">${g.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Caja por empleado */}
      {data.cajaPorEmpleado.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3 text-sm text-gray-600 uppercase tracking-wide">Resumen por empleado</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Empleado</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Sesiones</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Total cobrado</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Gastos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.cajaPorEmpleado.map((e) => (
                <tr key={e.userId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{e.userName}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{e.sesiones}</td>
                  <td className="px-3 py-2 text-right font-medium text-green-700">${e.totalCobrado.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-red-600">${e.totalGastos.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
