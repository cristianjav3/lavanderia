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
  const { tipo, conceptoId, descripcion, monto } = await req.json();

  if (!tipo || !monto || monto <= 0) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const user = session.user as { id: string };

  // Verificar que la sesión existe, está abierta y pertenece a este usuario
  const sesiones = await prisma.$queryRaw<{ estado: string; userId: string }[]>`
    SELECT estado, "userId" FROM "CajaSesion" WHERE id = ${sesionId}
  `;
  if (!sesiones[0] || sesiones[0].estado === "cerrado") {
    return NextResponse.json({ error: "No hay caja activa. Abrí caja antes de operar." }, { status: 400 });
  }
  if (sesiones[0].userId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const movId = crypto.randomUUID();

  if (conceptoId) {
    await prisma.$executeRaw`
      INSERT INTO "MovimientoCaja" (id, "sesionId", tipo, "conceptoId", descripcion, monto, "createdAt")
      VALUES (${movId}, ${sesionId}, ${tipo}::"TipoMovimiento", ${conceptoId}, ${descripcion ?? null}, ${Number(monto)}, NOW())
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO "MovimientoCaja" (id, "sesionId", tipo, "conceptoId", descripcion, monto, "createdAt")
      VALUES (${movId}, ${sesionId}, ${tipo}::"TipoMovimiento", NULL, ${descripcion ?? null}, ${Number(monto)}, NOW())
    `;
  }

  // Return the new movement with concepto name if applicable
  type MovRow = { id: string; sesionId: string; tipo: string; conceptoId: string | null; conceptoNombre: string | null; descripcion: string | null; monto: number; createdAt: Date };
  const rows = await prisma.$queryRaw<MovRow[]>`
    SELECT mc.id, mc."sesionId", mc.tipo, mc."conceptoId",
           cc.nombre AS "conceptoNombre", mc.descripcion, mc.monto, mc."createdAt"
    FROM "MovimientoCaja" mc
    LEFT JOIN "ConceptoCaja" cc ON mc."conceptoId" = cc.id
    WHERE mc.id = ${movId}
  `;

  const m = rows[0];
  return NextResponse.json({
    id: m.id,
    sesionId: m.sesionId,
    tipo: m.tipo,
    monto: Number(m.monto),
    descripcion: m.descripcion,
    concepto: m.conceptoNombre ? { id: m.conceptoId, nombre: m.conceptoNombre } : null,
    createdAt: m.createdAt,
  }, { status: 201 });
}
