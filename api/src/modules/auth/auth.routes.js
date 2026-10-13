import { Router } from "express";
import { login, renovar, sair, me, contexto } from "./auth.controller.js";
import {
  autenticarUsuario,
  selecionarEmpresa,
} from "../../middlewares/auth.middleware.js";

import {getMyProfile,editMyProfile,changeMyPassword} from "./profile.controller.js";

const router = Router();

router.post("/login", login);
router.post("/refresh", renovar);
router.post("/logout", sair);

router.get("/me", autenticarUsuario, me);
router.get("/me/perfil",autenticarUsuario,getMyProfile);
router.patch("/me/perfil",autenticarUsuario,editMyProfile);
router.post("/me/senha",autenticarUsuario,changeMyPassword);
router.get("/contexto", autenticarUsuario, selecionarEmpresa, contexto);

export default router;
