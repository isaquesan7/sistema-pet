-- PointVet M.4C.1: additive fiscal issuer / operational unit foundation.
-- Execute ONLY in disposable CI PostgreSQL until a production migration plan
-- has been approved. All existing Empresa, CNPJ, sales and tax data are intact.
CREATE TABLE "entidades_fiscais" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizacaoId" TEXT NOT NULL,
  "cnpj" TEXT NOT NULL,
  "razaoSocial" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "entidades_fiscais_organizacaoId_fkey"
    FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "entidades_fiscais_organizacaoId_cnpj_key"
  ON "entidades_fiscais"("organizacaoId","cnpj");
CREATE INDEX "entidades_fiscais_organizacaoId_ativo_idx"
  ON "entidades_fiscais"("organizacaoId","ativo");

CREATE TABLE "unidades_operacionais" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizacaoId" TEXT NOT NULL,
  "entidadeFiscalId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "empresaLegadaId" TEXT,
  "ativa" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "unidades_operacionais_organizacaoId_fkey"
    FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "unidades_operacionais_entidadeFiscalId_fkey"
    FOREIGN KEY ("entidadeFiscalId") REFERENCES "entidades_fiscais"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "unidades_operacionais_empresaLegadaId_fkey"
    FOREIGN KEY ("empresaLegadaId") REFERENCES "empresas"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "unidades_operacionais_empresaLegadaId_key"
  ON "unidades_operacionais"("empresaLegadaId");
CREATE UNIQUE INDEX "unidades_operacionais_entidadeFiscalId_codigo_key"
  ON "unidades_operacionais"("entidadeFiscalId","codigo");
CREATE INDEX "unidades_operacionais_organizacaoId_ativa_idx"
  ON "unidades_operacionais"("organizacaoId","ativa");
