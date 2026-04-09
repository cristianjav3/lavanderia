import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId } from "@/lib/empresa";

// GET /api/admin/analytics?periodo=diario|semanal|mensual&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as { role: string }).role !== "admin") {
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  }

  const empresaId = await resolveEmpresaId(session.user as { empresaId?: string | null; role?: string });

  const { searchParams } = new URL(req.url);
  const periodo = searchParams.get("periodo") ?? "mensual";

  const hasta = searchParams.get("hasta")
    ? new Date(searchParams.get("hasta")! + "T23:59:59")
    : new Date();

  let desde: Date;
  if (searchParams.get("desde")) {
    desde = new Date(searchParams.get("desde")! + "T00:00:00");
  } else {
    desde = new Date(hasta);
    if (periodo === "diario") {
      desde.setDate(desde.getDate() - 7);
    } else if (periodo === "semanal") {
      desde.setDate(desde.getDate() - 28);
    } else {
      desde.setMonth(desde.getMonth() - 3);
    }
    desde.setHours(0, 0, 0, 0);
  }

  // Helper: empresa filter fragment for Pedido
  const pedidoEmpresaFilter = empresaId
    ? Prisma.sql`AND p."empresaId" = ${empresaId}`
    : Prisma.sql``;

  const registroPagoEmpresaFilter = empresaId
    ? Prisma.sql`AND rp."empresaId" = ${empresaId}`
    : Prisma.sql``;

  const cajaSesionEmpresaFilter = empresaId
    ? Prisma.sql`AND cs."empresaId" = ${empresaId}`
    : Prisma.sql``;

  const cajaSesionEmpresaFilter2 = empresaId
    ? Prisma.sql`AND cs2."empresaId" = ${empresaId}`
    : Prisma.sql``;

  // 1. Productos más vendidos
  const productosRaw = await prisma.$queryRaw<{ tipo: string; cantidad: bigint; subtotal: number }[]>`
    SELECT i.tipo, SUM(i.cantidad) as cantidad, SUM(
      CASE i.tipo
        WHEN 'canasto' THEN CEIL(i.cantidad::numeric / 12) * i."precioUnitario"
        ELSE i.cantidad * i."precioUnitario"
      END
    ) as subtotal
    FROM "Item" i
    JOIN "Pedido" p ON i."pedidoId" = p.id
    WHERE p."createdAt" >= ${desde} AND p."createdAt" <= ${hasta}
      AND p.estado != 'cancelado'
      ${pedidoEmpresaFilter}
    GROUP BY i.tipo
    ORDER BY subtotal DESC
  `;

  const productos = productosRaw.map((r) => ({
    tipo: r.tipo,
    cantidad: Number(r.cantidad),
    subtotal: Number(r.subtotal),
  }));
  const totalProductos = productos.reduce((s, p) => s + p.subtotal, 0);
  const productosConPct = productos.map((p) => ({
    ...p,
    porcentaje: totalProductos > 0 ? Math.round((p.subtotal / totalProductos) * 100) : 0,
  }));

  // 2. Métodos de pago
  const metodosRaw = await prisma.$queryRaw<{ metodoPago: string; total: number; cantidad: bigint }[]>`
    SELECT rp."metodoPago", SUM(rp.monto) as total, COUNT(*) as cantidad
    FROM "RegistroPago" rp
    WHERE rp."createdAt" >= ${desde} AND rp."createdAt" <= ${hasta}
      ${registroPagoEmpresaFilter}
    GROUP BY rp."metodoPago"
    ORDER BY total DESC
  `;

  const metodos = metodosRaw.map((r) => ({
    metodoPago: r.metodoPago,
    total: Number(r.total),
    cantidad: Number(r.cantidad),
  }));
  const totalMetodos = metodos.reduce((s, m) => s + m.total, 0);
  const metodosConPct = metodos.map((m) => ({
    ...m,
    porcentaje: totalMetodos > 0 ? Math.round((m.total / totalMetodos) * 100) : 0,
  }));

  // 3. Gastos e ingresos por concepto
  const gastosRaw = await prisma.$queryRaw<{ tipo: string; nombre: string | null; total: number; cantidad: bigint }[]>`
    SELECT mc.tipo,
           COALESCE(cc.nombre, mc.descripcion, 'Sin concepto') as nombre,
           SUM(mc.monto) as total,
           COUNT(*) as cantidad
    FROM "MovimientoCaja" mc
    LEFT JOIN "ConceptoCaja" cc ON mc."conceptoId" = cc.id
    JOIN "CajaSesion" cs ON mc."sesionId" = cs.id
    WHERE cs."createdAt" >= ${desde} AND cs."createdAt" <= ${hasta}
      ${cajaSesionEmpresaFilter}
    GROUP BY mc.tipo, COALESCE(cc.nombre, mc.descripcion, 'Sin concepto')
    ORDER BY mc.tipo, total DESC
  `;

  const gastos = gastosRaw
    .filter((r) => r.tipo === "gasto")
    .map((r) => ({ nombre: r.nombre ?? "Sin concepto", total: Number(r.total), cantidad: Number(r.cantidad) }));
  const ingresos = gastosRaw
    .filter((r) => r.tipo === "ingreso")
    .map((r) => ({ nombre: r.nombre ?? "Sin concepto", total: Number(r.total), cantidad: Number(r.cantidad) }));

  // 4. Evolución temporal
  const dateExpr =
    periodo === "diario"
      ? Prisma.sql`DATE(rp."createdAt")`
      : periodo === "semanal"
      ? Prisma.sql`DATE_TRUNC('week', rp."createdAt")::date`
      : Prisma.sql`DATE_TRUNC('month', rp."createdAt")::date`;

  const evolucionRaw = await prisma.$queryRaw<{ fecha: Date; metodoPago: string; total: number }[]>`
    SELECT ${dateExpr} as fecha, rp."metodoPago", SUM(rp.monto) as total
    FROM "RegistroPago" rp
    WHERE rp."createdAt" >= ${desde} AND rp."createdAt" <= ${hasta}
      ${registroPagoEmpresaFilter}
    GROUP BY ${dateExpr}, rp."metodoPago"
    ORDER BY fecha ASC
  `;

  const evolucionMap = new Map<string, Record<string, number | string>>();
  for (const row of evolucionRaw) {
    const key = new Date(row.fecha).toISOString().split("T")[0];
    if (!evolucionMap.has(key)) evolucionMap.set(key, { fecha: key });
    evolucionMap.get(key)![row.metodoPago] = Number(row.total);
  }
  const evolucion = Array.from(evolucionMap.values());

  // 5. Resumen por empleado
  const cajaPorEmpleadoRaw = await prisma.$queryRaw<{
    userId: string; userName: string; sesiones: bigint; totalCobrado: number; totalGastos: number;
  }[]>`
    SELECT cs."userId", u.name as "userName",
           COUNT(DISTINCT cs.id) as sesiones,
           COALESCE(SUM(DISTINCT rp.monto), 0) as "totalCobrado",
           COALESCE((
             SELECT SUM(mc2.monto) FROM "MovimientoCaja" mc2
             JOIN "CajaSesion" cs2 ON mc2."sesionId" = cs2.id
             WHERE cs2."userId" = cs."userId"
               AND cs2."createdAt" >= ${desde} AND cs2."createdAt" <= ${hasta}
               AND mc2.tipo = 'gasto'
               ${cajaSesionEmpresaFilter2}
           ), 0) as "totalGastos"
    FROM "CajaSesion" cs
    JOIN "User" u ON cs."userId" = u.id
    LEFT JOIN "RegistroPago" rp ON rp."sesionId" = cs.id
    WHERE cs."createdAt" >= ${desde} AND cs."createdAt" <= ${hasta}
      ${cajaSesionEmpresaFilter}
    GROUP BY cs."userId", u.name
    ORDER BY "totalCobrado" DESC
  `;

  const cajaPorEmpleado = cajaPorEmpleadoRaw.map((r) => ({
    userId: r.userId,
    userName: r.userName,
    sesiones: Number(r.sesiones),
    totalCobrado: Number(r.totalCobrado),
    totalGastos: Number(r.totalGastos),
  }));

  return NextResponse.json({
    periodo,
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    productos: productosConPct,
    metodosPago: metodosConPct,
    gastos,
    ingresos,
    evolucion,
    cajaPorEmpleado,
    totales: {
      cobrado: totalMetodos,
      gastado: gastos.reduce((s, g) => s + g.total, 0),
      ingresosExtra: ingresos.reduce((s, i) => s + i.total, 0),
    },
  });
}
