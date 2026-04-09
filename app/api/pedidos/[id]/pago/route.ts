import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
  const { monto, metodoPago } = body;

  const empresaId = await resolveEmpresaId(session.user as { empresaId?: string | null; role?: string });

  if (!await pedidoPertenece(id, empresaId)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const montoNum = parseFloat(monto);
  const nuevoPagado = pedido.pagado + montoNum;
  const nuevoSaldo = pedido.total - nuevoPagado;
  let estadoPago: "pendiente" | "parcial" | "pagado" = "parcial";
  if (nuevoPagado >= pedido.total) estadoPago = "pagado";
  if (nuevoPagado <= 0) estadoPago = "pendiente";

  const updated = await prisma.pedido.update({
    where: { id },
    data: {
      pagado: nuevoPagado,
      saldo: nuevoSaldo < 0 ? 0 : nuevoSaldo,
      estadoPago,
    },
  });

  // Registrar el pago en el cajón abierto del empleado
  const user = session.user as { id: string };
  await registrarPago(user.id, id, montoNum, metodoPago || "efectivo", empresaId);

  return NextResponse.json(updated);
}
