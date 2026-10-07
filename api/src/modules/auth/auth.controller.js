import * as authService from "./auth.service.js";

export async function login(req, res, next) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        success: false,
        message: "E-mail e senha são obrigatórios.",
      });
    }

    const resultado = await authService.login({
      email,
      senha,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(200).json({
      success: true,
      ...resultado,
    });
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