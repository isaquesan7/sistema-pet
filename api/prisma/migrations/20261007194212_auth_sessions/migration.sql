-- CreateTable
CREATE TABLE "sessoes_usuario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessoes_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessoes_usuario_usuarioId_idx" ON "sessoes_usuario"("usuarioId");

-- CreateIndex
CREATE INDEX "sessoes_usuario_expiresAt_idx" ON "sessoes_usuario"("expiresAt");

-- CreateIndex
CREATE INDEX "sessoes_usuario_revokedAt_idx" ON "sessoes_usuario"("revokedAt");

-- AddForeignKey
ALTER TABLE "sessoes_usuario" ADD CONSTRAINT "sessoes_usuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
