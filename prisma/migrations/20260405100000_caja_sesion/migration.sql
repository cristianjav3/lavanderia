-- Rename CajonDia → CajaSesion
ALTER TABLE "CajonDia" RENAME TO "CajaSesion";

-- Rename columns in CajaSesion
ALTER TABLE "CajaSesion" RENAME COLUMN "apertura" TO "saldoInicial";
ALTER TABLE "CajaSesion" RENAME COLUMN "cierre" TO "saldoFinal";

-- Add fechaCierre column
ALTER TABLE "CajaSesion" ADD COLUMN IF NOT EXISTS "fechaCierre" TIMESTAMP(3);

-- Rename cajonId → sesionId in MovimientoCaja
ALTER TABLE "MovimientoCaja" RENAME COLUMN "cajonId" TO "sesionId";
ALTER TABLE "MovimientoCaja" DROP CONSTRAINT IF EXISTS "MovimientoCaja_cajonId_fkey";
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_sesionId_fkey"
  FOREIGN KEY ("sesionId") REFERENCES "CajaSesion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rename cajonId → sesionId in RegistroPago
ALTER TABLE "RegistroPago" RENAME COLUMN "cajonId" TO "sesionId";
ALTER TABLE "RegistroPago" DROP CONSTRAINT IF EXISTS "RegistroPago_cajonId_fkey";
ALTER TABLE "RegistroPago" ADD CONSTRAINT "RegistroPago_sesionId_fkey"
  FOREIGN KEY ("sesionId") REFERENCES "CajaSesion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
