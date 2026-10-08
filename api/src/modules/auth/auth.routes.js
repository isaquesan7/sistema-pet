import { Router } from "express";
import { login, renovar, sair, me, contexto } from "./auth.controller.js";
import {
  autenticarUsuario,
  selecionarEmpresa,
} from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/login", login);
router.post("/refresh", renovar);
router.post("/logout", sair);

router.get("/me", autenticarUsuario, me);
router.get("/contexto", autenticarUsuario, selecionarEmpresa, contexto);

export default router;
