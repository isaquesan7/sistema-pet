-- Phase 10 — Portal/PWA do Cliente e agendamento online

CREATE TYPE "OrigemAgendamentoConsultorio" AS ENUM ('APP','BALCAO','WHATSAPP','TELEFONE','INTERNO');
CREATE TYPE "StatusTransacaoOnline" AS ENUM ('PENDENTE','PROCESSANDO','APROVADO','RECUSADO','CANCELADO','ESTORNADO','REEMBOLSADO','EXPIRADO');
CREATE TYPE "FormaPagamentoOnline" AS ENUM ('PIX','CARTAO');
CREATE TYPE "ProvedorPagamentoOnline" AS ENUM ('DESENVOLVIMENTO','NAO_CONFIGURADO','MERCADO_PAGO','ASAAS','PAGSEGURO','STRIPE','OUTRO');

ALTER TABLE "agendamentos_banho_tosa"
  ADD COLUMN "reservaExpiraEm" TIMESTAMP(3),
  ADD COLUMN "pagamentoConfirmadoEm" TIMESTAMP(3);

ALTER TABLE "atendimentos_clinicos"
  ADD COLUMN "itemAgendadoId" TEXT,
  ADD COLUMN "origem" "OrigemAgendamentoConsultorio" NOT NULL DEFAULT 'INTERNO',
  ADD COLUMN "agendamentoFim" TIMESTAMP(3);

CREATE TABLE "sessoes_cliente" (
  "id" TEXT NOT NULL,
  "organizacaoId" TEXT NOT NULL,
  "contaClienteId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "userAgent" TEXT,
  "ip" TEXT,
  "lembrarConectado" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sessoes_cliente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transacoes_online" (
  "id" TEXT NOT NULL,
  "organizacaoId" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "contaClienteId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "agendamentoBanhoTosaId" TEXT,
  "provedor" "ProvedorPagamentoOnline" NOT NULL DEFAULT 'NAO_CONFIGURADO',
  "forma" "FormaPagamentoOnline" NOT NULL,
  "status" "StatusTransacaoOnline" NOT NULL DEFAULT 'PENDENTE',
  "valor" DECIMAL(12,2) NOT NULL,
  "referenciaExterna" TEXT,
  "checkoutUrl" TEXT,
  "pixCopiaCola" TEXT,
  "payload" JSONB,
  "expiraEm" TIMESTAMP(3),
  "aprovadoEm" TIMESTAMP(3),
  "canceladoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transacoes_online_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sessoes_cliente_organizacaoId_idx" ON "sessoes_cliente"("organizacaoId");
CREATE INDEX "sessoes_cliente_contaClienteId_idx" ON "sessoes_cliente"("contaClienteId");
CREATE INDEX "sessoes_cliente_expiresAt_idx" ON "sessoes_cliente"("expiresAt");
CREATE INDEX "sessoes_cliente_revokedAt_idx" ON "sessoes_cliente"("revokedAt");

CREATE INDEX "transacoes_online_organizacaoId_idx" ON "transacoes_online"("organizacaoId");
CREATE INDEX "transacoes_online_empresaId_idx" ON "transacoes_online"("empresaId");
CREATE INDEX "transacoes_online_contaClienteId_idx" ON "transacoes_online"("contaClienteId");
CREATE INDEX "transacoes_online_clienteId_idx" ON "transacoes_online"("clienteId");
CREATE INDEX "transacoes_online_agendamentoBanhoTosaId_idx" ON "transacoes_online"("agendamentoBanhoTosaId");
CREATE INDEX "transacoes_online_status_idx" ON "transacoes_online"("status");
CREATE INDEX "transacoes_online_createdAt_idx" ON "transacoes_online"("createdAt");
CREATE INDEX "atendimentos_clinicos_itemAgendadoId_idx" ON "atendimentos_clinicos"("itemAgendadoId");

ALTER TABLE "sessoes_cliente" ADD CONSTRAINT "sessoes_cliente_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessoes_cliente" ADD CONSTRAINT "sessoes_cliente_contaClienteId_fkey" FOREIGN KEY ("contaClienteId") REFERENCES "contas_clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transacoes_online" ADD CONSTRAINT "transacoes_online_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transacoes_online" ADD CONSTRAINT "transacoes_online_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transacoes_online" ADD CONSTRAINT "transacoes_online_contaClienteId_fkey" FOREIGN KEY ("contaClienteId") REFERENCES "contas_clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transacoes_online" ADD CONSTRAINT "transacoes_online_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transacoes_online" ADD CONSTRAINT "transacoes_online_agendamentoBanhoTosaId_fkey" FOREIGN KEY ("agendamentoBanhoTosaId") REFERENCES "agendamentos_banho_tosa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "atendimentos_clinicos" ADD CONSTRAINT "atendimentos_clinicos_itemAgendadoId_fkey" FOREIGN KEY ("itemAgendadoId") REFERENCES "itens_catalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
