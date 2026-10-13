-- Opt-in is disabled for every existing and new organization by default.
ALTER TABLE "configuracoes_organizacao" ADD COLUMN "pdvUnificadoHabilitado" BOOLEAN NOT NULL DEFAULT FALSE;
