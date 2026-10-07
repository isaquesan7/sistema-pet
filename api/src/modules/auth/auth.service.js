import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import prisma from "../../config/prisma.js";

function gerarAccessToken(usuario) {
  return jwt.sign(
    {
      sub: usuario.id,
      email: usuario.email,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m",
    }
  );
}

function gerarRefreshToken(usuarioId, sessaoId) {
  const dias = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30);

  return jwt.sign(
    {
      sub: usuarioId,
      sid: sessaoId,
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: `${dias}d`,
    }
  );
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function login({
  email,
  senha,
  ip,
  userAgent,
}) {
  const usuario = await prisma.usuario.findUnique({
    where: {
      email: email.trim().toLowerCase(),
    },
    include: {
      empresas: {
        where: {
          ativo: true,
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
      },
    },
  });

  if (!usuario || usuario.status !== "ATIVO") {
    throw new Error("CREDENCIAIS_INVALIDAS");
  }

  const senhaCorreta = await bcrypt.compare(
    senha,
    usuario.senhaHash
  );

  if (!senhaCorreta) {
    throw new Error("CREDENCIAIS_INVALIDAS");
  }

  const dias = Number(
    process.env.JWT_REFRESH_EXPIRES_DAYS || 30
  );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + dias);

  const sessao = await prisma.sessaoUsuario.create({
    data: {
      usuarioId: usuario.id,
      refreshTokenHash: "TEMPORARIO",
      ip,
      userAgent,
      expiresAt,
    },
  });

  const accessToken = gerarAccessToken(usuario);

  const refreshToken = gerarRefreshToken(
    usuario.id,
    sessao.id
  );

  await prisma.sessaoUsuario.update({
    where: {
      id: sessao.id,
    },
    data: {
      refreshTokenHash: hashToken(refreshToken),
    },
  });

  await prisma.usuario.update({
    where: {
      id: usuario.id,
    },
    data: {
      ultimoAcesso: new Date(),
    },
  });

  return {
    accessToken,
    refreshToken,

    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,

      empresas: usuario.empresas.map((vinculo) => ({
        id: vinculo.empresa.id,
        nomeFantasia: vinculo.empresa.nomeFantasia,
        tipo: vinculo.empresa.tipo,

        cargo: vinculo.cargo
          ? {
              id: vinculo.cargo.id,
              nome: vinculo.cargo.nome,
            }
          : null,

        permissoes:
          vinculo.cargo?.permissoes.map(
            (item) => item.permissao.codigo
          ) || [],
      })),
    },
  };
}