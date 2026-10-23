-- Rascunhos do PDV unificado permanecem separados do faturamento legado.
ALTER TABLE "comandas" ADD COLUMN "rascunhoUnificado" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "comandas" ADD COLUMN "versaoRascunho" INTEGER NOT NULL DEFAULT 1;
