-- Tabla Producto
CREATE TABLE IF NOT EXISTS "Producto" (
  "id"        TEXT          NOT NULL,
  "empresaId" TEXT          NOT NULL DEFAULT empresa_default_id(),
  "nombre"    TEXT          NOT NULL,
  "tipo"      TEXT          NOT NULL,   -- 'servicio' | 'producto'
  "precio"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unidad"    TEXT,                     -- ej: 'prenda', 'unidad', 'kg'
  "activo"    BOOLEAN       NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Producto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Producto_empresa_fk"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Productos iniciales para la empresa principal
-- Los precios reflejan los valores actuales de lib/constants.ts
INSERT INTO "Producto" (id, "empresaId", nombre, tipo, precio, unidad, activo)
SELECT
  gen_random_uuid()::text,
  empresa_default_id(),
  nombre,
  tipo,
  precio,
  unidad,
  true
FROM (VALUES
  ('Canasto',  'servicio', 10000::float8, 'prenda'),
  ('Acolchado','servicio', 25000::float8, 'unidad'),
  ('Retiro',   'servicio',  5000::float8, NULL)
) AS t(nombre, tipo, precio, unidad)
ON CONFLICT DO NOTHING;
