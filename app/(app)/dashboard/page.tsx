import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId } from "@/lib/empresa";
import { ESTADO_LABELS, ESTADO_COLORS } from "@/lib/constants";
import Link from "next/link";
import { BuscadorPedidos } from "@/components/BuscadorPedidos";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const empresaId = session
    ? await resolveEmpresaId(session.user as { empresaId?: string | null; role?: string })
    : null;

  const where = empresaId ? { empresaId: empresaId as never } : {};

  const [totalPedidos, pendientesRecepcion, porLavar, listos, enReparto, deposito, pedidosRecientes] =
    await Promise.all([
      prisma.pedido.count({ where }),
      prisma.pedido.count({ where: { ...where, estado: "pendiente_recepcion" } }),
      prisma.pedido.count({ where: { ...where, estado: "por_lavar" } }),
      prisma.pedido.count({ where: { ...where, estado: "listo" } }),
      prisma.pedido.count({ where: { ...where, estado: "en_reparto" } }),
      prisma.pedido.count({ where: { ...where, enDeposito: true } }),
      prisma.pedido.findMany({
        where,
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { cliente: true },
      }),
    ]);

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── BLOQUE PRINCIPAL: acción + búsqueda ────────────────────────── */}
      <div className="space-y-3">
        {/* Botón nuevo pedido */}
        <Link
          href="/pedidos/nuevo"
          className="flex items-center justify-center gap-3 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl py-4 text-lg font-semibold shadow-md transition-colors min-h-[60px]"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo pedido
        </Link>

        {/* Buscador en tiempo real */}
        <BuscadorPedidos autoFocus />
      </div>

      {/* ── ACCESOS RÁPIDOS POR ESTADO ──────────────────────────────────── */}
      {(pendientesRecepcion > 0 || porLavar > 0 || listos > 0 || enReparto > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {pendientesRecepcion > 0 && (
            <Link
              href="/pedidos?estado=pendiente_recepcion"
              className="flex flex-col items-center justify-center bg-yellow-50 border border-yellow-200 rounded-xl p-3 hover:bg-yellow-100 transition-colors"
            >
              <span className="text-2xl font-bold text-yellow-700">{pendientesRecepcion}</span>
              <span className="text-xs text-yellow-700 text-center mt-0.5 leading-tight">Pendientes recepción</span>
            </Link>
          )}
          {porLavar > 0 && (
            <Link
              href="/pedidos?estado=por_lavar"
              className="flex flex-col items-center justify-center bg-indigo-50 border border-indigo-200 rounded-xl p-3 hover:bg-indigo-100 transition-colors"
            >
              <span className="text-2xl font-bold text-indigo-700">{porLavar}</span>
              <span className="text-xs text-indigo-700 text-center mt-0.5 leading-tight">Por lavar</span>
            </Link>
          )}
          {listos > 0 && (
            <Link
              href="/pedidos?estado=listo"
              className="flex flex-col items-center justify-center bg-green-50 border border-green-200 rounded-xl p-3 hover:bg-green-100 transition-colors"
            >
              <span className="text-2xl font-bold text-green-700">{listos}</span>
              <span className="text-xs text-green-700 text-center mt-0.5 leading-tight">Listos para retirar</span>
            </Link>
          )}
          {enReparto > 0 && (
            <Link
              href="/pedidos?estado=en_reparto"
              className="flex flex-col items-center justify-center bg-purple-50 border border-purple-200 rounded-xl p-3 hover:bg-purple-100 transition-colors"
            >
              <span className="text-2xl font-bold text-purple-700">{enReparto}</span>
              <span className="text-xs text-purple-700 text-center mt-0.5 leading-tight">En reparto</span>
            </Link>
          )}
        </div>
      )}

      {/* ── ÚLTIMOS PEDIDOS ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Últimos pedidos</h2>
          <Link href="/pedidos" className="text-xs text-blue-600 hover:underline">Ver todos →</Link>
        </div>

        {/* Tabla — desktop */}
        <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-500">#</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Estado</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Total</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Fecha</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pedidosRecientes.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">#{(p as typeof p & { numero: number }).numero}</td>
                  <td className="px-4 py-2.5 font-medium">{p.cliente.nombre}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${ESTADO_COLORS[p.estado] ?? "bg-gray-100 text-gray-700"}`}>
                      {ESTADO_LABELS[p.estado] ?? p.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">${p.total.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(p.createdAt).toLocaleDateString("es-AR")}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/pedidos/${p.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cards — mobile */}
        <div className="sm:hidden space-y-2">
          {pedidosRecientes.map((p) => (
            <Link
              key={p.id}
              href={`/pedidos/${p.id}`}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-300 active:bg-blue-50 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">#{(p as typeof p & { numero: number }).numero}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${ESTADO_COLORS[p.estado] ?? "bg-gray-100 text-gray-700"}`}>
                    {ESTADO_LABELS[p.estado] ?? p.estado}
                  </span>
                </div>
                <p className="font-medium text-gray-900 truncate mt-0.5">{p.cliente.nombre}</p>
                <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString("es-AR")}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-gray-800">${p.total.toLocaleString()}</p>
                <p className="text-xs text-blue-600">Ver →</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── MÉTRICAS (prioridad baja) ─────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Resumen general</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <Link href="/pedidos" className="rounded-xl p-3 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-center">
            <div className="text-2xl font-bold">{totalPedidos}</div>
            <div className="text-xs mt-0.5 leading-tight">Total</div>
          </Link>
          <Link href="/pedidos?estado=pendiente_recepcion" className="rounded-xl p-3 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors text-center">
            <div className="text-2xl font-bold">{pendientesRecepcion}</div>
            <div className="text-xs mt-0.5 leading-tight">Recepción</div>
          </Link>
          <Link href="/pedidos?estado=por_lavar" className="rounded-xl p-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors text-center">
            <div className="text-2xl font-bold">{porLavar}</div>
            <div className="text-xs mt-0.5 leading-tight">Por lavar</div>
          </Link>
          <Link href="/pedidos?estado=listo" className="rounded-xl p-3 bg-green-50 text-green-700 hover:bg-green-100 transition-colors text-center">
            <div className="text-2xl font-bold">{listos}</div>
            <div className="text-xs mt-0.5 leading-tight">Listos</div>
          </Link>
          <Link href="/pedidos?estado=en_reparto" className="rounded-xl p-3 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors text-center">
            <div className="text-2xl font-bold">{enReparto}</div>
            <div className="text-xs mt-0.5 leading-tight">Reparto</div>
          </Link>
          <Link href="/deposito" className="rounded-xl p-3 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-center">
            <div className="text-2xl font-bold">{deposito}</div>
            <div className="text-xs mt-0.5 leading-tight">Depósito</div>
          </Link>
        </div>
      </div>

    </div>
  );
}
