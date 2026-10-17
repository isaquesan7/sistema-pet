-- PointVet M.3C — audit of manual reversal, CI database ONLY.
-- No actual refund, no fiscal cancellation, no production deployment.
ALTER TYPE "StatusReservaOperacaoUnificada" ADD VALUE IF NOT EXISTS 'ESTORNADA';
CREATE TABLE "estornos_fechamento_manual_unificado" (
 "id" TEXT NOT NULL,
 "reservaId" TEXT NOT NULL,
 "usuarioId" TEXT NOT NULL,
 "motivo" VARCHAR(500) NOT NULL,
 "referenciaExterna" VARCHAR(120),
 "confirmouDevolucaoExterna" BOOLEAN NOT NULL,
 "fingerprint" TEXT NOT NULL,
 "snapshot" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "estornos_fechamento_manual_unificado_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "estornos_fechamento_manual_unificado_reservaId_key" ON "estornos_fechamento_manual_unificado"("reservaId");
CREATE INDEX "estornos_fechamento_manual_unificado_createdAt_idx" ON "estornos_fechamento_manual_unificado"("createdAt");
ALTER TABLE "estornos_fechamento_manual_unificado"
 ADD CONSTRAINT "estornos_fechamento_manual_unificado_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas_fechamento_unificado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "estornos_fechamento_manual_unificado"
 ADD CONSTRAINT "estornos_fechamento_manual_unificado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
