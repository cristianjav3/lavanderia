import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId } from "@/lib/empresa";

type EmpresaRow = {
  id: string;
  nombre: string;
  nombreComercial: string | null;
  razonSocial: string | null;
  cuit: string | null;
  telefono: string;
  direccion: string;
  logoUrl: string | null;
  colorPrincipal: string | null;
  hasKey: boolean;
  configId: string | null;
  diasChofer: unknown;
  franjasHorariasChofer: unknown;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  }

  const empresaId = await resolveEmpresaId(session!.user as { empresaId?: string | null; role?: string });

  const rows = empresaId
    ? await prisma.$queryRaw<EmpresaRow[]>`
        SELECT e.id, e.nombre, e."nombreComercial", e."razonSocial", e.cuit, e.telefono, e.direccion, e."logoUrl", e."colorPrincipal",
               (e."accessKey" IS NOT NULL AND e."accessKey" != '') AS "hasKey",
               c.id AS "configId", c."diasChofer", c."franjasHorariasChofer"
        FROM "Empresa" e
        LEFT JOIN "ConfiguracionEmpresa" c ON c."empresaId" = e.id
        WHERE e.id = ${empresaId}
        LIMIT 1
      `
    : await prisma.$queryRaw<EmpresaRow[]>`
        SELECT e.id, e.nombre, e."nombreComercial", e."razonSocial", e.cuit, e.telefono, e.direccion, e."logoUrl", e."colorPrincipal",
               (e."accessKey" IS NOT NULL AND e."accessKey" != '') AS "hasKey",
               c.id AS "configId", c."diasChofer", c."franjasHorariasChofer"
        FROM "Empresa" e
        LEFT JOIN "ConfiguracionEmpresa" c ON c."empresaId" = e.id
        ORDER BY e."createdAt" ASC
        LIMIT 1
      `;

  if (rows.length === 0) return NextResponse.json(null);

  const row = rows[0];

  // Conteos de datos aislados por esta empresa
  type CountRow = { total: bigint };
  const [pedidos, clientes, usuarios, sucursales] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS total FROM "Pedido"   WHERE "empresaId" = ${row.id}`,
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS total FROM "Cliente"  WHERE "empresaId" = ${row.id}`,
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS total FROM "User"     WHERE "empresaId" = ${row.id}`,
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS total FROM "Sucursal" WHERE "empresaId" = ${row.id}`,
  ]);

  return NextResponse.json({
    id: row.id,
    nombre: row.nombre,
    nombreComercial: row.nombreComercial,
    razonSocial: row.razonSocial,
    cuit: row.cuit,
    telefono: row.telefono,
    direccion: row.direccion,
    logoUrl: row.logoUrl,
    colorPrincipal: row.colorPrincipal,
    hasKey: row.hasKey,
    configuracion: row.configId
      ? {
          id: row.configId,
          diasChofer: row.diasChofer,
          franjasHorariasChofer: row.franjasHorariasChofer,
        }
      : null,
    stats: {
      pedidos:   Number(pedidos[0]?.total   ?? 0),
      clientes:  Number(clientes[0]?.total  ?? 0),
      usuarios:  Number(usuarios[0]?.total  ?? 0),
      sucursales: Number(sucursales[0]?.total ?? 0),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  }

  const body = await req.json();
  const { id, nombre, nombreComercial, razonSocial, cuit, telefono, direccion, logoUrl, colorPrincipal, diasChofer, franjasHorariasChofer, accessKey } = body;

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  if (!nombre?.trim()) return NextResponse.json({ error: "nombre requerido" }, { status: 400 });
  if (!telefono?.trim()) return NextResponse.json({ error: "telefono requerido" }, { status: 400 });
  if (!direccion?.trim()) return NextResponse.json({ error: "direccion requerida" }, { status: 400 });

  // accessKey: undefined = don't change; null/"" = remove; string = set new
  const keyValue = accessKey === undefined ? undefined : (accessKey?.trim() || null);

  if (keyValue === undefined) {
    await prisma.$executeRaw`
      UPDATE "Empresa"
      SET nombre            = ${nombre.trim()},
          "nombreComercial" = ${nombreComercial?.trim() || null},
          "razonSocial"     = ${razonSocial?.trim() || null},
          cuit              = ${cuit?.trim() || null},
          telefono          = ${telefono.trim()},
          direccion         = ${direccion.trim()},
          "logoUrl"         = ${logoUrl?.trim() || null},
          "colorPrincipal"  = ${colorPrincipal?.trim() || null}
      WHERE id = ${id}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE "Empresa"
      SET nombre            = ${nombre.trim()},
          "nombreComercial" = ${nombreComercial?.trim() || null},
          "razonSocial"     = ${razonSocial?.trim() || null},
          cuit              = ${cuit?.trim() || null},
          telefono          = ${telefono.trim()},
          direccion         = ${direccion.trim()},
          "logoUrl"         = ${logoUrl?.trim() || null},
          "colorPrincipal"  = ${colorPrincipal?.trim() || null},
          "accessKey"       = ${keyValue}
      WHERE id = ${id}
    `;
  }

  // Upsert ConfiguracionEmpresa
  const diasJson = JSON.stringify(diasChofer ?? []);
  const franjasJson = JSON.stringify(franjasHorariasChofer ?? {});

  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "ConfiguracionEmpresa" WHERE "empresaId" = ${id}
  `;

  if (existing.length > 0) {
    await prisma.$executeRaw`
      UPDATE "ConfiguracionEmpresa"
      SET "diasChofer" = ${diasJson}::jsonb,
          "franjasHorariasChofer" = ${franjasJson}::jsonb
      WHERE "empresaId" = ${id}
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO "ConfiguracionEmpresa" (id, "empresaId", "diasChofer", "franjasHorariasChofer", "createdAt")
      VALUES (gen_random_uuid()::text, ${id}, ${diasJson}::jsonb, ${franjasJson}::jsonb, NOW())
    `;
  }

  return NextResponse.json({ ok: true });
}
