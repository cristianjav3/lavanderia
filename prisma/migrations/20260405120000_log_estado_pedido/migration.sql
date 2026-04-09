-- Audit log for order state changes
CREATE TABLE "LogEstadoPedido" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "estadoAnterior" TEXT NOT NULL,
    "estadoNuevo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEstadoPedido_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LogEstadoPedido"
    ADD CONSTRAINT "LogEstadoPedido_pedidoId_fkey"
    FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
