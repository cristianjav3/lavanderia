import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId } from "@/lib/empresa";

type SessionUser = { id: string; role?: string; empresaId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const stats = searchParams.get("stats");

  const { role } = session.user as SessionUser;
  const empresaId = await resolveEmpresaId(session.user as SessionUser);

  // Admin historial: returns aggregated stats per cliente
  if (stats === "1") {
    if (role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    type ClienteStats = {
      id: string;
      nombre: string;
      telefono: string;
      totalPedidos: bigint;
      totalGastado: number;
      ultimaCompra: Date | null;
    };

    const rows = empresaId
      ? await prisma.$queryRaw<ClienteStats[]>`
          SELECT
            c.id,
            c.nombre,
            c.telefono,
            COUNT(p.id) AS "totalPedidos",
            COALESCE(SUM(p.total), 0) AS "totalGastado",
            MAX(p."createdAt") AS "ultimaCompra"
          FROM "Cliente" c
          LEFT JOIN "Pedido" p ON p."clienteId" = c.id
          WHERE c."empresaId" = ${empresaId}
          GROUP BY c.id, c.nombre, c.telefono
          ORDER BY COUNT(p.id) DESC, c.nombre ASC
        `
      : await prisma.$queryRaw<ClienteStats[]>`
          SELECT
            c.id,
            c.nombre,
            c.telefono,
            COUNT(p.id) AS "totalPedidos",
            COALESCE(SUM(p.total), 0) AS "totalGastado",
            MAX(p."createdAt") AS "ultimaCompra"
          FROM "Cliente" c
          LEFT JOIN "Pedido" p ON p."clienteId" = c.id
          GROUP BY c.id, c.nombre, c.telefono
          ORDER BY COUNT(p.id) DESC, c.nombre ASC
        `;

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        telefono: r.telefono,
        totalPedidos: Number(r.totalPedidos),
        totalGastado: Number(r.totalGastado),
        ultimaCompra: r.ultimaCompra,
      }))
    );
  }

  const clientes = await prisma.cliente.findMany({
    where: {
      ...(empresaId ? { empresaId: empresaId as never } : {}),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: "insensitive" } },
              { telefono: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(clientes);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { nombre, telefono, direccion } = body;

  if (!nombre || !telefono) {
    return NextResponse.json({ error: "Nombre y teléfono son requeridos" }, { status: 400 });
  }

  const empresaId = await resolveEmpresaId(session.user as SessionUser);

  const cliente = await prisma.cliente.create({
    data: {
      nombre,
      telefono,
      direccion,
      ...(empresaId ? { empresaId: empresaId as never } : {}),
    },
  });

  return NextResponse.json(cliente, { status: 201 });
}
