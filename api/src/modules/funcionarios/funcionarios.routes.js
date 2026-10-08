import { Router } from "express";
import {
  autenticarUsuario,
  selecionarEmpresa,
  exigirPermissao,
  exigirModulo,
} from "../../middlewares/auth.middleware.js";
import {
  listarFuncoes,
  criarFuncao,
  atualizarFuncao,
  listar,
  criar,
  atualizar,
  salvarJornadas,
  statusPonto,
  baterPonto,
  registros,
  ajustarPonto,
} from "./funcionarios.controller.js";

const router = Router();
router.use(autenticarUsuario, selecionarEmpresa);

router.get("/funcoes", exigirPermissao("funcionarios.visualizar"), listarFuncoes);
router.post("/funcoes", exigirPermissao("funcionarios.gerenciar"), criarFuncao);
router.patch("/funcoes/:id", exigirPermissao("funcionarios.gerenciar"), atualizarFuncao);

router.get("/", exigirPermissao("funcionarios.visualizar"), listar);
router.post("/", exigirPermissao("funcionarios.gerenciar"), criar);
router.patch("/:id", exigirPermissao("funcionarios.gerenciar"), atualizar);
router.put("/:id/jornadas", exigirPermissao("funcionarios.gerenciar"), salvarJornadas);

router.get("/:id/ponto/status", exigirModulo("PONTO"), exigirPermissao("ponto.registrar"), statusPonto);
router.post("/:id/ponto/bater", exigirModulo("PONTO"), exigirPermissao("ponto.registrar"), baterPonto);
router.get("/:id/ponto/registros", exigirModulo("PONTO"), exigirPermissao("ponto.gerenciar"), registros);
router.post("/ponto/registros/:registroId/ajustes", exigirModulo("PONTO"), exigirPermissao("ponto.gerenciar"), ajustarPonto);

export default router;
