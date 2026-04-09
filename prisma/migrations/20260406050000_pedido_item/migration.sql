-- Tabla PedidoItem
-- productoId es nullable: permite histórico si el producto se elimina en el futuro
--   y cubre tipos sin producto creado aún (ej: zapatillas, secado)
-- nombreProducto y precioUnitario son copias al momento del pedido
CREATE TABLE IF NOT EXISTS "PedidoItem" (
  "id"             TEXT             NOT NULL,
  "pedidoId"       TEXT             NOT NULL,
  "productoId"     TEXT,
  "nombreProducto" TEXT             NOT NULL,
  "precioUnitario" DOUBLE PRECISION NOT NULL,
  "cantidad"       INTEGER          NOT NULL,
  "createdAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PedidoItem_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "PedidoItem_pedido_fk"
    FOREIGN KEY ("pedidoId")   REFERENCES "Pedido"("id")   ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "PedidoItem_producto_fk"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Backfill desde Item existente
-- Mapea tipo (lowercase) → Producto.nombre (case-insensitive) con LEFT JOIN
-- Tipos sin producto (ej: zapatillas, secado) quedan con productoId NULL
INSERT INTO "PedidoItem" (id, "pedidoId", "productoId", "nombreProducto", "precioUnitario", cantidad)
SELECT
  gen_random_uuid()::text                            AS id,
  i."pedidoId"                                       AS "pedidoId",
  pr.id                                              AS "productoId",
  INITCAP(i.tipo::text)                              AS "nombreProducto",
  i."precioUnitario"                                 AS "precioUnitario",
  i.cantidad                                         AS cantidad
FROM "Item" i
LEFT JOIN "Producto" pr ON LOWER(pr.nombre) = LOWER(i.tipo::text);
