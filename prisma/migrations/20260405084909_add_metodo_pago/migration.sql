-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('efectivo', 'tarjeta', 'mercadopago');

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "metodoPago" "MetodoPago" NOT NULL DEFAULT 'efectivo';
