/**
 * PetRise — Hotfix 15.1
 * Repara de forma idempotente o estado esperado pela migration
 * 20261009013000_timeclock_monthly_close sem editar o histórico da migration.
 *
 * Depois de executar este script com sucesso:
 *   npx prisma migrate resolve --applied 20261009013000_timeclock_monthly_close
 *   npx prisma migrate deploy
 *   npx prisma generate
 */
import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const MIGRATION = "20261009013000_timeclock_monthly_close";

if (!process.env.DATABASE_URL) {
  console.error("[PetRise] DATABASE_URL não encontrada no api/.env.");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

const sql = String.raw`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE t.typname = 'StatusAjustePonto'
       AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "StatusAjustePonto" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');
  END IF;
END
$$;

ALTER TABLE "ajustes_ponto"
  ADD COLUMN IF NOT EXISTS "analisadoPorId" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "StatusAjustePonto",
  ADD COLUMN IF NOT EXISTS "analisadoEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "observacaoAnalise" TEXT;

DO $$
DECLARE
  tipo_coluna TEXT;
BEGIN
  SELECT c.udt_name
    INTO tipo_coluna
    FROM information_schema.columns c
   WHERE c.table_schema = current_schema()
     AND c.table_name = 'ajustes_ponto'
     AND c.column_name = 'status';

  IF tipo_coluna IS NOT NULL AND tipo_coluna <> 'StatusAjustePonto' THEN
    ALTER TABLE "ajustes_ponto" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "ajustes_ponto"
      ALTER COLUMN "status" TYPE "StatusAjustePonto"
      USING "status"::text::"StatusAjustePonto";
  END IF;
END
$$;

-- Ajustes criados antes da Fase 12 já tinham efeito imediato; por isso são aprovados.
UPDATE "ajustes_ponto"
   SET "status" = 'APROVADO'
 WHERE "status" IS NULL;

ALTER TABLE "ajustes_ponto" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "ajustes_ponto" ALTER COLUMN "status" SET DEFAULT 'PENDENTE';

CREATE INDEX IF NOT EXISTS "ajustes_ponto_analisadoPorId_idx"
  ON "ajustes_ponto"("analisadoPorId");
CREATE INDEX IF NOT EXISTS "ajustes_ponto_status_createdAt_idx"
  ON "ajustes_ponto"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ajustes_ponto_analisadoPorId_fkey'
       AND conrelid = '"ajustes_ponto"'::regclass
  ) THEN
    ALTER TABLE "ajustes_ponto"
      ADD CONSTRAINT "ajustes_ponto_analisadoPorId_fkey"
      FOREIGN KEY ("analisadoPorId") REFERENCES "usuarios"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

ALTER TABLE "fechamentos_ponto"
  ADD COLUMN IF NOT EXISTS "reabertoPorId" TEXT,
  ADD COLUMN IF NOT EXISTS "saldoBancoAnterior" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "saldoBancoCompetencia" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "saldoBancoAcumulado" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "divergencias" JSONB,
  ADD COLUMN IF NOT EXISTS "espelho" JSONB,
  ADD COLUMN IF NOT EXISTS "observacoes" TEXT,
  ADD COLUMN IF NOT EXISTS "reabertoEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "motivoReabertura" TEXT;

CREATE INDEX IF NOT EXISTS "fechamentos_ponto_reabertoPorId_idx"
  ON "fechamentos_ponto"("reabertoPorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'fechamentos_ponto_reabertoPorId_fkey'
       AND conrelid = '"fechamentos_ponto"'::regclass
  ) THEN
    ALTER TABLE "fechamentos_ponto"
      ADD CONSTRAINT "fechamentos_ponto_reabertoPorId_fkey"
      FOREIGN KEY ("reabertoPorId") REFERENCES "usuarios"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
`;

async function main() {
  await client.connect();

  const before = await client.query(
    `SELECT migration_name, started_at, finished_at, rolled_back_at, logs
       FROM "_prisma_migrations"
      WHERE migration_name = $1
      ORDER BY started_at DESC`,
    [MIGRATION],
  );

  if (before.rows.length) {
    const latest = before.rows[0];
    console.log(`[PetRise] Migration encontrada: ${MIGRATION}`);
    console.log(`[PetRise] started_at: ${latest.started_at ?? "-"}`);
    console.log(`[PetRise] finished_at: ${latest.finished_at ?? "-"}`);
    console.log(`[PetRise] rolled_back_at: ${latest.rolled_back_at ?? "-"}`);
    if (latest.logs) {
      console.log("\n[PetRise] Log armazenado pelo Prisma para a tentativa que falhou:\n");
      console.log(latest.logs);
      console.log("\n--- fim do log Prisma ---\n");
    }
  } else {
    console.log(`[PetRise] Nenhum registro encontrado para ${MIGRATION}; a reparação ainda pode ser aplicada com segurança.`);
  }

  console.log("[PetRise] Aplicando reparação idempotente da Fase 12...");
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  const verification = await client.query(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'ajustes_ponto'
          AND column_name = 'status'
      ) AS ajuste_status,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'ajustes_ponto'
          AND column_name = 'analisadoPorId'
      ) AS ajuste_analise,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'fechamentos_ponto'
          AND column_name = 'saldoBancoAcumulado'
      ) AS banco_horas,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'fechamentos_ponto'
          AND column_name = 'espelho'
      ) AS espelho,
      EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ajustes_ponto_analisadoPorId_fkey'
      ) AS fk_ajuste,
      EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fechamentos_ponto_reabertoPorId_fkey'
      ) AS fk_reabertura;
  `);

  const checks = verification.rows[0];
  const ok = Object.values(checks).every(Boolean);
  console.log("[PetRise] Verificação:", checks);

  if (!ok) {
    throw new Error("A reparação terminou, mas uma ou mais estruturas esperadas não foram encontradas.");
  }

  console.log("\n[PetRise] Reparação concluída com sucesso.");
  console.log("Agora execute, nesta ordem:");
  console.log(`  npx prisma migrate resolve --applied ${MIGRATION}`);
  console.log("  npx prisma migrate deploy");
  console.log("  npx prisma generate");
  console.log("  npm run db:seed");
}

main()
  .catch((error) => {
    console.error("\n[PetRise] Falha ao reparar a migration:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
