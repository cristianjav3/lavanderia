import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId, pedidoPertenece } from "@/lib/empresa";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id: string }).id;
  const empresaId = await resolveEmpresaId(session.user as { empresaId?: string | null; role?: string });

  if (!await pedidoPertenece(id, empresaId)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Recepción automática: crear registro y pasar a por_lavar
  await prisma.recepcion.create({
    data: {
      pedidoId: id,
      empleadoId: userId,
      requiereValidacion: false,
    },
  });

  await prisma.pedido.update({
    where: { id },
    data: { estado: "por_lavar" },
  });

  return NextResponse.json({ ok: true });
}
