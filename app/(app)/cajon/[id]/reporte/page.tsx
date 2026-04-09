"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Concepto = { id: string; nombre: string; tipo: string };
type Movimiento = {
  id: string;
  tipo: string;
  monto: number;
  descripcion?: string;
  concepto?: Concepto;
  createdAt: string;
};
type Cajon = {
  id: string;
  saldoInicial: number;
  saldoFinal: number | null;
  estado: string;
  createdAt: string;
  movimientos: Movimiento[];
  user: { name: string };
};
type PagoRegistrado = {
  id: string;
  monto: number;
  metodoPago: string;
  createdAt: string;
  pedido: {
    numero: number;
    total: number;
    cliente: { nombre: string };
  };
};

export default function ReportePage() {
  const { id } = useParams<{ id: string }>();
  const [cajon, setCajon] = useState<Cajon | null>(null);
  const [pagos, setPagos] = useState<PagoRegistrado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/cajon/${id}/reporte`)
      .then((r) => r.json())
      .then(({ cajon, pagos }) => {
        setCajon(cajon);
        setPagos(pagos ?? []);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-gray-400">Cargando reporte...</div>;
  if (!cajon) return <div className="p-8 text-red-600">No se encontró el cajón</div>;

  // Cobros por método
  const pagosEfectivo = pagos.filter((p) => p.metodoPago === "efectivo");
  const pagosTarjeta = pagos.filter((p) => p.metodoPago === "tarjeta");
  const pagosMercado = pagos.filter((p) => p.metodoPago === "mercadopago");

  const totalEfectivo = pagosEfectivo.reduce((s, p) => s + p.monto, 0);
  const totalTarjeta = pagosTarjeta.reduce((s, p) => s + p.monto, 0);
  const totalMercadopago = pagosMercado.reduce((s, p) => s + p.monto, 0);
  const totalCobrado = pagos.reduce((s, p) => s + p.monto, 0);

  // Movimientos de caja
  const ingresosDetalle = cajon.movimientos.filter((m) => m.tipo === "ingreso");
  const gastosDetalle = cajon.movimientos.filter((m) => m.tipo === "gasto");
  const totalIngresos = ingresosDetalle.reduce((s, m) => s + m.monto, 0);
  const totalGastos = gastosDetalle.reduce((s, m) => s + m.monto, 0);

  // Efectivo esperado = apertura + cobros_efectivo + ingresos_caja - gastos_caja
  const efectivoEsperado = cajon.saldoInicial + totalEfectivo + totalIngresos - totalGastos;
  const diferencia = cajon.saldoFinal !== null ? cajon.saldoFinal - efectivoEsperado : null;

  return (
    <div>
      <div className="flex gap-3 mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700"
        >
          Imprimir / Guardar PDF
        </button>
        <a href="/cajon" className="text-gray-500 hover:underline flex items-center text-sm">
          ← Volver
        </a>
      </div>

      <div className="max-w-2xl mx-auto bg-white p-8 space-y-6 print:shadow-none">
        {/* Header */}
        <div className="text-center border-b pb-4">
          <h1 className="text-2xl font-bold">Cierre de Caja</h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date(cajon.createdAt).toLocaleDateString("es-AR", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })}
          </p>
          <p className="text-gray-500 text-sm">Empleado: {cajon.user.name}</p>
        </div>

        {/* Cobros del día */}
        <section>
          <h2 className="font-bold text-base mb-3 border-b pb-1">
            Cobros del día
            <span className="ml-2 text-sm font-normal text-gray-400">
              {pagos.length} cobro{pagos.length !== 1 ? "s" : ""} · total cobrado ${totalCobrado.toLocaleString()}
            </span>
          </h2>

          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between py-1.5 border-b">
              <div>
                <span className="font-medium text-green-700">Efectivo</span>
                <span className="ml-2 text-xs text-gray-400">{pagosEfectivo.length} cobro{pagosEfectivo.length !== 1 ? "s" : ""} · suma al cajón</span>
              </div>
              <span className="font-semibold text-green-700">${totalEfectivo.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <div>
                <span className="font-medium">Tarjeta</span>
                <span className="ml-2 text-xs text-gray-400">{pagosTarjeta.length} cobro{pagosTarjeta.length !== 1 ? "s" : ""} · digital</span>
              </div>
              <span className="font-semibold text-gray-600">${totalTarjeta.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <div>
                <span className="font-medium">Mercado Pago</span>
                <span className="ml-2 text-xs text-gray-400">{pagosMercado.length} cobro{pagosMercado.length !== 1 ? "s" : ""} · digital</span>
              </div>
              <span className="font-semibold text-gray-600">${totalMercadopago.toLocaleString()}</span>
            </div>
          </div>

          {/* Detalle de cobros */}
          {pagos.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="text-left py-1.5 px-2">#</th>
                  <th className="text-left py-1.5 px-2">Cliente</th>
                  <th className="text-right py-1.5 px-2">Total pedido</th>
                  <th className="text-right py-1.5 px-2">Cobrado</th>
                  <th className="text-left py-1.5 px-2">Método</th>
                  <th className="text-left py-1.5 px-2">Hora</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-1.5 px-2 text-gray-500">{p.pedido.numero}</td>
                    <td className="py-1.5 px-2">{p.pedido.cliente.nombre}</td>
                    <td className="py-1.5 px-2 text-right">${p.pedido.total.toLocaleString()}</td>
                    <td className="py-1.5 px-2 text-right font-medium">${p.monto.toLocaleString()}</td>
                    <td className="py-1.5 px-2 capitalize text-gray-500">{p.metodoPago}</td>
                    <td className="py-1.5 px-2 text-gray-400">{new Date(p.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Balance de caja */}
        <section>
          <h2 className="font-bold text-base mb-3 border-b pb-1">Balance de caja</h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Saldo inicial (apertura)</span>
              <span className="font-medium">${cajon.saldoInicial.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 text-green-700">
              <span>+ Cobros en efectivo</span>
              <span className="font-medium">${totalEfectivo.toLocaleString()}</span>
            </div>
            {ingresosDetalle.length > 0 && (
              <>
                <div className="flex justify-between py-1 text-green-700">
                  <span>+ Otros ingresos</span>
                  <span className="font-medium">${totalIngresos.toLocaleString()}</span>
                </div>
                {ingresosDetalle.map((m) => (
                  <div key={m.id} className="flex justify-between py-0.5 pl-4 text-xs text-gray-500">
                    <span>{m.concepto?.nombre ?? m.descripcion ?? "—"}</span>
                    <span>${m.monto.toLocaleString()}</span>
                  </div>
                ))}
              </>
            )}
            {gastosDetalle.length > 0 && (
              <>
                <div className="flex justify-between py-1 text-red-700">
                  <span>− Gastos</span>
                  <span className="font-medium">${totalGastos.toLocaleString()}</span>
                </div>
                {gastosDetalle.map((m) => (
                  <div key={m.id} className="flex justify-between py-0.5 pl-4 text-xs text-gray-500">
                    <span>{m.concepto?.nombre ?? m.descripcion ?? "—"}</span>
                    <span>−${m.monto.toLocaleString()}</span>
                  </div>
                ))}
              </>
            )}
            <div className="flex justify-between py-2 border-t font-bold text-base mt-1">
              <span>Efectivo esperado en caja</span>
              <span>${efectivoEsperado.toLocaleString()}</span>
            </div>
            {cajon.saldoFinal !== null && (
              <div className="flex justify-between py-1 font-semibold">
                <span>Contado al cerrar (arqueo)</span>
                <span>${cajon.saldoFinal.toLocaleString()}</span>
              </div>
            )}
          </div>
        </section>

        {/* Resultado */}
        {diferencia !== null && (
          <section>
            <div className={`rounded-xl p-5 text-center ${diferencia === 0 ? "bg-green-50" : diferencia > 0 ? "bg-blue-50" : "bg-red-50"}`}>
              <div className={`text-3xl font-bold mb-1 ${diferencia === 0 ? "text-green-700" : diferencia > 0 ? "text-blue-700" : "text-red-700"}`}>
                {diferencia === 0
                  ? "✓ Caja saldada"
                  : diferencia > 0
                  ? `↑ Sobrante $${Math.abs(diferencia).toLocaleString()}`
                  : `↓ Faltante $${Math.abs(diferencia).toLocaleString()}`}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Esperado ${efectivoEsperado.toLocaleString()} · Contado ${cajon.saldoFinal!.toLocaleString()}
              </div>
            </div>
          </section>
        )}

        <div className="text-center text-xs text-gray-400 pt-4 border-t">
          Impreso el {new Date().toLocaleString("es-AR")}
        </div>
      </div>
    </div>
  );
}
