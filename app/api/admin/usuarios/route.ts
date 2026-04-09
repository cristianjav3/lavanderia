import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId } from "@/lib/empresa";
import bcrypt from "bcryptjs";

type SessionUser = { id: string; role: string; empresaId?: string | null };

function soloAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as { role: string }).role !== "admin")
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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = soloAdmin(session);
  if (err) return err;

  const empresaId = await resolveEmpresaId(session!.user as SessionUser);

  const usuarios = await prisma.user.findMany({
    where: {
      ...(empresaId ? { empresaId: empresaId as never } : {}),
    },
    orderBy: { name: "asc" },
    select: SELECT_USUARIO,
  });

  return NextResponse.json(usuarios);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = soloAdmin(session);
  if (err) return err;

  const empresaId = await resolveEmpresaId(session!.user as SessionUser);
  const { name, email, password, role, sucursalId, telefono } = await req.json();

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "Nombre, email y contraseña son requeridos" }, { status: 400 });
  }

  const existe = await prisma.user.findUnique({ where: { email } });
  if (existe) return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 400 });

  const hash = await bcrypt.hash(password, 10);

  const usuario = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hash,
      telefono: telefono?.trim() || null,
      role: role ?? "empleado",
      sucursalId: sucursalId || null,
      ...(empresaId ? { empresaId: empresaId as never } : {}),
    },
    select: SELECT_USUARIO,
  });

  return NextResponse.json(usuario, { status: 201 });
}
