import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { resolveEmpresaId } from "@/lib/empresa";

function soloAdmin(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user?.role !== "admin")
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  return null;
}

const SELECT_USUARIO = {
  id: true,
  name: true,
  email: true,
  telefono: true,
  role: true,
  activo: true,
  sucursalId: true,
  createdAt: true,
  sucursal: { select: { id: true, nombre: true } },
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const err = soloAdmin(session);
  if (err) return err;

  const { id } = await params;
  const { name, email, password, role, sucursalId, activo, telefono } = await req.json();

  const empresaId = await resolveEmpresaId(session!.user as { empresaId?: string | null; role?: string });

  // Verify user belongs to the active empresa
  if (empresaId) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE id = ${id} AND "empresaId" = ${empresaId} LIMIT 1
    `;
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim();
  if (email !== undefined) data.email = email.trim().toLowerCase();
  if (role !== undefined) data.role = role;
  if (sucursalId !== undefined) data.sucursalId = sucursalId || null;
  if (activo !== undefined) data.activo = activo;
  if (telefono !== undefined) data.telefono = telefono?.trim() || null;
  if (password) data.password = await bcrypt.hash(password, 10);

  const usuario = await prisma.user.update({
    where: { id },
    data,
    select: SELECT_USUARIO,
  });

  return NextResponse.json(usuario);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const err = soloAdmin(session);
  if (err) return err;

  const { id } = await params;

  const empresaId = await resolveEmpresaId(session!.user as { empresaId?: string | null; role?: string });

  // Verify user belongs to the active empresa
  if (empresaId) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE id = ${id} AND "empresaId" = ${empresaId} LIMIT 1
    `;
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Verificar si tiene operaciones asociadas
  const [pedidosCount, sesionesCount, recepcionesCount] = await Promise.all([
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "Pedido"
      JOIN "Recepcion" ON "Recepcion"."empleadoId" = ${id}
        AND "Recepcion"."pedidoId" = "Pedido"."id"
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "CajaSesion" WHERE "userId" = ${id}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "Recepcion" WHERE "empleadoId" = ${id}
    `,
  ]);

  const tieneOperaciones =
    Number(pedidosCount[0]?.count ?? 0) > 0 ||
    Number(sesionesCount[0]?.count ?? 0) > 0 ||
    Number(recepcionesCount[0]?.count ?? 0) > 0;

  if (tieneOperaciones) {
    return NextResponse.json(
      {
        error: "El empleado tiene operaciones registradas. Se recomienda desactivarlo en lugar de eliminarlo.",
        tieneOperaciones: true,
      },
      { status: 409 }
    );
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
