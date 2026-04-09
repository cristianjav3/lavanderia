import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId } from "@/lib/empresa";

type SessionUser = { id: string; role?: string; empresaId?: string | null };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const empresaId = await resolveEmpresaId(session.user as SessionUser);

  const hace7Dias = new Date();
  hace7Dias.setDate(hace7Dias.getDate() - 7);

  // Mover pedidos listos hace más de 7 días a depósito (solo de esta empresa)
  await prisma.pedido.updateMany({
    where: {
      ...(empresaId ? { empresaId: empresaId as never } : {}),
      estado: { in: ["listo", "en_sucursal"] },
      updatedAt: { lt: hace7Dias },
      enDeposito: false,
    },
    data: {
      enDeposito: true,
      estado: "deposito",
    },
  });

  const pedidos = await prisma.pedido.findMany({
    where: {
      ...(empresaId ? { empresaId: empresaId as never } : {}),
      enDeposito: true,
    },
    include: { cliente: true, items: true },
    orderBy: { updatedAt: "asc" },
  });

  return NextResponse.json(pedidos);
}
