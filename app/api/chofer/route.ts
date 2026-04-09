import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEmpresaId } from "@/lib/empresa";

type SessionUser = { id: string; role?: string; empresaId?: string | null };

type PedidoChofer = {
  id: string;
  franjaHoraria: string | null;
  tipoEntrega: string;
  estadoPago: string;
  saldo: number;
  fechaRetiro: Date | null;
  direccionEntrega: string | null;
  telefonoContacto: string | null;
  observacionEntrega: string | null;
  clienteNombre: string;
  clienteTelefono: string;
  clienteDireccion: string | null;
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const empresaId = await resolveEmpresaId(session.user as SessionUser);

  const { searchParams } = new URL(req.url);
  const fecha = searchParams.get("fecha") || new Date().toISOString().split("T")[0];

  const inicio = new Date(fecha + "T00:00:00");
  const fin = new Date(fecha + "T23:59:59");

  const retiros = empresaId
    ? await prisma.$queryRaw<PedidoChofer[]>`
        SELECT
          p.id,
          p."franjaHoraria",
          p."tipoEntrega",
          p."estadoPago",
          p.saldo,
          p."fechaRetiro",
          p."direccionEntrega",
          p."telefonoContacto",
          p."observacionEntrega",
          c.nombre  AS "clienteNombre",
          c.telefono AS "clienteTelefono",
          c.direccion AS "clienteDireccion"
        FROM "Pedido" p
        JOIN "Cliente" c ON p."clienteId" = c.id
        WHERE p."tipoEntrega" = 'domicilio'
          AND p.estado IN ('pendiente_recepcion', 'listo')
          AND p."fechaRetiro" >= ${inicio}
          AND p."fechaRetiro" <= ${fin}
          AND p."empresaId" = ${empresaId}
        ORDER BY p."franjaHoraria" ASC NULLS LAST
      `
    : await prisma.$queryRaw<PedidoChofer[]>`
        SELECT
          p.id,
          p."franjaHoraria",
          p."tipoEntrega",
          p."estadoPago",
          p.saldo,
          p."fechaRetiro",
          p."direccionEntrega",
          p."telefonoContacto",
          p."observacionEntrega",
          c.nombre  AS "clienteNombre",
          c.telefono AS "clienteTelefono",
          c.direccion AS "clienteDireccion"
        FROM "Pedido" p
        JOIN "Cliente" c ON p."clienteId" = c.id
        WHERE p."tipoEntrega" = 'domicilio'
          AND p.estado IN ('pendiente_recepcion', 'listo')
          AND p."fechaRetiro" >= ${inicio}
          AND p."fechaRetiro" <= ${fin}
        ORDER BY p."franjaHoraria" ASC NULLS LAST
      `;

  const entregas = empresaId
    ? await prisma.$queryRaw<PedidoChofer[]>`
        SELECT
          p.id,
          p."franjaHoraria",
          p."tipoEntrega",
          p."estadoPago",
          p.saldo,
          p."fechaRetiro",
          p."direccionEntrega",
          p."telefonoContacto",
          p."observacionEntrega",
          c.nombre   AS "clienteNombre",
          c.telefono AS "clienteTelefono",
          c.direccion AS "clienteDireccion"
        FROM "Pedido" p
        JOIN "Cliente" c ON p."clienteId" = c.id
        WHERE p."tipoEntrega" = 'domicilio'
          AND p.estado = 'en_reparto'
          AND p."empresaId" = ${empresaId}
        ORDER BY p."updatedAt" ASC
      `
    : await prisma.$queryRaw<PedidoChofer[]>`
        SELECT
          p.id,
          p."franjaHoraria",
          p."tipoEntrega",
          p."estadoPago",
          p.saldo,
          p."fechaRetiro",
          p."direccionEntrega",
          p."telefonoContacto",
          p."observacionEntrega",
          c.nombre   AS "clienteNombre",
          c.telefono AS "clienteTelefono",
          c.direccion AS "clienteDireccion"
        FROM "Pedido" p
        JOIN "Cliente" c ON p."clienteId" = c.id
        WHERE p."tipoEntrega" = 'domicilio'
          AND p.estado = 'en_reparto'
        ORDER BY p."updatedAt" ASC
      `;

  function reshape(rows: PedidoChofer[]) {
    return rows.map((r) => ({
      id: r.id,
      franjaHoraria: r.franjaHoraria,
      tipoEntrega: r.tipoEntrega,
      estadoPago: r.estadoPago,
      saldo: Number(r.saldo),
      fechaRetiro: r.fechaRetiro,
      direccionEntrega: r.direccionEntrega,
      telefonoContacto: r.telefonoContacto,
      observacionEntrega: r.observacionEntrega,
      cliente: {
        nombre: r.clienteNombre,
        telefono: r.clienteTelefono,
        direccion: r.clienteDireccion,
      },
    }));
  }

  return NextResponse.json({ retiros: reshape(retiros), entregas: reshape(entregas) });
}
