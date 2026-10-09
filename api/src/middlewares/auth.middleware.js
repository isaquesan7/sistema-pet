import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { assinaturaBloqueada } from "../modules/saas/saas.service.js";

// ======================================================
// USUÁRIO AUTENTICADO
// ======================================================

export async function autenticarUsuario(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        success: false,
        message: "Token de acesso não informado.",
      });
    }

    const [tipo, token] = authorization.split(" ");

    if (tipo !== "Bearer" || !token) {
      return res.status(401).json({
        success: false,
        message: "Token de acesso inválido.",
      });
    }

    let payload;

    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Token inválido ou expirado.",
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        nome: true,
        email: true,
        status: true,
        superAdmin: true,
      },
    });

    if (!usuario || usuario.status !== "ATIVO") {
      return res.status(401).json({
        success: false,
        message: "Usuário inválido ou inativo.",
      });
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    next(error);
  }
}

// ======================================================
// EMPRESA + ORGANIZAÇÃO (TENANT) SELECIONADAS
// ======================================================

export async function selecionarEmpresa(req, res, next) {
  try {
    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message: "Usuário não autenticado.",
      });
    }

    const empresaId = req.headers["x-empresa-id"];

    if (!empresaId) {
      return res.status(400).json({
        success: false,
        message: "Empresa não informada. Utilize o cabeçalho X-Empresa-Id.",
      });
    }

    const vinculo = await prisma.usuarioEmpresa.findUnique({
      where: {
        usuarioId_empresaId: {
          usuarioId: req.usuario.id,
          empresaId,
        },
      },
      include: {
        empresa: {
          include: {
            organizacao: {
              include: {
                configuracao: true,
                modulos: true,
                assinaturaSaaS: { include: { plano: { include: { modulos: true } } } },
              },
            },
          },
        },
        cargo: {
          include: {
            permissoes: {
              include: { permissao: true },
            },
          },
        },
      },
    });

    if (!vinculo || !vinculo.ativo || !vinculo.empresa.ativo) {
      return res.status(403).json({
        success: false,
        message: "Você não possui acesso a esta empresa.",
      });
    }

    const organizacao = vinculo.empresa.organizacao;

    if (!organizacao?.ativo) {
      return res.status(403).json({
        success: false,
        message: "A organização vinculada a esta empresa está inativa.",
      });
    }

    const acessoAssinatura = assinaturaBloqueada(organizacao.assinaturaSaaS);
    if (acessoAssinatura.bloqueada) {
      return res.status(402).json({
        success: false,
        message: acessoAssinatura.motivo === "TRIAL_EXPIRADO"
          ? "O período de teste desta organização terminou. Regularize a assinatura para continuar."
          : "A assinatura PetRise desta organização não permite acesso no momento.",
        code: acessoAssinatura.motivo,
      });
    }

    const vinculoOrganizacao = await prisma.usuarioOrganizacao.findUnique({
      where: {
        usuarioId_organizacaoId: {
          usuarioId: req.usuario.id,
          organizacaoId: organizacao.id,
        },
      },
    });

    if (!vinculoOrganizacao?.ativo) {
      return res.status(403).json({
        success: false,
        message: "Você não possui acesso a esta organização.",
      });
    }

    req.empresa = vinculo.empresa;
    req.organizacao = organizacao;
    req.vinculoEmpresa = vinculo;
    req.vinculoOrganizacao = vinculoOrganizacao;
    req.assinaturaSaaS = organizacao.assinaturaSaaS;
    req.permissoes =
      vinculo.cargo?.permissoes.map((item) => item.permissao.codigo) || [];
    req.modulosHabilitados = organizacao.modulos
      .filter((item) => item.habilitado && item.contratado)
      .map((item) => item.modulo);

    next();
  } catch (error) {
    next(error);
  }
}

// ======================================================
// SELEÇÃO DE EMPRESA PARA REGULARIZAÇÃO DA ASSINATURA
// Permite abrir a área de cobrança mesmo quando o trial/assinatura bloqueou o restante.
// ======================================================

