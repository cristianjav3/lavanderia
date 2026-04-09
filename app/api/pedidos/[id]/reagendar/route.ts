import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { fechaRetiro, franjaHoraria, direccionEntrega, telefonoContacto, observacionEntrega } = body;

  if (!fechaRetiro) {
    return NextResponse.json({ error: "fechaRetiro requerida" }, { status: 400 });
  }

  const fecha = new Date(fechaRetiro);

  // Update fields that exist in the generated Prisma client via ORM
  await prisma.pedido.update({
    where: { id },
    data: {
      fechaRetiro: fecha,
      franjaHoraria: franjaHoraria ?? null,
      updatedAt: new Date(),
    },
  });

  // Update fields added after prisma generate (raw SQL required due to EPERM on Windows)
  await prisma.$executeRaw`
    UPDATE "Pedido"
    SET "direccionEntrega"   = ${direccionEntrega ?? null},
        "telefonoContacto"   = ${telefonoContacto ?? null},
        "observacionEntrega" = ${observacionEntrega ?? null}
    WHERE id = ${id}
  `;

  return NextResponse.json({ ok: true });
}
