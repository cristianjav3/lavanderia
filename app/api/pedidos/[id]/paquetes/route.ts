import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calcularCanastos } from "@/lib/constants";
import { resolveEmpresaId, pedidoPertenece } from "@/lib/empresa";

export async function POST(
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
    include: { items: true, paquetes: true },
  });

  if (!pedido) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Borrar paquetes existentes
  await prisma.paquete.deleteMany({ where: { pedidoId: id } });

  const paquetes = [];

  for (const item of pedido.items) {
    if (item.tipo === "canasto") {
      const numCanastos = calcularCanastos(item.cantidad);
      for (let i = 1; i <= numCanastos; i++) {
        paquetes.push({
          pedidoId: id,
          tipo: "canasto" as const,
          numero: i,
          totalPaquetes: numCanastos,
        });
      }
    }
    if (item.tipo === "acolchado") {
      for (let i = 1; i <= item.cantidad; i++) {
        paquetes.push({
          pedidoId: id,
          tipo: "acolchado" as const,
          numero: i,
          totalPaquetes: item.cantidad,
        });
      }
    }
  }

  await prisma.paquete.createMany({ data: paquetes });

  return NextResponse.json({ paquetes: paquetes.length });
}
