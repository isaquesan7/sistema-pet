import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../../config/prisma.js";

function gerarAccessToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, email: usuario.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m" }
  );
}

function gerarRefreshToken(usuarioId, sessaoId, lembrarConectado) {
  const payload = { sub: usuarioId, sid: sessaoId };
  const options = lembrarConectado
    ? {}
    : { expiresIn: `${Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30)}d` };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, options);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function calcularExpiracao(lembrarConectado) {
  if (lembrarConectado) return null;
  const dias = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + dias);
  return expiresAt;
}

async function buscarUsuarioCompleto(usuarioId) {
  return prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: {
      organizacoes: {
        where: { ativo: true },
        include: {
          organizacao: {
            include: { configuracao: true, modulos: true },
          },
        },
      },
      empresas: {
        where: { ativo: true },
        include: {
          empresa: true,
          cargo: {
            include: { permissoes: { include: { permissao: true } } },
          },
        },
      },
    },
  });
}

function montarUsuarioResposta(usuario) {
  const empresas = usuario.empresas.map((vinculo) => ({
    id: vinculo.empresa.id,
    organizacaoId: vinculo.empresa.organizacaoId,
    nomeFantasia: vinculo.empresa.nomeFantasia,
    tipo: vinculo.empresa.tipo,
    cargo: vinculo.cargo
      ? { id: vinculo.cargo.id, nome: vinculo.cargo.nome }
      : null,
    permissoes:
      vinculo.cargo?.permissoes.map((item) => item.permissao.codigo) || [],
  }));

  const organizacoes = usuario.organizacoes.map((vinculo) => ({
    id: vinculo.organizacao.id,
    slug: vinculo.organizacao.slug,
    nome: vinculo.organizacao.nome,
    papel: vinculo.papel,
    configuracao: vinculo.organizacao.configuracao,
    modulos: vinculo.organizacao.modulos
      .filter((item) => item.habilitado)
      .map((item) => item.modulo),
    empresas: empresas.filter(
      (empresa) => empresa.organizacaoId === vinculo.organizacao.id
    ),
  }));

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    organizacoes,
    empresas,
  };
}

export async function login({ email, senha, ip, userAgent, manterConectado = false }) {
  const usuario = await prisma.usuario.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: {
      organizacoes: {
        where: { ativo: true },
        include: {
          organizacao: { include: { configuracao: true, modulos: true } },
        },
      },
      empresas: {
        where: { ativo: true },
        include: {
          empresa: true,
          cargo: {
            include: { permissoes: { include: { permissao: true } } },
          },
        },
      },
    },
  });

  if (!usuario || usuario.status !== "ATIVO") throw new Error("CREDENCIAIS_INVALIDAS");

  const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaCorreta) throw new Error("CREDENCIAIS_INVALIDAS");

  const sessao = await prisma.sessaoUsuario.create({
    data: {
      usuarioId: usuario.id,
      refreshTokenHash: "TEMPORARIO",
      ip,
      userAgent,
      lembrarConectado: Boolean(manterConectado),
      expiresAt: calcularExpiracao(Boolean(manterConectado)),
    },
  });

  const accessToken = gerarAccessToken(usuario);
  const refreshToken = gerarRefreshToken(
    usuario.id,
    sessao.id,
    Boolean(manterConectado)
  );

  await prisma.$transaction([
    prisma.sessaoUsuario.update({
      where: { id: sessao.id },
      data: { refreshTokenHash: hashToken(refreshToken) },
    }),
    prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcesso: new Date() },
    }),
  ]);

  return {
    accessToken,
    refreshToken,
    manterConectado: Boolean(manterConectado),
    usuario: montarUsuarioResposta(usuario),
  };
}

export async function refresh({ refreshToken, ip, userAgent }) {
  if (!refreshToken) throw new Error("REFRESH_TOKEN_INVALIDO");

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new Error("REFRESH_TOKEN_INVALIDO");
  }

  const sessao = await prisma.sessaoUsuario.findUnique({
    where: { id: payload.sid },
  });

  if (
    !sessao ||
    sessao.usuarioId !== payload.sub ||
    sessao.revokedAt ||
    (sessao.expiresAt && sessao.expiresAt.getTime() <= Date.now()) ||
    sessao.refreshTokenHash !== hashToken(refreshToken)
  ) {
    throw new Error("REFRESH_TOKEN_INVALIDO");
  }

  const usuario = await buscarUsuarioCompleto(sessao.usuarioId);
  if (!usuario || usuario.status !== "ATIVO") {
    throw new Error("REFRESH_TOKEN_INVALIDO");
  }

  const novoAccessToken = gerarAccessToken(usuario);
  const novoRefreshToken = gerarRefreshToken(
    usuario.id,
    sessao.id,
    sessao.lembrarConectado
  );

  await prisma.sessaoUsuario.update({
    where: { id: sessao.id },
    data: {
      refreshTokenHash: hashToken(novoRefreshToken),
      ip: ip || sessao.ip,
      userAgent: userAgent || sessao.userAgent,
    },
  });

  return {
    accessToken: novoAccessToken,
    refreshToken: novoRefreshToken,
    manterConectado: sessao.lembrarConectado,
    usuario: montarUsuarioResposta(usuario),
  };
}

export async function logout({ refreshToken }) {
  if (!refreshToken) return;

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, {
      ignoreExpiration: true,
    });

    const sessao = await prisma.sessaoUsuario.findUnique({
      where: { id: payload.sid },
    });

    if (sessao && sessao.usuarioId === payload.sub && !sessao.revokedAt) {
      await prisma.sessaoUsuario.update({
        where: { id: sessao.id },
        data: { revokedAt: new Date() },
      });
    }
  } catch {
    // Logout é idempotente: mesmo um token inválido/antigo é limpo no cliente.
  }
}
