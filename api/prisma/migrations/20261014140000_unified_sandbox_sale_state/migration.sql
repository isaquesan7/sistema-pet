-- 20.2.4A: isolated sandbox sale shells, NEVER authorize production checkout.
ALTER TYPE "StatusReservaOperacaoUnificada" ADD VALUE IF NOT EXISTS 'VENDA_RASCUNHO';
