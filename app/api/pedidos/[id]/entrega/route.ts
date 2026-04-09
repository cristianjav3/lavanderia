import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PRECIOS } from "@/lib/constants";
import { registrarPago } from "@/lib/cajon";
import { resolveEmpresaId, pedidoPertenece } from "@/lib/empresa";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { resultado, cambiarASucursal, metodoPago } = body;

  const empresaId = await resolveEmpresaId(session.user as { empresaId?: string | null; role?: string });

  if (!await pedidoPertenece(id, empresaId)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  let recargo = 0;
  let nuevoEstado = resultado === "entregado" ? "entregado" : "no_entregado";
  let nuevoTotal = pedido.total;

  if (resultado === "no_entregado") {
    recargo = PRECIOS.reintento;
    nuevoTotal = pedido.total + recargo;
  }

  if (cambiarASucursal) {
    nuevoEstado = "en_sucursal";
  }

  await prisma.entrega.create({
    data: { pedidoId: id, resultado, recargo },
  });

  // Al entregar: saldar deuda (el cliente pagó al retirar)
  const nuevoPagado = resultado === "entregado" ? nuevoTotal : pedido.pagado;
  const saldo = nuevoTotal - nuevoPagado;
  let estadoPago: "pendiente" | "parcial" | "pagado" = "pendiente";
  if (nuevoPagado >= nuevoTotal) estadoPago = "pagado";
  else if (nuevoPagado > 0) estadoPago = "parcial";

  const updated = await prisma.pedido.update({
    where: { id },
    data: {
      estado: nuevoEstado as never,
      total: nuevoTotal,
      pagado: nuevoPagado,
      saldo,
      estadoPago,
    },
  });

  // Si se entregó y había saldo pendiente, registrar el cobro en el cajón
  if (resultado === "entregado" && pedido.saldo > 0) {
    const user = session.user as { id: string };
    await registrarPago(user.id, id, pedido.saldo, metodoPago || "efectivo", empresaId);
  }

  return NextResponse.json(updated);
}
