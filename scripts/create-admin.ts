/**
 * Script para crear el usuario administrador inicial.
 *
 * Uso local:
 *   npx ts-node scripts/create-admin.ts
 *
 * Uso en producción (Railway u otro):
 *   DATABASE_URL="postgresql://..." npx ts-node scripts/create-admin.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = process.env.ADMIN_EMAIL ?? "admin@lavanderia.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";
const NAME = process.env.ADMIN_NAME ?? "Administrador";

async function main() {
  const existe = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE email = ${EMAIL} LIMIT 1
  `;

  if (existe.length > 0) {
    console.log(`✓ El usuario ${EMAIL} ya existe. No se creó ningún duplicado.`);
    return;
  }

  const hash = await bcrypt.hash(PASSWORD, 10);
  const id = crypto.randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "User" (id, name, email, password, role, activo, "createdAt", "updatedAt")
    VALUES (${id}, ${NAME}, ${EMAIL}, ${hash}, 'admin', true, NOW(), NOW())
  `;

  console.log("✓ Usuario administrador creado:");
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Role:     admin`);
}

main()
  .catch((e) => {
    console.error("✗ Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
