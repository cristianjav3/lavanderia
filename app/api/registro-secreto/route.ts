import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { nombre, email, password } = await req.json();

  if (!nombre?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
  }

  const existe = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE email = ${email.trim().toLowerCase()} LIMIT 1
  `;
  if (existe.length > 0) {
    return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 400 });
  }

  // Buscar o crear empresa "Mi Lavandería"
  let empresaId: string;
  const empresaExiste = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Empresa" ORDER BY "createdAt" ASC LIMIT 1
  `;

  if (empresaExiste.length > 0) {
    empresaId = empresaExiste[0].id;
  } else {
    empresaId = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Empresa" (id, nombre, "nombreComercial", telefono, direccion, "createdAt")
      VALUES (${empresaId}, 'Mi Lavandería', 'Mi Lavandería', '-', '-', NOW())
    `;
  }

  const hash = await bcrypt.hash(password, 10);
  const userId = crypto.randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "User" (id, name, email, password, role, activo, "empresaId", "createdAt")
    VALUES (${userId}, ${nombre.trim()}, ${email.trim().toLowerCase()}, ${hash}, 'admin', true, ${empresaId}, NOW())
  `;

  return NextResponse.json({ ok: true });
}
