-- M.5.14: reversal is an additional compensating financial event,
-- never DELETE of the original manual card repasse.
-- Only applied on isolated disposable PostgreSQL in CI until deployment approval.
ALTER TYPE "OrigemConciliacaoFinanceira"
 ADD VALUE 'ESTORNO_REPASSE_CARTAO_MANUAL_UNIFICADO';
