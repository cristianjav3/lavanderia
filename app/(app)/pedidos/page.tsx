import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId } from "@/lib/empresa";
import { ESTADO_LABELS, ESTADO_COLORS, PAGO_COLORS } from "@/lib/constants";
import Link from "next/link";
import { BuscadorPedidos } from "@/components/BuscadorPedidos";

export const dynamic = "force-dynamic";

const ESTADOS = [
  "pendiente_recepcion", "validacion", "por_lavar", "listo",
  "en_reparto", "no_entregado", "en_sucursal", "deposito", "entregado", "cancelado",
];

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const estado = sp.estado;
  const q = sp.q;

  const session = await getServerSession(authOptions);
  const empresaId = session
    ? await resolveEmpresaId(session.user as { empresaId?: string | null; role?: string })
    : null;

  const empresaWhere = empresaId ? { empresaId: empresaId as never } : {};

  const qClean = q ? q.trim().replace(/^#/, "") : null;
  const qNum = qClean && /^\d+$/.test(qClean) ? parseInt(qClean) : null;

  const pedidos = await prisma.pedido.findMany({
    where: {
      ...empresaWhere,
      ...(estado ? { estado: estado as never } : {}),
      ...(qClean
        ? {
            OR: [
              ...(qNum !== null ? [{ numero: qNum }] : []),
              {
                cliente: {
                  OR: [
                    { nombre: { contains: qClean, mode: "insensitive" } },
                    { telefono: { contains: qClean } },
                  ],
                },
              },
            ],
          }
        : {}),
    },
    include: { cliente: true, items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Pedidos</h1>
        <Link
          href="/pedidos/nuevo"
          className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 min-h-[44px] flex items-center"
        >
          + Nuevo pedido
        </Link>
      </div>

      {/* Buscador en tiempo real */}
      <BuscadorPedidos />

      {/* Filtros — scroll horizontal en mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
        <Link
          href="/pedidos"
          className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap shrink-0 ${!estado ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
        >
          Todos
        </Link>
        {ESTADOS.map((e) => (
          <Link
            key={e}
            href={`/pedidos?estado=${e}`}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap shrink-0 ${estado === e ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          >
            {ESTADO_LABELS[e]}
          </Link>
        ))}
      </div>

      {pedidos.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg py-12 text-center text-gray-400">
          No hay pedidos
        </div>
      )}

      {/* ── TABLA — desktop ──────────────────────────────────────────────── */}
      {pedidos.length > 0 && (
        <div className="hidden sm:block bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">ID</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Cliente</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Tel</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Pago</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Saldo</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Entrega</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Fecha</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pedidos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">#{(p as typeof p & { numero: number }).numero}</td>
                  <td className="px-4 py-2 font-medium">{p.cliente.nombre}</td>
                  <td className="px-4 py-2 text-gray-500">{p.cliente.telefono}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ESTADO_COLORS[p.estado] ?? "bg-gray-100"}`}>
                      {ESTADO_LABELS[p.estado] ?? p.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${PAGO_COLORS[p.estadoPago] ?? "bg-gray-100"}`}>
                      {p.estadoPago}
                    </span>
                  </td>
                  <td className="px-4 py-2">${p.total.toLocaleString()}</td>
                  <td className="px-4 py-2 font-medium text-red-600">
                    {p.saldo > 0 ? `$${p.saldo.toLocaleString()}` : "-"}
                  </td>
                  <td className="px-4 py-2 text-xs">{p.tipoEntrega}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {new Date(p.createdAt).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/pedidos/${p.id}`} className="text-blue-600 hover:underline text-xs mr-2">
                      Ver
                    </Link>
                    {p.estado === "pendiente_recepcion" && (
                      <Link href={`/recepcion/${p.id}`} className="text-orange-600 hover:underline text-xs">
                        Recepcionar
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CARDS — mobile ───────────────────────────────────────────────── */}
      {pedidos.length > 0 && (
        <div className="sm:hidden space-y-2">
          {pedidos.map((p) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <Link
                href={`/pedidos/${p.id}`}
                className="block p-4 hover:border-blue-300 active:bg-blue-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-gray-400">#{(p as typeof p & { numero: number }).numero}</span>
                    <p className="font-semibold text-gray-900 truncate">{p.cliente.nombre}</p>
                    <p className="text-xs text-gray-500">{p.cliente.telefono}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ESTADO_COLORS[p.estado] ?? "bg-gray-100"}`}>
                      {ESTADO_LABELS[p.estado] ?? p.estado}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${PAGO_COLORS[p.estadoPago] ?? "bg-gray-100"}`}>
                      {p.estadoPago}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex gap-3">
                    <span className="text-gray-600">Total: <strong>${p.total.toLocaleString()}</strong></span>
                    {p.saldo > 0 && (
                      <span className="text-red-600 font-medium">Saldo: ${p.saldo.toLocaleString()}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString("es-AR")}</span>
                </div>
              </Link>
              {p.estado === "pendiente_recepcion" && (
                <Link
                  href={`/recepcion/${p.id}`}
                  className="block px-4 py-2 border-t border-gray-100 text-orange-600 text-xs font-medium hover:bg-orange-50"
                >
                  → Recepcionar
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
