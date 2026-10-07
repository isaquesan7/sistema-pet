import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não configurada.");
}

if (!process.env.ADMIN_EMAIL) {
  throw new Error("ADMIN_EMAIL não configurado.");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

function required(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} não configurado no .env`);
  }

  return value;
}

function normalizarCnpj(cnpj: string) {
  const somenteNumeros = cnpj.replace(/\D/g, "");

  if (somenteNumeros.length !== 14) {
    throw new Error(`CNPJ inválido: ${cnpj}`);
  }

  return somenteNumeros;
}

async function configurarEmpresa({
  tipo,
  razaoSocial,
  nomeFantasia,
  cnpj,
  usuarioId,
  permissoes,
}: {
  tipo: "LOJA_CONSULTORIO" | "BANHO_TOSA";
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  usuarioId: string;
  permissoes: { id: string }[];
}) {
  const empresa = await prisma.empresa.upsert({
    where: {
      cnpj,
    },

    update: {
      tipo,
      razaoSocial,
      nomeFantasia,
      ativo: true,
    },

    create: {
      tipo,
      razaoSocial,
      nomeFantasia,
      cnpj,
      ativo: true,
    },
  });

  const cargo = await prisma.cargo.upsert({
    where: {
      empresaId_nome: {
        empresaId: empresa.id,
        nome: "Administrador",
      },
    },

    update: {
      descricao: "Administrador com acesso total à empresa.",
      ativo: true,
    },

    create: {
      empresaId: empresa.id,
      nome: "Administrador",
      descricao: "Administrador com acesso total à empresa.",
      ativo: true,
    },
  });

  for (const permissao of permissoes) {
    await prisma.cargoPermissao.upsert({
      where: {
        cargoId_permissaoId: {
          cargoId: cargo.id,
          permissaoId: permissao.id,
        },
      },

      update: {},

      create: {
        cargoId: cargo.id,
        permissaoId: permissao.id,
      },
    });
  }

  await prisma.usuarioEmpresa.upsert({
    where: {
      usuarioId_empresaId: {
        usuarioId,
        empresaId: empresa.id,
      },
    },

    update: {
      cargoId: cargo.id,
      ativo: true,
    },

    create: {
      usuarioId,
      empresaId: empresa.id,
      cargoId: cargo.id,
      ativo: true,
    },
  });

  return {
    empresa,
    cargo,
  };
}

async function main() {
  console.log("");
  console.log("🐾 Configurando estrutura empresarial Pet King...");
  console.log("");

  const emailAdmin = process.env.ADMIN_EMAIL!
    .trim()
    .toLowerCase();

  const usuario = await prisma.usuario.findUnique({
    where: {
      email: emailAdmin,
    },
  });

  if (!usuario) {
    throw new Error(
      `Administrador não encontrado com o e-mail ${emailAdmin}`
    );
  }

  const permissoes = await prisma.permissao.findMany({
    select: {
      id: true,
    },
  });

  if (permissoes.length === 0) {
    throw new Error(
      "Nenhuma permissão encontrada. Execute o seed antes."
    );
  }

  const loja = await configurarEmpresa({
    tipo: "LOJA_CONSULTORIO",

    razaoSocial: required(
      "EMPRESA_LOJA_RAZAO_SOCIAL"
    ),

    nomeFantasia: required(
      "EMPRESA_LOJA_NOME_FANTASIA"
    ),

    cnpj: normalizarCnpj(
      required("EMPRESA_LOJA_CNPJ")
    ),

    usuarioId: usuario.id,
    permissoes,
  });

  const banho = await configurarEmpresa({
    tipo: "BANHO_TOSA",

    razaoSocial: required(
      "EMPRESA_BANHO_RAZAO_SOCIAL"
    ),

    nomeFantasia: required(
      "EMPRESA_BANHO_NOME_FANTASIA"
    ),

    cnpj: normalizarCnpj(
      required("EMPRESA_BANHO_CNPJ")
    ),

    usuarioId: usuario.id,
    permissoes,
  });

  console.log("✅ Empresa 1 configurada:");
  console.log(`   ${loja.empresa.nomeFantasia}`);
  console.log(`   Tipo: ${loja.empresa.tipo}`);

  console.log("");

  console.log("✅ Empresa 2 configurada:");
  console.log(`   ${banho.empresa.nomeFantasia}`);
  console.log(`   Tipo: ${banho.empresa.tipo}`);

  console.log("");

  console.log(
    `✅ Administrador vinculado às duas empresas com ${permissoes.length} permissões.`
  );

  console.log("");
  console.log("🎉 Configuração concluída!");
  console.log("");
}

main()
  .catch((error) => {
    console.error("");
    console.error("❌ Erro na configuração:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });