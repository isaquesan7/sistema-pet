import { Router } from "express";
import { autenticarUsuario, selecionarEmpresa, exigirModulo, exigirPermissao } from "../../middlewares/auth.middleware.js";
import * as controller from "./relatorios.controller.js";

const router = Router();

router.use(autenticarUsuario, selecionarEmpresa, exigirModulo("RELATORIOS"));
router.get("/painel", exigirPermissao("relatorios.visualizar"), controller.painel);
router.get("/exportar", exigirPermissao("relatorios.visualizar"), controller.exportar);

export default router;
