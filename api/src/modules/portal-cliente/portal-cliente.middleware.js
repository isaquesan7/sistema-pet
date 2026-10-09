import jwt from "jsonwebtoken";
import prisma from "../../config/prisma.js";
import { assinaturaBloqueada } from "../saas/saas.service.js";

function accessSecret() {
  return process.env.JWT_CLIENT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET;
}

export async function autenticarCliente(req, res, next) {
  try {
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(401).json({ success: false, message: "Token do cliente não informado." });
    }
    const [tipo, token] = authorization.split(" ");
    if (tipo !== "Bearer" || !token) {
      return res.status(401).json({ success: false, message: "Token do cliente inválido." });
    }

    let payload;
    try {
      payload = jwt.verify(token, accessSecret());
    } catch {
      return res.status(401).json({ success: false, message: "Sessão expirada." });
    }

    if (payload.tipo !== "CLIENTE") {
      return res.status(401).json({ success: false, message: "Token incompatível com o portal do cliente." });
    }

    const conta = await prisma.contaCliente.findUnique({
      where: { id: payload.sub },
      include: {
        cliente: true,
        organizacao: { include: { configuracao: true, modulos: true, assinaturaSaaS: true } },
      },
    });

    if (!conta || conta.status !== "ATIVA" || !conta.cliente.ativo || !conta.organizacao.ativo) {
      return res.status(401).json({ success: false, message: "Conta do cliente indisponível." });
    }

    const access = assinaturaBloqueada(conta.organizacao.assinaturaSaaS);
    if (access.bloqueada) {
      return res.status(403).json({
        success: false,
        code: access.motivo,
        message: "O portal está temporariamente indisponível porque a assinatura da organização precisa ser regularizada.",
      });
    }
    const portalAtivo = conta.organizacao.modulos.some(
      (item) => item.modulo === "PORTAL_CLIENTE" && item.contratado && item.habilitado
    );
    if (!portalAtivo) {
      return res.status(403).json({ success: false, code: "PORTAL_DESABILITADO", message: "O portal do cliente não está habilitado para esta organização." });
    }

    req.contaCliente = conta;
    req.cliente = conta.cliente;
    req.organizacao = conta.organizacao;
    next();
  } catch (error) {
    next(error);
  }
}
