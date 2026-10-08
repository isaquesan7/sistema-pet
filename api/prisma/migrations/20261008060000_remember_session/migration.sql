-- Phase 6 — persistent sessions when "Mantenha-me conectado" is enabled.
ALTER TABLE "sessoes_usuario"
  ADD COLUMN IF NOT EXISTS "lembrarConectado" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "sessoes_usuario"
  ALTER COLUMN "expiresAt" DROP NOT NULL;
