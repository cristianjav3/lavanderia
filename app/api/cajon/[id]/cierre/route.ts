import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: sesionId } = await params;
  const { cierre } = await req.json();

  if (cierre === undefined || cierre === null || Number(cierre) < 0) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  }

  const user = session.user as { id: string };

  const sesiones = await prisma.$queryRaw<{ estado: string; userId: string }[]>`
    SELECT estado, "userId" FROM "CajaSesion" WHERE id = ${sesionId}
  `;
  if (!sesiones[0] || sesiones[0].estado === "cerrado") {
    return NextResponse.json({ error: "Sesión no disponible" }, { status: 400 });
  }
  if (sesiones[0].userId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await prisma.$executeRaw`
    UPDATE "CajaSesion"
    SET "saldoFinal" = ${Number(cierre)},
        "fechaCierre" = NOW(),
        estado = 'cerrado'
    WHERE id = ${sesionId}
  `;

  // Return updated session
  type SesionRow = { id: string; saldoInicial: number; saldoFinal: number | null; estado: string; createdAt: Date; fechaCierre: Date | null };
  const rows = await prisma.$queryRaw<SesionRow[]>`
    SELECT id, "saldoInicial", "saldoFinal", estado, "createdAt", "fechaCierre"
    FROM "CajaSesion" WHERE id = ${sesionId}
  `;

  type MovRow = { id: string; tipo: string; conceptoId: string | null; conceptoNombre: string | null; descripcion: string | null; monto: number; createdAt: Date };
  const movs = await prisma.$queryRaw<MovRow[]>`
    SELECT mc.id, mc.tipo, mc."conceptoId",
           cc.nombre AS "conceptoNombre", mc.descripcion, mc.monto, mc."createdAt"
    FROM "MovimientoCaja" mc
    LEFT JOIN "ConceptoCaja" cc ON mc."conceptoId" = cc.id
    WHERE mc."sesionId" = ${sesionId}
    ORDER BY mc."createdAt" ASC
  `;

  const s = rows[0];
  return NextResponse.json({
    id: s.id,
    saldoInicial: Number(s.saldoInicial),
    saldoFinal: s.saldoFinal !== null ? Number(s.saldoFinal) : null,
    estado: s.estado,
    fechaCierre: s.fechaCierre,
    createdAt: s.createdAt,
    movimientos: movs.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      monto: Number(m.monto),
      descripcion: m.descripcion,
      concepto: m.conceptoNombre ? { id: m.conceptoId, nombre: m.conceptoNombre } : null,
      createdAt: m.createdAt,
    })),
  });
}
