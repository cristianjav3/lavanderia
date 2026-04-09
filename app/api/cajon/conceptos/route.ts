import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const conceptos = await prisma.conceptoCaja.findMany({
    where: { activo: true },
    orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
  });

  return NextResponse.json(conceptos);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { nombre, tipo } = await req.json();

  if (!nombre?.trim() || !tipo) {
    return NextResponse.json({ error: "Nombre y tipo requeridos" }, { status: 400 });
  }

  const existe = await prisma.conceptoCaja.findUnique({ where: { nombre: nombre.trim() } });
  if (existe) {
    // Reactivar si estaba inactivo
    if (!existe.activo) {
      const updated = await prisma.conceptoCaja.update({
        where: { nombre: nombre.trim() },
        data: { activo: true },
      });
      return NextResponse.json(updated);
    }
    return NextResponse.json({ error: "Ya existe ese concepto" }, { status: 400 });
  }

  const concepto = await prisma.conceptoCaja.create({
    data: { nombre: nombre.trim(), tipo },
  });

  return NextResponse.json(concepto, { status: 201 });
}
