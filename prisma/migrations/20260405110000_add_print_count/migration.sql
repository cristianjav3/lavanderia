-- Add printCount to Pedido for print tracking
ALTER TABLE "Pedido" ADD COLUMN IF NOT EXISTS "printCount" INTEGER NOT NULL DEFAULT 0;
