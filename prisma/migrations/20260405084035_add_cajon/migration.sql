-- CreateEnum
CREATE TYPE "EstadoCajon" AS ENUM ('abierto', 'cerrado');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ingreso', 'gasto');

-- CreateTable
CREATE TABLE "ConceptoCaja" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ConceptoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CajonDia" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sucursalId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "apertura" DOUBLE PRECISION NOT NULL,
    "cierre" DOUBLE PRECISION,
    "estado" "EstadoCajon" NOT NULL DEFAULT 'abierto',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CajonDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCaja" (
    "id" TEXT NOT NULL,
    "cajonId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "conceptoId" TEXT,
    "descripcion" TEXT,
    "monto" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConceptoCaja_nombre_key" ON "ConceptoCaja"("nombre");

-- AddForeignKey
ALTER TABLE "CajonDia" ADD CONSTRAINT "CajonDia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_cajonId_fkey" FOREIGN KEY ("cajonId") REFERENCES "CajonDia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "ConceptoCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;
