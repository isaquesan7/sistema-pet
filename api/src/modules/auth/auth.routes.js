import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, renovar, sair, me, contexto } from "./auth.controller.js";
import {
  autenticarUsuario,
  selecionarEmpresa,
} from "../../middlewares/auth.middleware.js";

import {getMyProfile,editMyProfile,changeMyPassword} from "./profile.controller.js";

const router = Router();
const accountMutationLimiter=rateLimit({
 windowMs:15*60*1000,limit:10,standardHeaders:true,legacyHeaders:false,
 message:{success:false,message:"Muitas tentativas. Aguarde antes de continuar."}
});

router.post("/login", login);
router.post("/refresh", renovar);
router.post("/logout", sair);

router.get("/me", autenticarUsuario, me);
router.get("/me/perfil",autenticarUsuario,getMyProfile);
router.patch("/me/perfil",autenticarUsuario,accountMutationLimiter,editMyProfile);
router.post("/me/senha",autenticarUsuario,accountMutationLimiter,changeMyPassword);
router.get("/contexto", autenticarUsuario, selecionarEmpresa, contexto);

export default router;
