import { Router } from "express";

import {
  login,
  me,
  contexto,
} from "./auth.controller.js";

import {
  autenticarUsuario,
  selecionarEmpresa,
} from "../../middlewares/auth.middleware.js";

const router = Router();

// Pública
router.post("/login", login);

// Protegida apenas por autenticação
router.get(
  "/me",
  autenticarUsuario,
  me
);

// Protegida por autenticação + empresa
router.get(
  "/contexto",
  autenticarUsuario,
  selecionarEmpresa,
  contexto
);

export default router;