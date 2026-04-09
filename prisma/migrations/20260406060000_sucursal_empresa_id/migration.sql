-- Add empresaId to Sucursal for multi-empresa isolation
ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "empresaId" TEXT REFERENCES "Empresa"(id);

-- Assign existing sucursales to the default empresa
UPDATE "Sucursal"
SET "empresaId" = empresa_default_id()
WHERE "empresaId" IS NULL;

-- Drop the global unique constraint on nombre so each empresa can have its own branches
ALTER TABLE "Sucursal" DROP CONSTRAINT IF EXISTS "Sucursal_nombre_key";

-- Add empresa-scoped unique constraint
ALTER TABLE "Sucursal" ADD CONSTRAINT "Sucursal_empresaId_nombre_key"
  UNIQUE ("empresaId", nombre);
