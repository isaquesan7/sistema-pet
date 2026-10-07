import jwt from "jsonwebtoken";

import prisma from "../config/prisma.js";

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
      payload = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET
      );
    } catch {
      return res.status(401).json({
        success: false,
        message: "Token inválido ou expirado.",
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: {
        id: payload.sub,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        status: true,
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
// EMPRESA SELECIONADA
// ======================================================

export async function selecionarEmpresa(req, res, next) {
  try {
    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message: "Usuário não autenticado.",
      });
    }

    const empresaId =
      req.headers["x-empresa-id"];

    if (!empresaId) {
      return res.status(400).json({
        success: false,
        message:
          "Empresa não informada. Utilize o cabeçalho X-Empresa-Id.",
      });
    }

    const vinculo =
      await prisma.usuarioEmpresa.findUnique({
        where: {
          usuarioId_empresaId: {
            usuarioId: req.usuario.id,
            empresaId,
          },
        },

        include: {
          empresa: true,

          cargo: {
            include: {
              permissoes: {
                include: {
                  permissao: true,
                },
              },
            },
          },
        },
      });

    if (
      !vinculo ||
      !vinculo.ativo ||
      !vinculo.empresa.ativo
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Você não possui acesso a esta empresa.",
      });
    }

    req.empresa = vinculo.empresa;
    req.vinculoEmpresa = vinculo;

    req.permissoes =
      vinculo.cargo?.permissoes.map(
        (item) => item.permissao.codigo
      ) || [];

    next();
  } catch (error) {
    next(error);
  }
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

    if (!req.empresa) {
      return res.status(400).json({
        success: false,
        message: "Empresa não selecionada.",
      });
    }

    if (!req.permissoes?.includes(codigo)) {
      return res.status(403).json({
        success: false,
        message:
          "Você não possui permissão para realizar esta operação.",
        permissaoNecessaria: codigo,
      });
    }

    next();
  };
}