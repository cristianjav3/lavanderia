import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST() {
  const existe = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE email = 'admin@lavanderia.com' LIMIT 1
  `;

  if (existe.length > 0) {
    return NextResponse.json({ ok: false, message: "El admin ya existe" });
  }

  const hash = await bcrypt.hash("admin123", 10);
  const id = crypto.randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "User" (id, name, email, password, role, activo, "createdAt")
    VALUES (${id}, 'Administrador', 'admin@lavanderia.com', ${hash}, 'admin', true, NOW())
  `;

  return NextResponse.json({ ok: true, message: "Administrador creado correctamente" });
}
