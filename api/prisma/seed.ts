import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não encontrada no arquivo .env");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🌱 Iniciando seed da Pet King...");

  // =====================================================
  // ESPÉCIES
  // =====================================================

  const especies = [
    "Cão",
    "Gato",
    "Coelho",
    "Ave",
    "Roedor",
    "Réptil",
    "Outro",
  ];

  for (const nome of especies) {
    await prisma.especie.upsert({
      where: {
        nome,
      },

      update: {
        ativo: true,
      },

      create: {
        nome,
      },
    });
  }

  console.log("✅ Espécies cadastradas.");

  // =====================================================
  // PERMISSÕES DO SISTEMA
  // =====================================================

  const permissoes = [
    {
      codigo: "clientes.visualizar",
      nome: "Visualizar clientes",
      descricao: "Permite visualizar cadastros de clientes.",
    },
    {
      codigo: "clientes.criar",
      nome: "Cadastrar clientes",
      descricao: "Permite cadastrar novos clientes.",
    },
    {
      codigo: "clientes.editar",
      nome: "Editar clientes",
      descricao: "Permite alterar dados de clientes.",
    },

    {
      codigo: "pets.visualizar",
      nome: "Visualizar pets",
      descricao: "Permite visualizar os pets cadastrados.",
    },
    {
      codigo: "pets.criar",
      nome: "Cadastrar pets",
      descricao: "Permite cadastrar novos pets.",
    },
    {
      codigo: "pets.editar",
      nome: "Editar pets",
      descricao: "Permite alterar dados de pets.",
    },

    {
      codigo: "consultorio.acessar",
      nome: "Acessar consultório",
      descricao: "Permite acessar o módulo veterinário.",
    },
    {
      codigo: "consultorio.prontuario",
      nome: "Gerenciar prontuários",
      descricao: "Permite criar e editar prontuários veterinários.",
    },

    {
      codigo: "banho_tosa.acessar",
      nome: "Acessar banho e tosa",
      descricao: "Permite acessar o módulo de banho e tosa.",
    },
    {
      codigo: "banho_tosa.gerenciar",
      nome: "Gerenciar banho e tosa",
      descricao: "Permite gerenciar ordens e serviços de banho e tosa.",
    },

    {
      codigo: "agenda.visualizar",
      nome: "Visualizar agenda",
      descricao: "Permite consultar os agendamentos.",
    },
    {
      codigo: "agenda.gerenciar",
      nome: "Gerenciar agenda",
      descricao: "Permite criar, editar e cancelar agendamentos.",
    },

    {
      codigo: "pdv.acessar",
      nome: "Acessar PDV",
      descricao: "Permite utilizar o frente de caixa.",
    },
    {
      codigo: "pdv.cancelar_venda",
      nome: "Cancelar vendas",
      descricao: "Permite cancelar vendas no PDV.",
    },
    {
      codigo: "pdv.aplicar_desconto",
      nome: "Aplicar descontos",
      descricao: "Permite aplicar descontos em vendas.",
    },

    {
      codigo: "estoque.visualizar",
      nome: "Visualizar estoque",
      descricao: "Permite consultar produtos e estoque.",
    },
    {
      codigo: "estoque.gerenciar",
      nome: "Gerenciar estoque",
      descricao: "Permite realizar movimentações e ajustes de estoque.",
    },

    {
      codigo: "financeiro.visualizar",
      nome: "Visualizar financeiro",
      descricao: "Permite acessar informações financeiras.",
    },
    {
      codigo: "financeiro.gerenciar",
      nome: "Gerenciar financeiro",
      descricao: "Permite realizar operações financeiras.",
    },

    {
      codigo: "usuarios.visualizar",
      nome: "Visualizar usuários",
      descricao: "Permite consultar usuários do sistema.",
    },
    {
      codigo: "usuarios.gerenciar",
      nome: "Gerenciar usuários",
      descricao: "Permite cadastrar e alterar usuários e permissões.",
    },

    {
      codigo: "relatorios.visualizar",
      nome: "Visualizar relatórios",
      descricao: "Permite acessar relatórios gerenciais.",
    },

    {
      codigo: "empresas.gerenciar",
      nome: "Gerenciar empresas",
      descricao: "Permite configurar os CNPJs do sistema.",
    },
  ];

  for (const permissao of permissoes) {
    await prisma.permissao.upsert({
      where: {
        codigo: permissao.codigo,
      },

      update: {
        nome: permissao.nome,
        descricao: permissao.descricao,
      },

      create: permissao,
    });
  }

  console.log("✅ Permissões cadastradas.");

  console.log("");
  console.log("🎉 Seed concluído com sucesso!");
}

main()
  .catch((error) => {
    console.error("❌ Erro durante o seed:");
    console.error(error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });