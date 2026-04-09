import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type ConfigRow = { id: string; dia: number; activo: boolean; franjas: unknown };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Public read — all authenticated users can read chofer config (needed for slot picker in nuevo pedido)
  const rows = await prisma.$queryRaw<ConfigRow[]>`
    SELECT id, dia, activo, franjas
    FROM "ConfiguracionChofer"
    ORDER BY dia ASC
  `;

  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  }

  const { dia, activo, franjas } = await req.json();

  if (dia === undefined || dia === null) {
    return NextResponse.json({ error: "dia requerido" }, { status: 400 });
  }

  const franjasJson = JSON.stringify(franjas ?? []);

  if (activo !== undefined && franjas !== undefined) {
    await prisma.$executeRaw`
      UPDATE "ConfiguracionChofer"
      SET activo = ${activo}, franjas = ${franjasJson}::jsonb, "updatedAt" = NOW()
      WHERE dia = ${dia}
    `;
  } else if (activo !== undefined) {
    await prisma.$executeRaw`
      UPDATE "ConfiguracionChofer"
      SET activo = ${activo}, "updatedAt" = NOW()
      WHERE dia = ${dia}
    `;
  } else if (franjas !== undefined) {
    await prisma.$executeRaw`
      UPDATE "ConfiguracionChofer"
      SET franjas = ${franjasJson}::jsonb, "updatedAt" = NOW()
      WHERE dia = ${dia}
    `;
  }

  const updated = await prisma.$queryRaw<ConfigRow[]>`
    SELECT id, dia, activo, franjas FROM "ConfiguracionChofer" WHERE dia = ${dia}
  `;

  return NextResponse.json(updated[0] ?? { dia });
}
