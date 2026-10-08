import { Router } from "express";
import {
  autenticarUsuario,
  selecionarEmpresa,
  exigirPermissao,
} from "../../middlewares/auth.middleware.js";
import {
  atual,
  atualizarConfiguracao,
  listarModulos,
  atualizarModulo,
} from "./organizacoes.controller.js";

const router = Router();
router.use(autenticarUsuario, selecionarEmpresa);

router.get("/atual", atual);
router.patch("/configuracao", exigirPermissao("organizacao.gerenciar"), atualizarConfiguracao);
router.get("/modulos", listarModulos);
router.patch("/modulos/:modulo", exigirPermissao("organizacao.gerenciar"), atualizarModulo);

export default router;
