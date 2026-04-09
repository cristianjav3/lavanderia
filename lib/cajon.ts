import { prisma } from "@/lib/prisma";

/** Finds the active (open) session for a user. */
export async function getSesionActiva(userId: string) {
  type Row = { id: string };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id FROM "CajaSesion"
    WHERE "userId" = ${userId} AND estado = 'abierto'
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Records a payment in the user's active session. */
export async function registrarPago(
  userId: string,
  pedidoId: string,
  monto: number,
  metodoPago: "efectivo" | "tarjeta" | "mercadopago",
  empresaId?: string | null
) {
  const sesion = await getSesionActiva(userId);
  const sesionId = sesion?.id ?? null;
  const id = crypto.randomUUID();

  try {
    await prisma.$executeRaw`
      INSERT INTO "RegistroPago" (id, "pedidoId", "sesionId", monto, "metodoPago", "empresaId", "createdAt")
      VALUES (
        ${id},
        ${pedidoId},
        ${sesionId},
        ${monto},
        ${metodoPago}::"MetodoPago",
        ${empresaId ?? null},
        NOW()
      )
    `;
  } catch (e) {
    console.error("registrarPago error:", e);
  }
}
