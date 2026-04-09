import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PRECIOS, calcularCanastos } from "@/lib/constants";
import { registrarPago } from "@/lib/cajon";
import { resolveEmpresaId } from "@/lib/empresa";

type SessionUser = { id: string; role?: string; empresaId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");
  const fecha = searchParams.get("fecha");
  const q = searchParams.get("q");

  const empresaId = await resolveEmpresaId(session.user as SessionUser);

  // Normalizamos q: quitamos el prefijo # si lo tiene
  const qClean = q ? q.trim().replace(/^#/, "") : null;
  const qNum = qClean && /^\d+$/.test(qClean) ? parseInt(qClean) : null;

  const pedidos = await prisma.pedido.findMany({
    where: {
      ...(empresaId ? { empresaId: empresaId as never } : {}),
      ...(estado ? { estado: estado as never } : {}),
      ...(fecha
        ? {
            fechaRetiro: {
              gte: new Date(fecha + "T00:00:00"),
              lte: new Date(fecha + "T23:59:59"),
            },
          }
        : {}),
      // Búsqueda simultánea: número exacto OR nombre OR teléfono
      ...(qClean
        ? {
            OR: [
              ...(qNum !== null ? [{ numero: qNum }] : []),
              {
                cliente: {
                  OR: [
                    { nombre: { contains: qClean, mode: "insensitive" } },
                    { telefono: { contains: qClean } },
                  ],
                },
              },
            ],
          }
        : {}),
    },
    include: {
      cliente: true,
      items: true,
      recepcion: true,
    },
    orderBy: { createdAt: "desc" },
    take: q ? 10 : undefined,
  });

  return NextResponse.json(pedidos);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const {
    clienteId,
    items,
    pedidoItems,
    tipoEntrega,
    sucursal,
    fechaRetiro,
    franjaHoraria,
    pagado,
    metodoPago,
    direccionEntrega,
    telefonoContacto,
    observacionEntrega,
    observacionCliente,
  } = body;

  type PedidoItemInput = { productoId: string; nombre: string; precioUnitario: number; cantidad: number };
  const pedidoItemsArr: PedidoItemInput[] = Array.isArray(pedidoItems) ? pedidoItems : [];

  if (!clienteId || (!items?.length && !pedidoItemsArr.length)) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const { id: userId } = session.user as SessionUser;
  const empresaId = await resolveEmpresaId(session.user as SessionUser);

  // Sumar productos (PedidoItem) al total
  let totalProductos = 0;
  for (const pi of pedidoItemsArr) {
    totalProductos += Number(pi.precioUnitario) * Number(pi.cantidad);
  }

  // Calcular total de items clásicos
  let total = totalProductos;
  const itemsConPrecio = (items ?? []).map((item: { tipo: string; cantidad: number }) => {
    let precioUnitario = 0;

    if (item.tipo === "canasto") {
      const canastos = calcularCanastos(item.cantidad);
      precioUnitario = PRECIOS.canasto;
      total += canastos * PRECIOS.canasto;
      return { tipo: item.tipo, cantidad: item.cantidad, precioUnitario };
    }

    if (item.tipo === "acolchado") precioUnitario = PRECIOS.acolchado;
    if (item.tipo === "zapatillas") precioUnitario = PRECIOS.canasto;
    if (item.tipo === "secado") precioUnitario = PRECIOS.canasto;

    total += item.cantidad * precioUnitario;
    return { tipo: item.tipo, cantidad: item.cantidad, precioUnitario };
  });

  if (tipoEntrega === "domicilio") total += PRECIOS.retiro;

  const pagadoNum = parseFloat(pagado) || 0;
  const saldo = total - pagadoNum;
  let estadoPago: "pendiente" | "parcial" | "pagado" = "pendiente";
  if (pagadoNum >= total) estadoPago = "pagado";
  else if (pagadoNum > 0) estadoPago = "parcial";

  const pedido = await prisma.pedido.create({
    data: {
      clienteId,
      tipoEntrega,
      sucursal,
      fechaRetiro: fechaRetiro ? new Date(fechaRetiro) : null,
      franjaHoraria,
      total,
      pagado: pagadoNum,
      saldo,
      estadoPago,
      ...(empresaId ? { empresaId: empresaId as never } : {}),
      ...(itemsConPrecio.length > 0 ? { items: { create: itemsConPrecio } } : {}),
    },
    include: { cliente: true, items: true },
  });

  // Crear PedidoItems (productos de empresa) con raw SQL
  for (const pi of pedidoItemsArr) {
    const piId = crypto.randomUUID();
    const productoId = pi.productoId || null;
    await prisma.$executeRaw`
      INSERT INTO "PedidoItem" (id, "pedidoId", "productoId", "nombreProducto", "precioUnitario", cantidad, "createdAt")
      VALUES (${piId}, ${pedido.id}, ${productoId}, ${pi.nombre}, ${Number(pi.precioUnitario)}, ${Number(pi.cantidad)}, NOW())
    `;
  }

  // Save delivery-specific fields (added after prisma generate — raw SQL required)
  if (tipoEntrega === "domicilio") {
    await prisma.$executeRaw`
      UPDATE "Pedido"
      SET "direccionEntrega"   = ${direccionEntrega ?? null},
          "telefonoContacto"   = ${telefonoContacto ?? null},
          "observacionEntrega" = ${observacionEntrega ?? null}
      WHERE id = ${pedido.id}
    `;
  }

  // Guardar observación del cliente si viene
  if (observacionCliente?.trim()) {
    await prisma.observacion.create({
      data: { pedidoId: pedido.id, texto: observacionCliente.trim() },
    });
  }

  // Registrar pago inicial si corresponde
  if (pagadoNum > 0 && userId) {
    await registrarPago(userId, pedido.id, pagadoNum, metodoPago || "efectivo", empresaId);
  }

  return NextResponse.json(pedido, { status: 201 });
}
