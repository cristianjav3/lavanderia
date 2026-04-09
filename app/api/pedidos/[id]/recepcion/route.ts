import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calcularCanastos, PRECIOS } from "@/lib/constants";
import { resolveEmpresaId, pedidoPertenece } from "@/lib/empresa";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { items, notas, requiereValidacion, observaciones } = body as {
    items: { tipo: string; cantidad: number }[];
    notas?: string;
    requiereValidacion: boolean;
    observaciones?: string;
  };

  const userId = (session.user as { id: string }).id;
  const empresaId = await resolveEmpresaId(session.user as { empresaId?: string | null; role?: string });

  if (!await pedidoPertenece(id, empresaId)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Calcular total real desde los items recibidos
  let nuevoTotal = 0;
  const itemsConPrecio = items.map((item) => {
    let precioUnitario = 0;
    if (item.tipo === "canasto") {
      precioUnitario = PRECIOS.canasto;
      nuevoTotal += calcularCanastos(item.cantidad) * PRECIOS.canasto;
    } else if (item.tipo === "acolchado") {
      precioUnitario = PRECIOS.acolchado;
      nuevoTotal += item.cantidad * PRECIOS.acolchado;
    } else {
      precioUnitario = PRECIOS.canasto;
      nuevoTotal += item.cantidad * PRECIOS.canasto;
    }
    return { pedidoId: id, tipo: item.tipo as never, cantidad: item.cantidad, precioUnitario };
  });

  if (pedido.tipoEntrega === "domicilio") nuevoTotal += PRECIOS.retiro;

  const saldo = nuevoTotal - pedido.pagado;
  let estadoPago: "pendiente" | "parcial" | "pagado" = "pendiente";
  if (pedido.pagado >= nuevoTotal) estadoPago = "pagado";
  else if (pedido.pagado > 0) estadoPago = "parcial";

  const nuevoEstado = requiereValidacion ? "validacion" : "por_lavar";

  // Reemplazar items
  await prisma.item.deleteMany({ where: { pedidoId: id } });
  await prisma.item.createMany({ data: itemsConPrecio });

  const recepcion = await prisma.recepcion.create({
    data: { pedidoId: id, empleadoId: userId, notas, requiereValidacion },
  });

  if (observaciones) {
    await prisma.observacion.create({ data: { pedidoId: id, texto: observaciones } });
  }

  await prisma.pedido.update({
    where: { id },
    data: { estado: nuevoEstado as never, total: nuevoTotal, saldo, estadoPago },
  });

  return NextResponse.json({ recepcion });
}
