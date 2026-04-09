import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId } from "@/lib/empresa";

type EmpresaRow = { id: string; nombre: string; nombreComercial: string | null; logoUrl: string | null; colorPrincipal: string | null; hasKey: boolean };

function soloAdmin(session: any) {
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user?.role !== "admin")
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const err = soloAdmin(session);
  if (err) return err;

  const user = session!.user as { empresaId?: string | null; role?: string };

  // Admins always see ALL empresas — they need to be able to switch between them.
  // The empresaId in their JWT is just the default; the active empresa is resolved
  // from the cookie and only affects data queries (pedidos, clientes, etc.).
  const empresas = await prisma.$queryRaw<EmpresaRow[]>`
    SELECT id, nombre, "nombreComercial", "logoUrl", "colorPrincipal",
           ("accessKey" IS NOT NULL AND "accessKey" != '') AS "hasKey"
    FROM "Empresa"
    ORDER BY "createdAt" ASC
  `;

  // Resolve active empresa: cookie → JWT empresaId → first in list
  const activaCookie = await resolveEmpresaId(user);
  const activaEnLista = empresas.find((e) => e.id === activaCookie);
  const activa = activaEnLista?.id ?? empresas[0]?.id ?? null;

  return NextResponse.json({ empresas, activa });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = soloAdmin(session);
  if (err) return err;

  const { nombre, razonSocial, cuit, telefono, direccion, accessKey, nombreComercial, colorPrincipal, logoUrl } = await req.json();

  if (!nombre?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  if (!telefono?.trim()) return NextResponse.json({ error: "Teléfono requerido" }, { status: 400 });
  if (!direccion?.trim()) return NextResponse.json({ error: "Dirección requerida" }, { status: 400 });

  const id = crypto.randomUUID();
  const key = accessKey?.trim() || null;

  await prisma.$executeRaw`
    INSERT INTO "Empresa" (id, nombre, "nombreComercial", "razonSocial", cuit, telefono, direccion, "logoUrl", "colorPrincipal", "accessKey", "createdAt")
    VALUES (
      ${id},
      ${nombre.trim()},
      ${nombreComercial?.trim() || null},
      ${razonSocial?.trim() || null},
      ${cuit?.trim() || null},
      ${telefono.trim()},
      ${direccion.trim()},
      ${logoUrl?.trim() || null},
      ${colorPrincipal?.trim() || null},
      ${key},
      NOW()
    )
  `;

  return NextResponse.json({ id, nombre: nombre.trim() }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = soloAdmin(session);
  if (err) return err;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  type CountRow = { total: bigint };

  // Cannot delete if empresa has data
  const [pedidos, clientes] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS total FROM "Pedido"  WHERE "empresaId" = ${id}`,
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS total FROM "Cliente" WHERE "empresaId" = ${id}`,
  ]);

  if (Number(pedidos[0]?.total ?? 0) > 0 || Number(clientes[0]?.total ?? 0) > 0) {
    return NextResponse.json({ error: "No se puede eliminar: la empresa tiene pedidos o clientes" }, { status: 409 });
  }

  // Cannot delete last empresa
  const total = await prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS total FROM "Empresa"`;
  if (Number(total[0]?.total ?? 0) <= 1) {
    return NextResponse.json({ error: "No se puede eliminar la única empresa" }, { status: 409 });
  }

  // Delete related records first (FK constraints)
  await prisma.$executeRaw`DELETE FROM "ConfiguracionEmpresa" WHERE "empresaId" = ${id}`;
  await prisma.$executeRaw`DELETE FROM "Sucursal" WHERE "empresaId" = ${id}`;
  await prisma.$executeRaw`DELETE FROM "Empresa" WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
