import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as { id: string; role?: string; empresaId?: string | null };
  const isAdmin = user.role === "admin";

  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";

  // Empleados deben tener una sesión de caja (abierta o cerrada hoy) para usar la app.
  // También se acepta una sesión abierta de días anteriores (caja nunca cerrada).
  if (!isAdmin && !pathname.startsWith("/cajon")) {
    const hoyInicio = new Date(); hoyInicio.setHours(0, 0, 0, 0);
    const hoyFin = new Date(); hoyFin.setHours(23, 59, 59, 999);

    const sesiones = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "CajaSesion"
      WHERE "userId" = ${user.id}
        AND (
          ("createdAt" >= ${hoyInicio} AND "createdAt" <= ${hoyFin})
          OR estado = 'abierto'
        )
      LIMIT 1
    `;

    if (sesiones.length === 0) redirect("/cajon");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 px-3 py-4 sm:px-4 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
