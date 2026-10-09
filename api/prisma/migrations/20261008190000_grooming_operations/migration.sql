-- Phase 9 — Banho e Tosa

CREATE TYPE "StatusAgendamentoBanhoTosa" AS ENUM ('AGUARDANDO_PAGAMENTO','PENDENTE','CONFIRMADO','CHECK_IN','EM_ATENDIMENTO','CONCLUIDO','CANCELADO','FALTOU');
CREATE TYPE "OrigemAgendamentoBanhoTosa" AS ENUM ('APP','BALCAO','WHATSAPP','TELEFONE','INTERNO');
CREATE TYPE "StatusOrdemBanhoTosa" AS ENUM ('AGUARDANDO','EM_BANHO','EM_SECAGEM','EM_TOSA','FINALIZADO','AGUARDANDO_RETIRADA','ENTREGUE','CANCELADO');
CREATE TYPE "TipoAnexoBanhoTosa" AS ENUM ('ENTRADA','ANTES','DEPOIS','LESAO','OBSERVACAO');

CREATE TABLE "fichas_banho_tosa_pet" (
  "id" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "tipoPelagem" TEXT,
  "temperamento" TEXT,
  "aceitaSecador" BOOLEAN,
  "aceitaMaquina" BOOLEAN,
  "aceitaUnhas" BOOLEAN,
  "alergiaProdutos" TEXT,
  "shampooPreferencial" TEXT,
  "restricoes" TEXT,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fichas_banho_tosa_pet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agendamentos_banho_tosa" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "profissionalId" TEXT,
  "status" "StatusAgendamentoBanhoTosa" NOT NULL DEFAULT 'CONFIRMADO',
  "origem" "OrigemAgendamentoBanhoTosa" NOT NULL DEFAULT 'INTERNO',
  "inicio" TIMESTAMP(3) NOT NULL,
  "fim" TIMESTAMP(3) NOT NULL,
  "observacoesCliente" TEXT,
  "observacoesInternas" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agendamentos_banho_tosa_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agendamento_banho_tosa_itens" (
  "id" TEXT NOT NULL,
  "agendamentoId" TEXT NOT NULL,
  "itemCatalogoId" TEXT NOT NULL,
  "quantidade" DECIMAL(12,3) NOT NULL DEFAULT 1,
  "valorUnitario" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "agendamento_banho_tosa_itens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ordens_servico_banho_tosa" (
  "id" TEXT NOT NULL,
  "numero" SERIAL NOT NULL,
  "empresaId" TEXT NOT NULL,
  "agendamentoId" TEXT,
  "clienteId" TEXT NOT NULL,
  "petId" TEXT NOT NULL,
  "profissionalId" TEXT,
  "comandaId" TEXT,
  "status" "StatusOrdemBanhoTosa" NOT NULL DEFAULT 'AGUARDANDO',
  "entrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previsaoSaida" TIMESTAMP(3),
  "saida" TIMESTAMP(3),
  "observacoesEntrada" TEXT,
  "observacoesSaida" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ordens_servico_banho_tosa_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ordem_servico_banho_tosa_itens" (
  "id" TEXT NOT NULL,
  "ordemId" TEXT NOT NULL,
  "itemCatalogoId" TEXT NOT NULL,
  "comandaItemId" TEXT,
  "pacoteClienteItemId" TEXT,
  "quantidade" DECIMAL(12,3) NOT NULL DEFAULT 1,
  "valorUnitario" DECIMAL(12,2) NOT NULL,
  "viaPacote" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ordem_servico_banho_tosa_itens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "anexos_banho_tosa" (
  "id" TEXT NOT NULL,
  "ordemId" TEXT NOT NULL,
  "tipo" "TipoAnexoBanhoTosa" NOT NULL,
  "url" TEXT NOT NULL,
  "legenda" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anexos_banho_tosa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fichas_banho_tosa_pet_petId_key" ON "fichas_banho_tosa_pet"("petId");
CREATE INDEX "agendamentos_banho_tosa_empresaId_inicio_idx" ON "agendamentos_banho_tosa"("empresaId","inicio");
CREATE INDEX "agendamentos_banho_tosa_profissionalId_inicio_idx" ON "agendamentos_banho_tosa"("profissionalId","inicio");
CREATE INDEX "agendamentos_banho_tosa_petId_inicio_idx" ON "agendamentos_banho_tosa"("petId","inicio");
CREATE INDEX "agendamentos_banho_tosa_status_idx" ON "agendamentos_banho_tosa"("status");
CREATE UNIQUE INDEX "agendamento_banho_tosa_itens_agendamentoId_itemCatalogoId_key" ON "agendamento_banho_tosa_itens"("agendamentoId","itemCatalogoId");
CREATE INDEX "agendamento_banho_tosa_itens_itemCatalogoId_idx" ON "agendamento_banho_tosa_itens"("itemCatalogoId");
CREATE UNIQUE INDEX "ordens_servico_banho_tosa_numero_key" ON "ordens_servico_banho_tosa"("numero");
CREATE UNIQUE INDEX "ordens_servico_banho_tosa_agendamentoId_key" ON "ordens_servico_banho_tosa"("agendamentoId");
CREATE INDEX "ordens_servico_banho_tosa_empresaId_status_idx" ON "ordens_servico_banho_tosa"("empresaId","status");
CREATE INDEX "ordens_servico_banho_tosa_petId_entrada_idx" ON "ordens_servico_banho_tosa"("petId","entrada");
CREATE INDEX "ordens_servico_banho_tosa_profissionalId_entrada_idx" ON "ordens_servico_banho_tosa"("profissionalId","entrada");
CREATE INDEX "ordens_servico_banho_tosa_comandaId_idx" ON "ordens_servico_banho_tosa"("comandaId");
CREATE UNIQUE INDEX "ordem_servico_banho_tosa_itens_comandaItemId_key" ON "ordem_servico_banho_tosa_itens"("comandaItemId");
CREATE INDEX "ordem_servico_banho_tosa_itens_ordemId_idx" ON "ordem_servico_banho_tosa_itens"("ordemId");
CREATE INDEX "ordem_servico_banho_tosa_itens_itemCatalogoId_idx" ON "ordem_servico_banho_tosa_itens"("itemCatalogoId");
CREATE INDEX "ordem_servico_banho_tosa_itens_pacoteClienteItemId_idx" ON "ordem_servico_banho_tosa_itens"("pacoteClienteItemId");
CREATE INDEX "anexos_banho_tosa_ordemId_idx" ON "anexos_banho_tosa"("ordemId");
CREATE INDEX "anexos_banho_tosa_tipo_idx" ON "anexos_banho_tosa"("tipo");

ALTER TABLE "fichas_banho_tosa_pet" ADD CONSTRAINT "fichas_banho_tosa_pet_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agendamentos_banho_tosa" ADD CONSTRAINT "agendamentos_banho_tosa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agendamentos_banho_tosa" ADD CONSTRAINT "agendamentos_banho_tosa_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agendamentos_banho_tosa" ADD CONSTRAINT "agendamentos_banho_tosa_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agendamentos_banho_tosa" ADD CONSTRAINT "agendamentos_banho_tosa_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "funcionarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agendamento_banho_tosa_itens" ADD CONSTRAINT "agendamento_banho_tosa_itens_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos_banho_tosa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agendamento_banho_tosa_itens" ADD CONSTRAINT "agendamento_banho_tosa_itens_itemCatalogoId_fkey" FOREIGN KEY ("itemCatalogoId") REFERENCES "itens_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ordens_servico_banho_tosa" ADD CONSTRAINT "ordens_servico_banho_tosa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ordens_servico_banho_tosa" ADD CONSTRAINT "ordens_servico_banho_tosa_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos_banho_tosa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordens_servico_banho_tosa" ADD CONSTRAINT "ordens_servico_banho_tosa_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ordens_servico_banho_tosa" ADD CONSTRAINT "ordens_servico_banho_tosa_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ordens_servico_banho_tosa" ADD CONSTRAINT "ordens_servico_banho_tosa_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "funcionarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordens_servico_banho_tosa" ADD CONSTRAINT "ordens_servico_banho_tosa_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordem_servico_banho_tosa_itens" ADD CONSTRAINT "ordem_servico_banho_tosa_itens_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "ordens_servico_banho_tosa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ordem_servico_banho_tosa_itens" ADD CONSTRAINT "ordem_servico_banho_tosa_itens_itemCatalogoId_fkey" FOREIGN KEY ("itemCatalogoId") REFERENCES "itens_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ordem_servico_banho_tosa_itens" ADD CONSTRAINT "ordem_servico_banho_tosa_itens_comandaItemId_fkey" FOREIGN KEY ("comandaItemId") REFERENCES "comanda_itens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ordem_servico_banho_tosa_itens" ADD CONSTRAINT "ordem_servico_banho_tosa_itens_pacoteClienteItemId_fkey" FOREIGN KEY ("pacoteClienteItemId") REFERENCES "pacote_cliente_itens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "anexos_banho_tosa" ADD CONSTRAINT "anexos_banho_tosa_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "ordens_servico_banho_tosa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
