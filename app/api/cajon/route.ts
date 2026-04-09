import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId } from "@/lib/empresa";

type SessionUser = { id: string; role?: string; empresaId?: string | null };

// Raw SQL helpers — work regardless of Prisma client regeneration state

type SesionRow = {
  id: string;
  userId: string;
  sucursalId: string | null;
  saldoInicial: number;
  saldoFinal: number | null;
  fechaCierre: Date | null;
  estado: string;
  createdAt: Date;
  userName: string;
  sucursalNombre: string | null;
};

type MovimientoRow = {
  id: string;
  sesionId: string;
  tipo: string;
  conceptoId: string | null;
  conceptoNombre: string | null;
  descripcion: string | null;
  monto: number;
  createdAt: Date;
};

async function getSesionConMovimientos(sesionId: string) {
  const [sesiones, movimientos] = await Promise.all([
    prisma.$queryRaw<SesionRow[]>`
      SELECT cs.id, cs."userId", cs."sucursalId", cs."saldoInicial", cs."saldoFinal",
             cs."fechaCierre", cs.estado, cs."createdAt",
             u.name AS "userName", s.nombre AS "sucursalNombre"
      FROM "CajaSesion" cs
      JOIN "User" u ON cs."userId" = u.id
      LEFT JOIN "Sucursal" s ON cs."sucursalId" = s.id
      WHERE cs.id = ${sesionId}
    `,
    prisma.$queryRaw<MovimientoRow[]>`
      SELECT mc.id, mc."sesionId", mc.tipo, mc."conceptoId",
             cc.nombre AS "conceptoNombre", mc.descripcion, mc.monto, mc."createdAt"
      FROM "MovimientoCaja" mc
      LEFT JOIN "ConceptoCaja" cc ON mc."conceptoId" = cc.id
      WHERE mc."sesionId" = ${sesionId}
      ORDER BY mc."createdAt" ASC
    `,
  ]);

  if (!sesiones[0]) return null;
  const s = sesiones[0];
  return formatSesion(s, movimientos.filter((m) => m.sesionId === sesionId));
}

