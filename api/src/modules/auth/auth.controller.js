import * as authService from "./auth.service.js";

export async function login(req, res, next) {
  try {
    const { email, senha, manterConectado = false } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        success: false,
        message: "E-mail e senha são obrigatórios.",
      });
    }

    const resultado = await authService.login({
      email,
      senha,
      manterConectado: Boolean(manterConectado),
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(200).json({ success: true, ...resultado });
  } catch (error) {
    if (error.message === "CREDENCIAIS_INVALIDAS") {
      return res.status(401).json({
        success: false,
        message: "E-mail ou senha inválidos.",
      });
    }
    next(error);
  }
}

export async function renovar(req, res, next) {
  try {
    const resultado = await authService.refresh({
      refreshToken: req.body?.refreshToken,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    return res.status(200).json({ success: true, ...resultado });
  } catch (error) {
    if (error.message === "REFRESH_TOKEN_INVALIDO") {
      return res.status(401).json({
        success: false,
        message: "Sua sessão não é mais válida. Entre novamente.",
      });
    }
    next(error);
  }
}

export async function sair(req, res, next) {
  try {
    await authService.logout({ refreshToken: req.body?.refreshToken });
    return res.status(200).json({ success: true, message: "Sessão encerrada." });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res) {
  return res.status(200).json({
    success: true,
    usuario: {
      id: req.usuario.id,
      nome: req.usuario.nome,
      email: req.usuario.email,
    },
  });
}

export async function contexto(req, res) {
  return res.status(200).json({
    success: true,
    usuario: {
      id: req.usuario.id,
      nome: req.usuario.nome,
      email: req.usuario.email,
    },
    organizacao: {
      id: req.organizacao.id,
      slug: req.organizacao.slug,
      nome: req.organizacao.nome,
      configuracao: req.organizacao.configuracao,
      modulosHabilitados: req.modulosHabilitados,
    },
    empresa: {
      id: req.empresa.id,
      nomeFantasia: req.empresa.nomeFantasia,
      razaoSocial: req.empresa.razaoSocial,
      tipo: req.empresa.tipo,
    },
    cargo: req.vinculoEmpresa.cargo
      ? { id: req.vinculoEmpresa.cargo.id, nome: req.vinculoEmpresa.cargo.nome }
      : null,
    permissoes: req.permissoes,
  });
}
