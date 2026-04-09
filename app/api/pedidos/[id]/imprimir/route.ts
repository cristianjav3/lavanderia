import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId, pedidoPertenece } from "@/lib/empresa";

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

  type Row = { printCount: number };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "printCount" FROM "Pedido" WHERE id = ${id}
  `;
  if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({ printCount: Number(rows[0].printCount) });
}

export async function POST(
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

  await prisma.$executeRaw`
    UPDATE "Pedido" SET "printCount" = "printCount" + 1 WHERE id = ${id}
  `;

  type Row = { printCount: number };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "printCount" FROM "Pedido" WHERE id = ${id}
  `;

  return NextResponse.json({ printCount: Number(rows[0]?.printCount ?? 0) });
}
