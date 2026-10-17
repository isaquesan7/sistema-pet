-- 20.2.4B.2B.1 — timeout seguro: nunca reenvia cobrança sem consulta de estado.
-- Alterações aditivas, testes exclusivamente em PostgreSQL descartável.
ALTER TABLE "outbox_autorizacao_unificada"
  ADD COLUMN "leaseExpiraEm" TIMESTAMP(3),
  ADD COLUMN "motivoRevisao" TEXT;
CREATE INDEX "outbox_autorizacao_unificada_status_leaseExpiraEm_idx"
  ON "outbox_autorizacao_unificada"("status","leaseExpiraEm");