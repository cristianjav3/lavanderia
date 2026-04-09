-- ============================================================
-- Función auxiliar: devuelve el ID de la empresa principal.
-- Usada como DEFAULT para que INSERTs sin empresaId explícito
-- se asignen automáticamente, sin cambiar ningún código.
-- ============================================================
CREATE OR REPLACE FUNCTION empresa_default_id() RETURNS TEXT
  LANGUAGE sql STABLE AS $$
    SELECT id FROM "Empresa" ORDER BY "createdAt" ASC LIMIT 1;
  $$;

-- ============================================================
-- User (empleados)
-- ============================================================
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "empresaId" TEXT DEFAULT empresa_default_id();

UPDATE "User"
  SET "empresaId" = empresa_default_id()
  WHERE "empresaId" IS NULL;

-- ============================================================
-- Cliente
-- ============================================================
ALTER TABLE "Cliente"
  ADD COLUMN IF NOT EXISTS "empresaId" TEXT DEFAULT empresa_default_id();

UPDATE "Cliente"
  SET "empresaId" = empresa_default_id()
  WHERE "empresaId" IS NULL;

-- ============================================================
-- Pedido
-- ============================================================
ALTER TABLE "Pedido"
  ADD COLUMN IF NOT EXISTS "empresaId" TEXT DEFAULT empresa_default_id();

UPDATE "Pedido"
  SET "empresaId" = empresa_default_id()
  WHERE "empresaId" IS NULL;

-- ============================================================
-- CajaSesion
-- ============================================================
ALTER TABLE "CajaSesion"
  ADD COLUMN IF NOT EXISTS "empresaId" TEXT DEFAULT empresa_default_id();

UPDATE "CajaSesion"
  SET "empresaId" = empresa_default_id()
  WHERE "empresaId" IS NULL;

-- ============================================================
-- RegistroPago
-- ============================================================
ALTER TABLE "RegistroPago"
  ADD COLUMN IF NOT EXISTS "empresaId" TEXT DEFAULT empresa_default_id();

UPDATE "RegistroPago"
  SET "empresaId" = empresa_default_id()
  WHERE "empresaId" IS NULL;
