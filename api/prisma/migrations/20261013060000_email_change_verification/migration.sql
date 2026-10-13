-- Store pending address separately. Do not modify the login email before verification.
CREATE TABLE "alteracoes_email_pendentes" (
  "id" TEXT PRIMARY KEY,
  "usuarioId" TEXT NOT NULL UNIQUE REFERENCES "usuarios"("id") ON DELETE CASCADE,
  "emailNovo" TEXT NOT NULL,
  "codigoHash" TEXT NOT NULL,
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
