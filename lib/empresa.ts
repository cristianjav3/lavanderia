import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

type SessionUser = { empresaId?: string | null; role?: string };

/**
 * Resolves the effective empresaId for a request.
 * - Admin: prefers the "empresa-activa" cookie (set via the selector in the Navbar).
 * - Others: use the empresaId encoded in their JWT session.
 * Returns null if no empresa can be determined (no filtering applied, backwards-compatible).
 */
export async function resolveEmpresaId(user: SessionUser): Promise<string | null> {
  if (user.role === "admin") {
    const store = await cookies();
    const active = store.get("empresa-activa")?.value;
    if (active) return active;
  }
  return user.empresaId ?? null;
}

/**
 * Checks that a pedido belongs to the given empresa.
 * Returns true if empresaId is null (no isolation enforced) or if the pedido matches.
 * Returns false if the pedido does not exist or belongs to a different empresa.
 */
export async function pedidoPertenece(pedidoId: string, empresaId: string | null): Promise<boolean> {
  if (!empresaId) return true;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Pedido"
    WHERE id = ${pedidoId} AND "empresaId" = ${empresaId}
    LIMIT 1
  `;
  return rows.length > 0;
}
