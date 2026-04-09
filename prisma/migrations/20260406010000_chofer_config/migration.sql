-- Campos de entrega específicos en el pedido
ALTER TABLE "Pedido"
  ADD COLUMN IF NOT EXISTS "direccionEntrega" TEXT,
  ADD COLUMN IF NOT EXISTS "telefonoContacto" TEXT,
  ADD COLUMN IF NOT EXISTS "observacionEntrega" TEXT;

-- Configuración de disponibilidad del chofer por día
CREATE TABLE IF NOT EXISTS "ConfiguracionChofer" (
  "id"        TEXT NOT NULL,
  "dia"       INTEGER NOT NULL,        -- 0=lunes, 1=martes ... 6=domingo
  "activo"    BOOLEAN NOT NULL DEFAULT true,
  "franjas"   JSONB NOT NULL DEFAULT '[]',   -- [{"desde":"10:00","hasta":"12:00"}, ...]
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConfiguracionChofer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConfiguracionChofer_dia_key" UNIQUE ("dia")
);

-- Insertar los 7 días con franjas vacías si no existen
INSERT INTO "ConfiguracionChofer" (id, dia, activo, franjas)
VALUES
  (gen_random_uuid()::text, 0, true,  '[{"desde":"09:00","hasta":"12:00"},{"desde":"15:00","hasta":"18:00"}]'),
  (gen_random_uuid()::text, 1, true,  '[{"desde":"09:00","hasta":"12:00"},{"desde":"15:00","hasta":"18:00"}]'),
  (gen_random_uuid()::text, 2, true,  '[{"desde":"09:00","hasta":"12:00"},{"desde":"15:00","hasta":"18:00"}]'),
  (gen_random_uuid()::text, 3, true,  '[{"desde":"09:00","hasta":"12:00"},{"desde":"15:00","hasta":"18:00"}]'),
  (gen_random_uuid()::text, 4, true,  '[{"desde":"09:00","hasta":"12:00"},{"desde":"15:00","hasta":"18:00"}]'),
  (gen_random_uuid()::text, 5, false, '[]'),
  (gen_random_uuid()::text, 6, false, '[]')
ON CONFLICT ("dia") DO NOTHING;
