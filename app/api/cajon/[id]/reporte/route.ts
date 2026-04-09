import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId } from "@/lib/empresa";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: sesionId } = await params;
  const user = session.user as { id: string; role?: string; empresaId?: string | null };
  const isAdmin = user.role === "admin";
  const empresaId = await resolveEmpresaId(user);

  // Load session
  type SesionRow = {
    id: string; userId: string; empresaId: string | null; saldoInicial: number; saldoFinal: number | null;
    estado: string; createdAt: Date; fechaCierre: Date | null; userName: string;
  };
  const sesiones = await prisma.$queryRaw<SesionRow[]>`
    SELECT cs.id, cs."userId", cs."empresaId", cs."saldoInicial", cs."saldoFinal",
           cs.estado, cs."createdAt", cs."fechaCierre", u.name AS "userName"
    FROM "CajaSesion" cs
    JOIN "User" u ON cs."userId" = u.id
    WHERE cs.id = ${sesionId}
  `;
  if (!sesiones[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const s = sesiones[0];

  // Verify ownership: admins must match empresa, employees must own the session
  if (isAdmin) {
    if (empresaId && s.empresaId !== empresaId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
  } else {
    if (s.userId !== user.id) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
  }

  // Load movements for THIS session only
  type MovRow = {
    id: string; tipo: string; conceptoId: string | null;
    conceptoNombre: string | null; descripcion: string | null; monto: number; createdAt: Date;
  };
  const movimientos = await prisma.$queryRaw<MovRow[]>`
    SELECT mc.id, mc.tipo, mc."conceptoId",
           cc.nombre AS "conceptoNombre", mc.descripcion, mc.monto, mc."createdAt"
    FROM "MovimientoCaja" mc
    LEFT JOIN "ConceptoCaja" cc ON mc."conceptoId" = cc.id
    WHERE mc."sesionId" = ${sesionId}
    ORDER BY mc."createdAt" ASC
  `;

  // Load payment records for THIS session only
  type PagoRow = {
    id: string; monto: number; metodoPago: string; createdAt: Date;
    pedidoNumero: number; pedidoTotal: number; clienteNombre: string;
  };
  const pagos = await prisma.$queryRaw<PagoRow[]>`
    SELECT rp.id, rp.monto, rp."metodoPago", rp."createdAt",
           p.numero AS "pedidoNumero", p.total AS "pedidoTotal",
           c.nombre AS "clienteNombre"
    FROM "RegistroPago" rp
    JOIN "Pedido" p ON rp."pedidoId" = p.id
    JOIN "Cliente" c ON p."clienteId" = c.id
    WHERE rp."sesionId" = ${sesionId}
    ORDER BY rp."createdAt" ASC
  `;

  const cajon = {
    id: s.id,
    saldoInicial: Number(s.saldoInicial),
    saldoFinal: s.saldoFinal !== null ? Number(s.saldoFinal) : null,
    estado: s.estado,
    createdAt: s.createdAt,
    fechaCierre: s.fechaCierre,
    user: { name: s.userName },
    movimientos: movimientos.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      monto: Number(m.monto),
      descripcion: m.descripcion,
      concepto: m.conceptoNombre ? { id: m.conceptoId, nombre: m.conceptoNombre } : null,
      createdAt: m.createdAt,
    })),
  };

  const pagosFormateados = pagos.map((p) => ({
    id: p.id,
    monto: Number(p.monto),
    metodoPago: p.metodoPago,
    createdAt: p.createdAt,
    pedido: {
      numero: Number(p.pedidoNumero),
      total: Number(p.pedidoTotal),
      cliente: { nombre: p.clienteNombre },
    },
  }));

  return NextResponse.json({ cajon, pagos: pagosFormateados });
}
