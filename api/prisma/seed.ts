import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não encontrada no arquivo .env");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const permissoes = [
  ["clientes.visualizar", "Visualizar clientes", "Permite visualizar cadastros de clientes."],
  ["clientes.criar", "Cadastrar clientes", "Permite cadastrar novos clientes."],
  ["clientes.editar", "Editar clientes", "Permite alterar dados de clientes."],
  ["pets.visualizar", "Visualizar pets", "Permite visualizar os pets cadastrados."],
  ["pets.criar", "Cadastrar pets", "Permite cadastrar novos pets."],
  ["pets.editar", "Editar pets", "Permite alterar dados de pets."],
  ["cadastros.gerenciar", "Gerenciar cadastros auxiliares", "Permite gerenciar espécies, raças e outros cadastros auxiliares."],
  ["catalogo.visualizar", "Visualizar catálogo", "Permite visualizar categorias, produtos e serviços."],
  ["catalogo.gerenciar", "Gerenciar catálogo", "Permite cadastrar e alterar categorias, produtos, serviços e preços."],
  ["consultorio.acessar", "Acessar consultório", "Permite acessar o módulo veterinário."],
  ["consultorio.prontuario", "Gerenciar prontuários", "Permite criar e editar prontuários veterinários."],
  ["consultorio.prescrever", "Emitir prescrições", "Permite criar prescrições e orientações clínicas."],
  ["consultorio.vacinas", "Registrar vacinas e vermífugos", "Permite registrar aplicações, lotes e próximos reforços."],
  ["consultorio.exames", "Gerenciar exames", "Permite solicitar exames e registrar resultados."],
  ["consultorio.documentos", "Emitir documentos clínicos", "Permite emitir receitas, atestados, relatórios e orientações."],
  ["banho_tosa.acessar", "Acessar banho e tosa", "Permite acessar o módulo de banho e tosa."],
  ["banho_tosa.gerenciar", "Gerenciar banho e tosa", "Permite gerenciar ordens e serviços de banho e tosa."],
  ["agenda.visualizar", "Visualizar agenda", "Permite consultar os agendamentos."],
  ["agenda.gerenciar", "Gerenciar agenda", "Permite criar, editar e cancelar agendamentos."],
  ["pdv.acessar", "Acessar PDV", "Permite utilizar o frente de caixa."],
  ["pdv.cancelar_venda", "Cancelar vendas", "Permite cancelar vendas no PDV."],
  ["pdv.aplicar_desconto", "Aplicar descontos", "Permite aplicar descontos em vendas."],
  ["estoque.visualizar", "Visualizar estoque", "Permite consultar produtos e estoque."],
  ["estoque.gerenciar", "Gerenciar estoque", "Permite realizar movimentações e ajustes de estoque."],
  ["financeiro.visualizar", "Visualizar financeiro", "Permite acessar informações financeiras."],
  ["financeiro.gerenciar", "Gerenciar financeiro", "Permite realizar operações financeiras."],
  ["usuarios.visualizar", "Visualizar usuários", "Permite consultar usuários do sistema."],
  ["usuarios.gerenciar", "Gerenciar usuários", "Permite cadastrar e alterar usuários e permissões."],
  ["funcionarios.visualizar", "Visualizar funcionários", "Permite consultar funcionários e jornadas."],
  ["funcionarios.gerenciar", "Gerenciar funcionários", "Permite cadastrar funcionários, funções e jornadas."],
  ["ponto.registrar", "Registrar ponto", "Permite registrar batidas de ponto."],
  ["ponto.gerenciar", "Gerenciar ponto", "Permite visualizar e ajustar registros de ponto."],
  ["ponto.aprovar_ajustes", "Aprovar ajustes de ponto", "Permite aprovar ou rejeitar solicitações de ajuste de ponto."],
  ["ponto.fechamento", "Fechar ponto mensal", "Permite revisar, fechar, reabrir e exportar competências do ponto."],
  ["pacotes.visualizar", "Visualizar pacotes", "Permite consultar modelos e pacotes de clientes."],
  ["pacotes.gerenciar", "Gerenciar pacotes", "Permite criar pacotes e consumir créditos."],
  ["fiscal.visualizar", "Visualizar fiscal", "Permite consultar configurações, cadastros e documentos fiscais."],
  ["fiscal.gerenciar", "Gerenciar fiscal", "Permite configurar empresa e tributação dos itens."],
  ["fiscal.emitir", "Emitir documentos fiscais", "Permite criar e processar documentos fiscais."],
  ["fiscal.cancelar", "Cancelar documentos fiscais", "Permite cancelar documentos fiscais quando permitido."],
  ["relatorios.visualizar", "Visualizar relatórios", "Permite acessar relatórios gerenciais."],
  ["empresas.gerenciar", "Gerenciar empresas", "Permite configurar os CNPJs do sistema."],
  ["organizacao.gerenciar", "Gerenciar organização", "Permite alterar marca, configurações e módulos da organização."],
] as const;

const modulos = [
  "PDV",
  "ESTOQUE",
  "CONSULTORIO",
  "BANHO_TOSA",
  "FINANCEIRO",
  "PORTAL_CLIENTE",
  "PONTO",
  "FISCAL",
  "RELATORIOS",
] as const;

async function main() {
  console.log("🌱 Iniciando seed estrutural da plataforma...");

  const idsPermissoes: string[] = [];
  for (const [codigo, nome, descricao] of permissoes) {
    const permissao = await prisma.permissao.upsert({
      where: { codigo },
      update: { nome, descricao },
      create: { codigo, nome, descricao },
    });
    idsPermissoes.push(permissao.id);
  }
  console.log(`✅ ${idsPermissoes.length} permissões sincronizadas.`);

  // Administradores existentes recebem automaticamente novas permissões.
  const cargosAdmin = await prisma.cargo.findMany({
    where: { nome: { equals: "Administrador", mode: "insensitive" }, ativo: true },
    select: { id: true },
  });

  for (const cargo of cargosAdmin) {
    for (const permissaoId of idsPermissoes) {
      await prisma.cargoPermissao.upsert({
        where: { cargoId_permissaoId: { cargoId: cargo.id, permissaoId } },
        update: {},
        create: { cargoId: cargo.id, permissaoId },
      });
    }
  }
  console.log(`✅ Permissões de ${cargosAdmin.length} cargo(s) Administrador sincronizadas.`);

  // Fase 15: os módulos passam a respeitar o plano contratado.
  // O seed nunca expande silenciosamente um plano comercial.
  const organizacoes = await prisma.organizacao.findMany({
    select: {
      id: true,
      assinaturaSaaS: { select: { plano: { select: { modulos: { select: { modulo: true } } } } } },
    },
  });
  for (const organizacao of organizacoes) {
    const contratados = new Set(organizacao.assinaturaSaaS?.plano.modulos.map((item) => item.modulo) || modulos);
    for (const modulo of modulos) {
      const contratado = contratados.has(modulo);
      await prisma.moduloOrganizacao.upsert({
        where: { organizacaoId_modulo: { organizacaoId: organizacao.id, modulo } },
        update: { contratado, ...(contratado ? {} : { habilitado: false }) },
        create: { organizacaoId: organizacao.id, modulo, contratado, habilitado: contratado },
      });
    }
  }

  console.log("ℹ️ Espécies, raças, categorias, produtos e serviços NÃO são mais criados pelo seed.");
  console.log("   Esses dados são configuráveis por cada organização no painel administrativo.");
  console.log("🎉 Seed estrutural concluído!");
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
