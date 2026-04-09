-- Add visual identity fields to Empresa
ALTER TABLE "Empresa"
  ADD COLUMN IF NOT EXISTS "nombreComercial" TEXT,
  ADD COLUMN IF NOT EXISTS "colorPrincipal"  TEXT;
