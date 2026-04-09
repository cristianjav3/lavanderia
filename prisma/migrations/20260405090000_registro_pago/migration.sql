-- Drop metodoPago from Pedido (moving to RegistroPago)
ALTER TABLE "Pedido" DROP COLUMN IF EXISTS "metodoPago";

-- CreateTable RegistroPago
CREATE TABLE "RegistroPago" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "cajonId" TEXT,
    "monto" DOUBLE PRECISION NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroPago_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RegistroPago" ADD CONSTRAINT "RegistroPago_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroPago" ADD CONSTRAINT "RegistroPago_cajonId_fkey" FOREIGN KEY ("cajonId") REFERENCES "CajonDia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