export async function selecionarEmpresaParaAssinatura(req, res, next) {
  try {
    const empresaId = req.headers["x-empresa-id"];
    if (!req.usuario) return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    if (!empresaId) return res.status(400).json({ success: false, message: "Empresa não informada." });

    const vinculo = await prisma.usuarioEmpresa.findUnique({
      where: { usuarioId_empresaId: { usuarioId: req.usuario.id, empresaId } },
      include: {
        empresa: { include: { organizacao: { include: { configuracao: true, modulos: true, assinaturaSaaS: { include: { plano: { include: { modulos: true } } } } } } } },
        cargo: { include: { permissoes: { include: { permissao: true } } } },
      },
    });
    if (!vinculo || !vinculo.ativo || !vinculo.empresa.ativo || !vinculo.empresa.organizacao?.ativo) {
      return res.status(403).json({ success: false, message: "Você não possui acesso a esta organização." });
    }
    const vinculoOrganizacao = await prisma.usuarioOrganizacao.findUnique({
      where: { usuarioId_organizacaoId: { usuarioId: req.usuario.id, organizacaoId: vinculo.empresa.organizacaoId } },
    });
    if (!vinculoOrganizacao?.ativo) return res.status(403).json({ success: false, message: "Você não possui acesso a esta organização." });

    req.empresa = vinculo.empresa;
    req.organizacao = vinculo.empresa.organizacao;
    req.vinculoEmpresa = vinculo;
    req.vinculoOrganizacao = vinculoOrganizacao;
    req.assinaturaSaaS = vinculo.empresa.organizacao.assinaturaSaaS;
    req.permissoes = vinculo.cargo?.permissoes.map((item) => item.permissao.codigo) || [];
    req.modulosHabilitados = vinculo.empresa.organizacao.modulos.filter((item) => item.habilitado && item.contratado).map((item) => item.modulo);
    next();
  } catch (error) { next(error); }
}

export function exigirGestorOrganizacao(req, res, next) {
  if (!req.vinculoOrganizacao || !["PROPRIETARIO", "ADMINISTRADOR"].includes(req.vinculoOrganizacao.papel)) {
    return res.status(403).json({ success: false, message: "Somente proprietário ou administrador da organização pode acessar a assinatura." });
  }
  next();
}

// ======================================================
// ADMINISTRAÇÃO INTERNA DA PLATAFORMA PETRISE
// ======================================================

export function exigirSuperAdmin(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ success: false, message: "Usuário não autenticado." });
  }
  if (!req.usuario.superAdmin) {
    return res.status(403).json({ success: false, message: "Acesso restrito à administração interna do PetRise." });
  }
  next();
}

// ======================================================
// VERIFICAÇÃO DE PERMISSÃO
// ======================================================

export function exigirPermissao(codigo) {
  return function (req, res, next) {
    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message: "Usuário não autenticado.",
      });
    }

    if (!req.empresa || !req.organizacao) {
      return res.status(400).json({
        success: false,
        message: "Empresa/organização não selecionada.",
      });
    }

    if (!req.permissoes?.includes(codigo)) {
      return res.status(403).json({
        success: false,
        message: "Você não possui permissão para realizar esta operação.",
        permissaoNecessaria: codigo,
      });
    }

    next();
  };
}

// ======================================================
// VERIFICAÇÃO DE MÓDULO CONTRATADO/HABILITADO
// ======================================================

export function exigirModulo(modulo) {
  return function (req, res, next) {
    if (!req.organizacao) {
      return res.status(400).json({
        success: false,
        message: "Organização não selecionada.",
      });
    }

    if (!req.modulosHabilitados?.includes(modulo)) {
      return res.status(403).json({
        success: false,
        message: "Este módulo não está habilitado para a organização.",
        moduloNecessario: modulo,
      });
    }

    next();
  };
}
