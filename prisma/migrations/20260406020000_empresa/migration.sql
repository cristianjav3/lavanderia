-- Tabla Empresa
CREATE TABLE IF NOT EXISTS "Empresa" (
  "id"          TEXT          NOT NULL,
  "nombre"      TEXT          NOT NULL,
  "razonSocial" TEXT,
  "cuit"        TEXT,
  "telefono"    TEXT          NOT NULL,
  "direccion"   TEXT          NOT NULL,
  "logoUrl"     TEXT,
  "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- Tabla ConfiguracionEmpresa (1:1 con Empresa)
-- diasChofer: array de días activos, ej: [0,1,2,3,4]  (0=lunes … 6=domingo)
-- franjasHorariasChofer: mapa dia→franjas, ej: {"0":[{"desde":"09:00","hasta":"12:00"}], ...}
CREATE TABLE IF NOT EXISTS "ConfiguracionEmpresa" (
  "id"                    TEXT          NOT NULL,
  "empresaId"             TEXT          NOT NULL,
  "diasChofer"            JSONB         NOT NULL DEFAULT '[]',
  "franjasHorariasChofer" JSONB         NOT NULL DEFAULT '{}',
  "createdAt"             TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConfiguracionEmpresa_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "ConfiguracionEmpresa_empresa_fk" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ConfiguracionEmpresa_empresa_uq" UNIQUE ("empresaId")
);

-- Insertar empresa por defecto
INSERT INTO "Empresa" (id, nombre, telefono, direccion)
VALUES (gen_random_uuid()::text, 'Empresa Principal', '-', '-')
ON CONFLICT DO NOTHING;

-- Insertar ConfiguracionEmpresa migrando datos de ConfiguracionChofer
INSERT INTO "ConfiguracionEmpresa" (id, "empresaId", "diasChofer", "franjasHorariasChofer")
SELECT
  gen_random_uuid()::text AS id,
  e.id                    AS "empresaId",
  -- dias activos como array de enteros
  COALESCE(
    (SELECT jsonb_agg(dia ORDER BY dia)
     FROM "ConfiguracionChofer"
     WHERE activo = true),
    '[]'::jsonb
  )                       AS "diasChofer",
  -- franjas por dia como objeto {dia_str: [{desde, hasta}]}
  COALESCE(
    (SELECT jsonb_object_agg(dia::text, franjas)
     FROM "ConfiguracionChofer"),
    '{}'::jsonb
  )                       AS "franjasHorariasChofer"
FROM "Empresa" e
WHERE e.nombre = 'Empresa Principal'
ON CONFLICT DO NOTHING;
