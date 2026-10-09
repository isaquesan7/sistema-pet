-- =====================================================
-- PETRISE PHASE 12 — TIME CLOCK MONTHLY CLOSE
-- Approval workflow for time adjustments, hour bank and
-- auditable monthly payroll/accounting snapshots.
-- =====================================================

CREATE TYPE "StatusAjustePonto" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

ALTER TABLE "ajustes_ponto"
  ADD COLUMN "analisadoPorId" TEXT,
  ADD COLUMN "status" "StatusAjustePonto",
  ADD COLUMN "analisadoEm" TIMESTAMP(3),
  ADD COLUMN "observacaoAnalise" TEXT;

-- Previous adjustments were already effective in earlier phases.
UPDATE "ajustes_ponto" SET "status" = 'APROVADO' WHERE "status" IS NULL;
ALTER TABLE "ajustes_ponto" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "ajustes_ponto" ALTER COLUMN "status" SET DEFAULT 'PENDENTE';

CREATE INDEX "ajustes_ponto_analisadoPorId_idx" ON "ajustes_ponto"("analisadoPorId");
CREATE INDEX "ajustes_ponto_status_createdAt_idx" ON "ajustes_ponto"("status", "createdAt");
ALTER TABLE "ajustes_ponto"
  ADD CONSTRAINT "ajustes_ponto_analisadoPorId_fkey"
  FOREIGN KEY ("analisadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fechamentos_ponto"
  ADD COLUMN "reabertoPorId" TEXT,
  ADD COLUMN "saldoBancoAnterior" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "saldoBancoCompetencia" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "saldoBancoAcumulado" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "divergencias" JSONB,
  ADD COLUMN "espelho" JSONB,
  ADD COLUMN "observacoes" TEXT,
  ADD COLUMN "reabertoEm" TIMESTAMP(3),
  ADD COLUMN "motivoReabertura" TEXT;

CREATE INDEX "fechamentos_ponto_reabertoPorId_idx" ON "fechamentos_ponto"("reabertoPorId");
ALTER TABLE "fechamentos_ponto"
  ADD CONSTRAINT "fechamentos_ponto_reabertoPorId_fkey"
  FOREIGN KEY ("reabertoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
