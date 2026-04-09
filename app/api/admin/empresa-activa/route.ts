import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  }

  const { empresaId, accessKey } = await req.json();
  if (!empresaId) return NextResponse.json({ error: "empresaId requerido" }, { status: 400 });

  // Fetch empresa to check if it has an accessKey
  type EmpresaRow = { id: string; accessKey: string | null };
  const rows = await prisma.$queryRaw<EmpresaRow[]>`
    SELECT id, "accessKey" FROM "Empresa" WHERE id = ${empresaId} LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  const empresa = rows[0];

  // If the empresa has a key, validate it
  if (empresa.accessKey) {
    if (!accessKey || accessKey !== empresa.accessKey) {
      return NextResponse.json({ error: "Clave incorrecta" }, { status: 403 });
    }
  }

  const store = await cookies();
  store.set("empresa-activa", empresaId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true });
}