function formatSesion(s: SesionRow, movimientos: MovimientoRow[]) {
  return {
    id: s.id,
    userId: s.userId,
    saldoInicial: Number(s.saldoInicial),
    saldoFinal: s.saldoFinal !== null ? Number(s.saldoFinal) : null,
    fechaCierre: s.fechaCierre,
    estado: s.estado,
    createdAt: s.createdAt,
    user: {
      name: s.userName,
      sucursal: s.sucursalNombre ? { nombre: s.sucursalNombre } : null,
    },
    movimientos: movimientos.map((m) => ({
      id: m.id,
      sesionId: m.sesionId,
      tipo: m.tipo,
      monto: Number(m.monto),
      descripcion: m.descripcion,
      concepto: m.conceptoNombre ? { id: m.conceptoId, nombre: m.conceptoNombre } : null,
      createdAt: m.createdAt,
    })),
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as SessionUser;
  const empresaId = await resolveEmpresaId(user);

  // Admin: devuelve sesiones con filtros opcionales de fecha y empleado
  if (user.role === "admin") {
    const { searchParams } = new URL(req.url);
    const desdeParam = searchParams.get("desde");
    const hastaParam = searchParams.get("hasta");
    const empleadoId = searchParams.get("empleadoId");

    const inicio = desdeParam
      ? new Date(desdeParam + "T00:00:00")
      : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
    const fin = hastaParam
      ? new Date(hastaParam + "T23:59:59")
      : (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; })();

    const sesiones = empleadoId
      ? empresaId
        ? await prisma.$queryRaw<SesionRow[]>`
            SELECT cs.id, cs."userId", cs."sucursalId", cs."saldoInicial", cs."saldoFinal",
                   cs."fechaCierre", cs.estado, cs."createdAt",
                   u.name AS "userName", s.nombre AS "sucursalNombre"
            FROM "CajaSesion" cs
            JOIN "User" u ON cs."userId" = u.id
            LEFT JOIN "Sucursal" s ON cs."sucursalId" = s.id
            WHERE cs."createdAt" >= ${inicio} AND cs."createdAt" <= ${fin}
              AND cs."userId" = ${empleadoId}
              AND cs."empresaId" = ${empresaId}
            ORDER BY cs."createdAt" DESC
          `
        : await prisma.$queryRaw<SesionRow[]>`
            SELECT cs.id, cs."userId", cs."sucursalId", cs."saldoInicial", cs."saldoFinal",
                   cs."fechaCierre", cs.estado, cs."createdAt",
                   u.name AS "userName", s.nombre AS "sucursalNombre"
            FROM "CajaSesion" cs
            JOIN "User" u ON cs."userId" = u.id
            LEFT JOIN "Sucursal" s ON cs."sucursalId" = s.id
            WHERE cs."createdAt" >= ${inicio} AND cs."createdAt" <= ${fin}
              AND cs."userId" = ${empleadoId}
            ORDER BY cs."createdAt" DESC
          `
      : empresaId
        ? await prisma.$queryRaw<SesionRow[]>`
            SELECT cs.id, cs."userId", cs."sucursalId", cs."saldoInicial", cs."saldoFinal",
                   cs."fechaCierre", cs.estado, cs."createdAt",
                   u.name AS "userName", s.nombre AS "sucursalNombre"
            FROM "CajaSesion" cs
            JOIN "User" u ON cs."userId" = u.id
            LEFT JOIN "Sucursal" s ON cs."sucursalId" = s.id
            WHERE cs."createdAt" >= ${inicio} AND cs."createdAt" <= ${fin}
              AND cs."empresaId" = ${empresaId}
            ORDER BY cs."createdAt" DESC
          `
        : await prisma.$queryRaw<SesionRow[]>`
            SELECT cs.id, cs."userId", cs."sucursalId", cs."saldoInicial", cs."saldoFinal",
                   cs."fechaCierre", cs.estado, cs."createdAt",
                   u.name AS "userName", s.nombre AS "sucursalNombre"
            FROM "CajaSesion" cs
            JOIN "User" u ON cs."userId" = u.id
            LEFT JOIN "Sucursal" s ON cs."sucursalId" = s.id
            WHERE cs."createdAt" >= ${inicio} AND cs."createdAt" <= ${fin}
            ORDER BY cs."createdAt" DESC
          `;

    const [movs] = sesiones.length > 0
      ? await Promise.all([
          prisma.$queryRaw<MovimientoRow[]>`
            SELECT mc.id, mc."sesionId", mc.tipo, mc."conceptoId",
                   cc.nombre AS "conceptoNombre", mc.descripcion, mc.monto, mc."createdAt"
            FROM "MovimientoCaja" mc
            LEFT JOIN "ConceptoCaja" cc ON mc."conceptoId" = cc.id
            WHERE mc."sesionId" = ANY(${sesiones.map((s) => s.id)}::text[])
            ORDER BY mc."createdAt" ASC
          `,
        ])
      : [[]];

    const cajones = sesiones.map((s) =>
      formatSesion(s, (movs as MovimientoRow[]).filter((m) => m.sesionId === s.id))
    );

    // Incluir también sesiones abiertas de esta empresa para que admin pueda cerrarlas
    const sesionesAbiertas = empresaId
      ? await prisma.$queryRaw<SesionRow[]>`
          SELECT cs.id, cs."userId", cs."sucursalId", cs."saldoInicial", cs."saldoFinal",
                 cs."fechaCierre", cs.estado, cs."createdAt",
                 u.name AS "userName", s.nombre AS "sucursalNombre"
          FROM "CajaSesion" cs
          JOIN "User" u ON cs."userId" = u.id
          LEFT JOIN "Sucursal" s ON cs."sucursalId" = s.id
          WHERE cs.estado = 'abierto' AND cs."empresaId" = ${empresaId}
          ORDER BY cs."createdAt" ASC
        `
      : await prisma.$queryRaw<SesionRow[]>`
          SELECT cs.id, cs."userId", cs."sucursalId", cs."saldoInicial", cs."saldoFinal",
                 cs."fechaCierre", cs.estado, cs."createdAt",
                 u.name AS "userName", s.nombre AS "sucursalNombre"
          FROM "CajaSesion" cs
          JOIN "User" u ON cs."userId" = u.id
          LEFT JOIN "Sucursal" s ON cs."sucursalId" = s.id
          WHERE cs.estado = 'abierto'
          ORDER BY cs."createdAt" ASC
        `;

    const sesionesAbiertasFormateadas = sesionesAbiertas.map((s) => formatSesion(s, []));

    return NextResponse.json({ admin: true, cajones, sesionesAbiertas: sesionesAbiertasFormateadas });
  }

  // Empleado: primero buscar sesión de hoy (abierta primero, luego cerrada).
  const hoyInicio = new Date(); hoyInicio.setHours(0, 0, 0, 0);
  const hoyFin = new Date(); hoyFin.setHours(23, 59, 59, 999);

  const sesionesHoy = await prisma.$queryRaw<SesionRow[]>`
    SELECT cs.id, cs."userId", cs."sucursalId", cs."saldoInicial", cs."saldoFinal",
           cs."fechaCierre", cs.estado, cs."createdAt",
           u.name AS "userName", s.nombre AS "sucursalNombre"
    FROM "CajaSesion" cs
    JOIN "User" u ON cs."userId" = u.id
    LEFT JOIN "Sucursal" s ON cs."sucursalId" = s.id
    WHERE cs."userId" = ${user.id}
      AND cs."createdAt" >= ${hoyInicio}
      AND cs."createdAt" <= ${hoyFin}
    ORDER BY cs.estado ASC, cs."createdAt" DESC
    LIMIT 1
  `;

  if (sesionesHoy[0]) {
    const sesion = await getSesionConMovimientos(sesionesHoy[0].id);
    return NextResponse.json(sesion);
  }

  // Sin sesión hoy: buscar sesión abierta de días anteriores
  const sesionesAbiertasPrevias = await prisma.$queryRaw<SesionRow[]>`
    SELECT cs.id, cs."userId", cs."sucursalId", cs."saldoInicial", cs."saldoFinal",
           cs."fechaCierre", cs.estado, cs."createdAt",
           u.name AS "userName", s.nombre AS "sucursalNombre"
    FROM "CajaSesion" cs
    JOIN "User" u ON cs."userId" = u.id
    LEFT JOIN "Sucursal" s ON cs."sucursalId" = s.id
    WHERE cs."userId" = ${user.id}
      AND cs.estado = 'abierto'
    ORDER BY cs."createdAt" DESC
    LIMIT 1
  `;

  if (!sesionesAbiertasPrevias[0]) return NextResponse.json(null);

  const sesion = await getSesionConMovimientos(sesionesAbiertasPrevias[0].id);
  return NextResponse.json(sesion);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as SessionUser;
  const userId = user.id;
  const empresaId = await resolveEmpresaId(user);
  const { apertura } = await req.json();

  if (!apertura && apertura !== 0) {
    return NextResponse.json({ error: "Monto de apertura inválido" }, { status: 400 });
  }
  if (Number(apertura) < 0) {
    return NextResponse.json({ error: "Monto de apertura inválido" }, { status: 400 });
  }

  // Bloquear solo si hay sesión ABIERTA
  const abierta = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "CajaSesion"
    WHERE "userId" = ${userId} AND estado = 'abierto'
    LIMIT 1
  `;
  if (abierta.length > 0) {
    return NextResponse.json({ error: "Ya hay una caja abierta" }, { status: 400 });
  }

  const userRow = await prisma.user.findUnique({ where: { id: userId }, select: { sucursalId: true } });
  const sucursalId = userRow?.sucursalId ?? null;
  const id = crypto.randomUUID();

  if (sucursalId) {
    await prisma.$executeRaw`
      INSERT INTO "CajaSesion" (id, "userId", "sucursalId", "empresaId", "saldoInicial", estado, "createdAt")
      VALUES (${id}, ${userId}, ${sucursalId}, ${empresaId}, ${Number(apertura)}, 'abierto', NOW())
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO "CajaSesion" (id, "userId", "sucursalId", "empresaId", "saldoInicial", estado, "createdAt")
      VALUES (${id}, ${userId}, NULL, ${empresaId}, ${Number(apertura)}, 'abierto', NOW())
    `;
  }

  const sesion = await getSesionConMovimientos(id);
  return NextResponse.json(sesion, { status: 201 });
}
