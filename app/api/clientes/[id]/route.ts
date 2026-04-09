import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId } from "@/lib/empresa";

type SessionUser = { empresaId?: string | null; role?: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as { role: string }).role !== "admin") {
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  }

  const { id } = await params;
  const empresaId = await resolveEmpresaId(session.user as SessionUser);

  type PedidoRow = {
    id: string; numero: number; estado: string; estadoPago: string;
    total: number; pagado: number; saldo: number; tipoEntrega: string; createdAt: Date;
  };
  type ItemRow = { pedidoId: string; tipo: string; cantidad: number };

  const pedidos = empresaId
    ? await prisma.$queryRaw<PedidoRow[]>`
        SELECT id, numero, estado, "estadoPago", total, pagado, saldo, "tipoEntrega", "createdAt"
        FROM "Pedido"
        WHERE "clienteId" = ${id} AND "empresaId" = ${empresaId}
        ORDER BY "createdAt" DESC
      `
    : await prisma.$queryRaw<PedidoRow[]>`
        SELECT id, numero, estado, "estadoPago", total, pagado, saldo, "tipoEntrega", "createdAt"
        FROM "Pedido"
        WHERE "clienteId" = ${id}
        ORDER BY "createdAt" DESC
      `;

  if (pedidos.length === 0) return NextResponse.json([]);

  const pedidoIds = pedidos.map((p) => p.id);
  const items = await prisma.$queryRaw<ItemRow[]>`
    SELECT "pedidoId", tipo, cantidad
    FROM "Item"
    WHERE "pedidoId" = ANY(${pedidoIds}::text[])
  `;

  const itemsByPedido = new Map<string, { tipo: string; cantidad: number }[]>();
  for (const item of items) {
    if (!itemsByPedido.has(item.pedidoId)) itemsByPedido.set(item.pedidoId, []);
    itemsByPedido.get(item.pedidoId)!.push({ tipo: item.tipo, cantidad: Number(item.cantidad) });
  }

  return NextResponse.json(
    pedidos.map((p) => ({
      id: p.id,
      numero: Number(p.numero),
      estado: p.estado,
      estadoPago: p.estadoPago,
      total: Number(p.total),
      pagado: Number(p.pagado),
      saldo: Number(p.saldo),
      tipoEntrega: p.tipoEntrega,
      createdAt: p.createdAt,
      items: itemsByPedido.get(p.id) ?? [],
    }))
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const { telefono } = await req.json();

  if (!telefono || !telefono.trim()) {
    return NextResponse.json({ error: "Teléfono requerido" }, { status: 400 });
  }

  const empresaId = await resolveEmpresaId(session.user as SessionUser);

  if (empresaId) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Cliente" WHERE id = ${id} AND "empresaId" = ${empresaId} LIMIT 1
    `;
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.$executeRaw`UPDATE "Cliente" SET telefono = ${telefono.trim()} WHERE id = ${id}`;

  const rows = await prisma.$queryRaw<{ id: string; nombre: string; telefono: string; direccion: string | null }[]>`
    SELECT id, nombre, telefono, direccion FROM "Cliente" WHERE id = ${id}
  `;
  return NextResponse.json(rows[0] ?? { id });
}
