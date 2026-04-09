import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId } from "@/lib/empresa";

type SessionUser = { id: string; role?: string; empresaId?: string | null };
type SucursalRow = { id: string; nombre: string; direccion: string | null; telefono: string | null };

function soloAuth(session: Awaited<ReturnType<typeof getServerSession>>) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return null;
}
function soloAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
  const auth = soloAuth(session);
  if (auth) return auth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session as any).user?.role !== "admin") {
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const err = soloAuth(session);
  if (err) return err;

  const empresaId = await resolveEmpresaId(session!.user as SessionUser);

  const rows = empresaId
    ? await prisma.$queryRaw<SucursalRow[]>`
        SELECT id, nombre, direccion, telefono
        FROM "Sucursal"
        WHERE activa = true AND "empresaId" = ${empresaId}
        ORDER BY nombre ASC
      `
    : await prisma.$queryRaw<SucursalRow[]>`
        SELECT id, nombre, direccion, telefono
        FROM "Sucursal"
        WHERE activa = true
        ORDER BY nombre ASC
      `;

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = soloAdmin(session);
  if (err) return err;

  const empresaId = await resolveEmpresaId(session!.user as SessionUser);
  const { nombre, direccion, telefono } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  const id = crypto.randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "Sucursal" (id, nombre, direccion, telefono, activa, "empresaId")
    VALUES (${id}, ${nombre.trim()}, ${direccion?.trim() || null}, ${telefono?.trim() || null}, true, ${empresaId ?? null})
  `;

  return NextResponse.json(
    { id, nombre: nombre.trim(), direccion: direccion?.trim() || null, telefono: telefono?.trim() || null },
    { status: 201 }
  );
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = soloAdmin(session);
  if (err) return err;

  const { id, nombre, direccion, telefono } = await req.json();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const empresaId = await resolveEmpresaId(session!.user as SessionUser);

  if (empresaId) {
    await prisma.$executeRaw`
      UPDATE "Sucursal"
      SET nombre    = COALESCE(${nombre?.trim() ?? null}, nombre),
          direccion = ${direccion !== undefined ? (direccion?.trim() || null) : null},
          telefono  = ${telefono !== undefined ? (telefono?.trim() || null) : null}
      WHERE id = ${id} AND "empresaId" = ${empresaId}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE "Sucursal"
      SET nombre    = COALESCE(${nombre?.trim() ?? null}, nombre),
          direccion = ${direccion !== undefined ? (direccion?.trim() || null) : null},
          telefono  = ${telefono !== undefined ? (telefono?.trim() || null) : null}
      WHERE id = ${id}
    `;
  }

  const rows = await prisma.$queryRaw<SucursalRow[]>`
    SELECT id, nombre, direccion, telefono FROM "Sucursal" WHERE id = ${id}
  `;
  return NextResponse.json(rows[0] ?? { id });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = soloAdmin(session);
  if (err) return err;

  const { id } = await req.json();
  const empresaId = await resolveEmpresaId(session!.user as SessionUser);

  if (empresaId) {
    await prisma.$executeRaw`UPDATE "Sucursal" SET activa = false WHERE id = ${id} AND "empresaId" = ${empresaId}`;
  } else {
    await prisma.$executeRaw`UPDATE "Sucursal" SET activa = false WHERE id = ${id}`;
  }
  return NextResponse.json({ ok: true });
}
