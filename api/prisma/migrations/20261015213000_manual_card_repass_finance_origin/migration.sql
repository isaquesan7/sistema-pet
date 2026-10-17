-- PointVet M.5.13: separate a human-confirmed manual card deposit
-- from sale receipts and online acquirer transactions. No bank integration.
-- Additive enum only. Workflow applies it to disposable CI PostgreSQL.
ALTER TYPE "OrigemConciliacaoFinanceira" ADD VALUE 'REPASSE_CARTAO_MANUAL_UNIFICADO';
