-- CreateEnum
CREATE TYPE "TipoEmpresa" AS ENUM ('LOJA_CONSULTORIO', 'BANHO_TOSA');

-- CreateEnum
CREATE TYPE "StatusUsuario" AS ENUM ('ATIVO', 'INATIVO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "StatusContaCliente" AS ENUM ('PENDENTE', 'ATIVA', 'BLOQUEADA', 'INATIVA');

-- CreateEnum
CREATE TYPE "SexoPet" AS ENUM ('MACHO', 'FEMEA', 'NAO_INFORMADO');

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "tipo" "TipoEmpresa" NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "inscricaoEstadual" TEXT,
    "inscricaoMunicipal" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "telefone" TEXT,
    "status" "StatusUsuario" NOT NULL DEFAULT 'ATIVO',
    "ultimoAcesso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissoes" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo_permissoes" (
    "cargoId" TEXT NOT NULL,
    "permissaoId" TEXT NOT NULL,

    CONSTRAINT "cargo_permissoes_pkey" PRIMARY KEY ("cargoId","permissaoId")
);

-- CreateTable
CREATE TABLE "usuario_empresas" (
    "usuarioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "cargoId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_empresas_pkey" PRIMARY KEY ("usuarioId","empresaId")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpfCnpj" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "dataNascimento" DATE,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_clientes" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "senhaHash" TEXT NOT NULL,
    "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
    "telefoneVerificado" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatusContaCliente" NOT NULL DEFAULT 'PENDENTE',
    "ultimoAcesso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contas_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especies" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "especies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "racas" (
    "id" TEXT NOT NULL,
    "especieId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "racas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "especieId" TEXT NOT NULL,
    "racaId" TEXT,
    "nome" TEXT NOT NULL,
    "sexo" "SexoPet" NOT NULL DEFAULT 'NAO_INFORMADO',
    "dataNascimento" DATE,
    "castrado" BOOLEAN,
    "cor" TEXT,
    "microchip" TEXT,
    "fotoUrl" TEXT,
    "alergias" TEXT,
    "doencasPreexistentes" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_pesos" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "peso" DECIMAL(6,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origem" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_pesos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "cargos_empresaId_idx" ON "cargos"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "cargos_empresaId_nome_key" ON "cargos"("empresaId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "permissoes_codigo_key" ON "permissoes"("codigo");

-- CreateIndex
CREATE INDEX "usuario_empresas_empresaId_idx" ON "usuario_empresas"("empresaId");

-- CreateIndex
CREATE INDEX "usuario_empresas_cargoId_idx" ON "usuario_empresas"("cargoId");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cpfCnpj_key" ON "clientes"("cpfCnpj");

-- CreateIndex
CREATE INDEX "clientes_nome_idx" ON "clientes"("nome");

-- CreateIndex
CREATE INDEX "clientes_telefone_idx" ON "clientes"("telefone");

-- CreateIndex
CREATE INDEX "clientes_whatsapp_idx" ON "clientes"("whatsapp");

-- CreateIndex
CREATE INDEX "clientes_email_idx" ON "clientes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contas_clientes_clienteId_key" ON "contas_clientes"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "contas_clientes_email_key" ON "contas_clientes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contas_clientes_telefone_key" ON "contas_clientes"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "especies_nome_key" ON "especies"("nome");

-- CreateIndex
CREATE INDEX "racas_especieId_idx" ON "racas"("especieId");

-- CreateIndex
CREATE UNIQUE INDEX "racas_especieId_nome_key" ON "racas"("especieId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "pets_microchip_key" ON "pets"("microchip");

-- CreateIndex
CREATE INDEX "pets_clienteId_idx" ON "pets"("clienteId");

-- CreateIndex
CREATE INDEX "pets_especieId_idx" ON "pets"("especieId");

-- CreateIndex
CREATE INDEX "pets_racaId_idx" ON "pets"("racaId");

-- CreateIndex
CREATE INDEX "pets_nome_idx" ON "pets"("nome");

-- CreateIndex
CREATE INDEX "pet_pesos_petId_idx" ON "pet_pesos"("petId");

-- CreateIndex
CREATE INDEX "pet_pesos_data_idx" ON "pet_pesos"("data");

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_permissoes" ADD CONSTRAINT "cargo_permissoes_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "cargos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_permissoes" ADD CONSTRAINT "cargo_permissoes_permissaoId_fkey" FOREIGN KEY ("permissaoId") REFERENCES "permissoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_empresas" ADD CONSTRAINT "usuario_empresas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_empresas" ADD CONSTRAINT "usuario_empresas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_empresas" ADD CONSTRAINT "usuario_empresas_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "cargos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_clientes" ADD CONSTRAINT "contas_clientes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racas" ADD CONSTRAINT "racas_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_racaId_fkey" FOREIGN KEY ("racaId") REFERENCES "racas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_pesos" ADD CONSTRAINT "pet_pesos_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
