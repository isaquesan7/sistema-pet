import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
if (!process.env.ADMIN_EMAIL) throw new Error("ADMIN_EMAIL não configurado.");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} não configurado no .env`);
  return value;
}

function normalizarCnpj(cnpj: string) {
  const somenteNumeros = cnpj.replace(/\D/g, "");
  if (somenteNumeros.length !== 14) throw new Error(`CNPJ inválido: ${cnpj}`);
  return somenteNumeros;
}

function slugify(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function obterOuCriarOrganizacao(nome: string, slug: string) {
  let organizacao = await prisma.organizacao.findUnique({ where: { slug } });

  if (!organizacao) {
    // Compatibilidade com a migration que agrupou dados legados.
    organizacao = await prisma.organizacao.findUnique({ where: { id: "org_legacy_migration" } });
  }

  if (organizacao) {
    organizacao = await prisma.organizacao.update({
      where: { id: organizacao.id },
      data: { nome, slug, ativo: true },
    });
  } else {
    organizacao = await prisma.organizacao.create({
      data: { nome, slug, ativo: true },
    });
  }

  await prisma.configuracaoOrganizacao.upsert({
    where: { organizacaoId: organizacao.id },
    update: {
      nomeExibicao: process.env.ORGANIZACAO_NOME_EXIBICAO?.trim() || nome,
    },
    create: {
      organizacaoId: organizacao.id,
      nomeExibicao: process.env.ORGANIZACAO_NOME_EXIBICAO?.trim() || nome,
    },
  });

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

  for (const modulo of modulos) {
    await prisma.moduloOrganizacao.upsert({
      where: { organizacaoId_modulo: { organizacaoId: organizacao.id, modulo } },
      update: {},
      create: { organizacaoId: organizacao.id, modulo, habilitado: true },
    });
  }

  return organizacao;
}

async function configurarEmpresa({
  organizacaoId,
  tipo,
  razaoSocial,
  nomeFantasia,
  cnpj,
  usuarioId,
  permissoes,
}: {
  organizacaoId: string;
  tipo: "LOJA_CONSULTORIO" | "BANHO_TOSA" | "OUTRA";
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  usuarioId: string;
  permissoes: { id: string }[];
}) {
  const empresa = await prisma.empresa.upsert({
    where: { cnpj },
    update: { organizacaoId, tipo, razaoSocial, nomeFantasia, ativo: true },
    create: { organizacaoId, tipo, razaoSocial, nomeFantasia, cnpj, ativo: true },
  });

  const cargo = await prisma.cargo.upsert({
    where: { empresaId_nome: { empresaId: empresa.id, nome: "Administrador" } },
    update: { descricao: "Administrador com acesso total à empresa.", ativo: true },
    create: {
      empresaId: empresa.id,
      nome: "Administrador",
      descricao: "Administrador com acesso total à empresa.",
      ativo: true,
    },
  });

  for (const permissao of permissoes) {
    await prisma.cargoPermissao.upsert({
      where: { cargoId_permissaoId: { cargoId: cargo.id, permissaoId: permissao.id } },
      update: {},
      create: { cargoId: cargo.id, permissaoId: permissao.id },
    });
  }

  await prisma.usuarioEmpresa.upsert({
    where: { usuarioId_empresaId: { usuarioId, empresaId: empresa.id } },
    update: { cargoId: cargo.id, ativo: true },
    create: { usuarioId, empresaId: empresa.id, cargoId: cargo.id, ativo: true },
  });

  return { empresa, cargo };
}

async function main() {
  console.log("\n🐾 Configurando organização e empresas...\n");

  const nomeOrganizacao =
    process.env.ORGANIZACAO_NOME?.trim() ||
    process.env.EMPRESA_LOJA_NOME_FANTASIA?.trim() ||
    "Minha Organização";
  const slugOrganizacao =
    process.env.ORGANIZACAO_SLUG?.trim() || slugify(nomeOrganizacao);

  const organizacao = await obterOuCriarOrganizacao(nomeOrganizacao, slugOrganizacao);

  const emailAdmin = process.env.ADMIN_EMAIL!.trim().toLowerCase();
  const usuario = await prisma.usuario.findUnique({ where: { email: emailAdmin } });
  if (!usuario) throw new Error(`Administrador não encontrado com o e-mail ${emailAdmin}`);

  await prisma.usuarioOrganizacao.upsert({
    where: {
      usuarioId_organizacaoId: {
        usuarioId: usuario.id,
        organizacaoId: organizacao.id,
      },
    },
    update: { papel: "PROPRIETARIO", ativo: true },
    create: {
      usuarioId: usuario.id,
      organizacaoId: organizacao.id,
      papel: "PROPRIETARIO",
      ativo: true,
    },
  });

  const permissoes = await prisma.permissao.findMany({ select: { id: true } });
  if (!permissoes.length) throw new Error("Nenhuma permissão encontrada. Execute o seed antes.");

  const loja = await configurarEmpresa({
    organizacaoId: organizacao.id,
    tipo: "LOJA_CONSULTORIO",
    razaoSocial: required("EMPRESA_LOJA_RAZAO_SOCIAL"),
    nomeFantasia: required("EMPRESA_LOJA_NOME_FANTASIA"),
    cnpj: normalizarCnpj(required("EMPRESA_LOJA_CNPJ")),
    usuarioId: usuario.id,
    permissoes,
  });

  const banho = await configurarEmpresa({
    organizacaoId: organizacao.id,
    tipo: "BANHO_TOSA",
    razaoSocial: required("EMPRESA_BANHO_RAZAO_SOCIAL"),
    nomeFantasia: required("EMPRESA_BANHO_NOME_FANTASIA"),
    cnpj: normalizarCnpj(required("EMPRESA_BANHO_CNPJ")),
    usuarioId: usuario.id,
    permissoes,
  });

  console.log(`✅ Organização: ${organizacao.nome} (${organizacao.slug})`);
  console.log(`✅ Empresa 1: ${loja.empresa.nomeFantasia} — ${loja.empresa.tipo}`);
  console.log(`✅ Empresa 2: ${banho.empresa.nomeFantasia} — ${banho.empresa.tipo}`);
  console.log(`✅ Administrador vinculado à organização e às duas empresas com ${permissoes.length} permissões.`);
  console.log("\n🎉 Configuração concluída!\n");
}

main()
  .catch((error) => {
    console.error("\n❌ Erro na configuração:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
