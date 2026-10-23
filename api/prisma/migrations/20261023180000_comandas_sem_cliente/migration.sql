-- M.5.71: comandas de produtos podem ser abertas sem tutor.
-- A organização passa a ser o limite de autorização, nunca o vínculo opcional do cliente.
-- Preserve todas as comandas e reservas existentes.
ALTER TABLE "comandas" ADD COLUMN "organizacaoId" TEXT;

UPDATE "comandas" AS c
SET "organizacaoId" = cl."organizacaoId"
FROM "clientes" AS cl
WHERE c."clienteId" = cl."id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "comandas" WHERE "organizacaoId" IS NULL) THEN
    RAISE EXCEPTION 'M.5.71: comanda sem organizacao derivavel do tutor; migracao abortada sem alterar o cliente';
  END IF;
END
$$;

ALTER TABLE "comandas" ALTER COLUMN "organizacaoId" SET NOT NULL;
ALTER TABLE "comandas" ALTER COLUMN "clienteId" DROP NOT NULL;

ALTER TABLE "comandas"
  ADD CONSTRAINT "comandas_organizacaoId_fkey"
  FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "comandas_organizacaoId_idx" ON "comandas"("organizacaoId");
