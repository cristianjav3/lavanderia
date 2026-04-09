import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId, pedidoPertenece } from "@/lib/empresa";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { estado, motivo } = body;

  if (!estado) return NextResponse.json({ error: "Estado requerido" }, { status: 400 });

  const user = session.user as { id: string; name?: string | null; empresaId?: string | null; role?: string };
  const empresaId = await resolveEmpresaId(user);

  if (!await pedidoPertenece(id, empresaId)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Fetch current state for audit log (raw SQL to avoid stale client)
  type EstadoRow = { id: string; estado: string };
  const rows = await prisma.$queryRaw<EstadoRow[]>`
    SELECT id, estado FROM "Pedido" WHERE id = ${id}
  `;
  if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const estadoAnterior = rows[0].estado;

  // Update state
  await prisma.$executeRaw`
    UPDATE "Pedido" SET estado = ${estado}::"EstadoPedido", "updatedAt" = NOW()
    WHERE id = ${id}
  `;

  // Insert audit log
  const logId = crypto.randomUUID();
  const userName = user.name ?? "Sistema";
  await prisma.$executeRaw`
    INSERT INTO "LogEstadoPedido" (id, "pedidoId", "estadoAnterior", "estadoNuevo", "userId", "userName", motivo, "createdAt")
    VALUES (${logId}, ${id}, ${estadoAnterior}, ${estado}, ${user.id}, ${userName}, ${motivo ?? null}, NOW())
  `;

  // Return updated pedido (using Prisma ORM — still works for existing models)
  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: { cliente: true },
  });

  return NextResponse.json(pedido);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const user = session.user as { empresaId?: string | null; role?: string };
  const empresaId = await resolveEmpresaId(user);

  if (!await pedidoPertenece(id, empresaId)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  type LogRow = {
    id: string; estadoAnterior: string; estadoNuevo: string;
    userName: string; motivo: string | null; createdAt: Date;
  };
  const logs = await prisma.$queryRaw<LogRow[]>`
    SELECT id, "estadoAnterior", "estadoNuevo", "userName", motivo, "createdAt"
    FROM "LogEstadoPedido"
    WHERE "pedidoId" = ${id}
    ORDER BY "createdAt" ASC
  `;

  return NextResponse.json(logs);
}
