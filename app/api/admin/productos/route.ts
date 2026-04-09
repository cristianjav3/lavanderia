import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId } from "@/lib/empresa";

type ProductoRow = {
  id: string;
  empresaId: string;
  nombre: string;
  tipo: string;
  precio: number;
  unidad: string | null;
  activo: boolean;
  createdAt: Date;
};

function soloAdmin(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user?.role !== "admin") {
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const empresaId = await resolveEmpresaId(session.user as { empresaId?: string | null; role?: string });
  if (!empresaId) return NextResponse.json({ error: "Empresa requerida" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const soloActivos = searchParams.get("activos") === "1";

  let rows: ProductoRow[];
  if (soloActivos) {
    rows = await prisma.$queryRaw<ProductoRow[]>`
      SELECT id, "empresaId", nombre, tipo, precio, unidad, activo, "createdAt"
      FROM "Producto"
      WHERE activo = true AND "empresaId" = ${empresaId}
      ORDER BY nombre ASC
    `;
  } else {
    rows = await prisma.$queryRaw<ProductoRow[]>`
      SELECT id, "empresaId", nombre, tipo, precio, unidad, activo, "createdAt"
      FROM "Producto"
      WHERE "empresaId" = ${empresaId}
      ORDER BY nombre ASC
    `;
  }

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = soloAdmin(session);
  if (err) return err;

  const empresaId = await resolveEmpresaId(session!.user as { empresaId?: string | null; role?: string });
  if (!empresaId) return NextResponse.json({ error: "Empresa requerida" }, { status: 400 });

  const { nombre, tipo, precio, unidad } = await req.json();

  if (!nombre?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  if (!tipo) return NextResponse.json({ error: "Tipo requerido" }, { status: 400 });
  if (precio === undefined || precio === null || isNaN(Number(precio))) {
    return NextResponse.json({ error: "Precio requerido" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const unidadVal: string | null = unidad?.trim() || null;

  await prisma.$executeRaw`
    INSERT INTO "Producto" (id, "empresaId", nombre, tipo, precio, unidad, activo)
    VALUES (
      ${id},
      ${empresaId},
      ${nombre.trim()},
      ${tipo},
      ${Number(precio)},
      ${unidadVal},
      true
    )
  `;

  const rows = await prisma.$queryRaw<ProductoRow[]>`
    SELECT id, "empresaId", nombre, tipo, precio, unidad, activo, "createdAt"
    FROM "Producto" WHERE id = ${id}
  `;

  return NextResponse.json(rows[0], { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = soloAdmin(session);
  if (err) return err;

  const empresaId = await resolveEmpresaId(session!.user as { empresaId?: string | null; role?: string });
  if (!empresaId) return NextResponse.json({ error: "Empresa requerida" }, { status: 400 });

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  // Verify product belongs to the active empresa
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Producto" WHERE id = ${id} AND "empresaId" = ${empresaId} LIMIT 1
  `;
  if (!existing[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Toggle activo only (from the switch in the list)
  if (Object.keys(body).length === 2 && "activo" in body) {
    await prisma.$executeRaw`
      UPDATE "Producto" SET activo = ${body.activo} WHERE id = ${id} AND "empresaId" = ${empresaId}
    `;
  } else {
    // Full edit — all editable fields required
    const { nombre, tipo, precio, unidad, activo } = body;
    if (!nombre?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    const unidadVal: string | null = unidad?.trim() || null;
    const activoVal: boolean = activo !== undefined ? Boolean(activo) : true;

    await prisma.$executeRaw`
      UPDATE "Producto"
      SET
        nombre = ${nombre.trim()},
        tipo   = ${tipo},
        precio = ${Number(precio)},
        unidad = ${unidadVal},
        activo = ${activoVal}
      WHERE id = ${id} AND "empresaId" = ${empresaId}
    `;
  }

  const rows = await prisma.$queryRaw<ProductoRow[]>`
    SELECT id, "empresaId", nombre, tipo, precio, unidad, activo, "createdAt"
    FROM "Producto" WHERE id = ${id}
  `;

  return NextResponse.json(rows[0] ?? { id });
}
