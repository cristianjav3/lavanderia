import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  const empleadoPassword = await bcrypt.hash("empleado123", 10);

  await prisma.user.upsert({
    where: { email: "admin@lavanderia.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@lavanderia.com",
      password: adminPassword,
      role: "admin",
    },
  });

  await prisma.user.upsert({
    where: { email: "empleado@lavanderia.com" },
    update: {},
    create: {
      name: "Empleado",
      email: "empleado@lavanderia.com",
      password: empleadoPassword,
      role: "empleado",
    },
  });

  // Conceptos predefinidos de caja
  const conceptosGasto = [
    "Alquileres", "Productos", "Bolsas", "Librería",
    "Antonio", "Retiro Cristian", "Adelanto Tamara", "Adelanto Verónica",
  ];
  const conceptosIngreso = ["Cambio", "Cobro externo", "Transferencia recibida"];

  for (const nombre of conceptosGasto) {
    await prisma.conceptoCaja.upsert({
      where: { nombre },
      update: {},
      create: { nombre, tipo: "gasto" },
    });
  }
  for (const nombre of conceptosIngreso) {
    await prisma.conceptoCaja.upsert({
      where: { nombre },
      update: {},
      create: { nombre, tipo: "ingreso" },
    });
  }

  console.log("Seed completado.");
  console.log("Admin: admin@lavanderia.com / admin123");
  console.log("Empleado: empleado@lavanderia.com / empleado123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
