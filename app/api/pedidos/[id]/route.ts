import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId, pedidoPertenece } from "@/lib/empresa";

type DeliveryFields = {
  direccionEntrega: string | null;
  telefonoContacto: string | null;
  observacionEntrega: string | null;
};

type PedidoItemRow = {
  id: string;
  nombreProducto: string;
  precioUnitario: number;
  cantidad: number;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const empresaId = await resolveEmpresaId(session.user as { empresaId?: string | null; role?: string });

  if (!await pedidoPertenece(id, empresaId)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: {
      cliente: true,
      items: true,
      paquetes: true,
      recepcion: { include: { empleado: true } },
      observaciones: true,
      fotos: true,
      entregas: true,
    },
  });

  if (!pedido) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const [extra, pedidoItems] = await Promise.all([
    prisma.$queryRaw<DeliveryFields[]>`
      SELECT "direccionEntrega", "telefonoContacto", "observacionEntrega"
      FROM "Pedido" WHERE id = ${id}
    `,
    prisma.$queryRaw<PedidoItemRow[]>`
      SELECT id, "nombreProducto", "precioUnitario", cantidad
      FROM "PedidoItem" WHERE "pedidoId" = ${id}
      ORDER BY "createdAt" ASC
    `,
  ]);

  return NextResponse.json({ ...pedido, ...(extra[0] ?? {}), pedidoItems });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const empresaId = await resolveEmpresaId(session.user as { empresaId?: string | null; role?: string });

  if (!await pedidoPertenece(id, empresaId)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = await req.json();

  const pedido = await prisma.pedido.update({
    where: { id },
    data: body,
    include: { cliente: true, items: true },
  });

  return NextResponse.json(pedido);
}
