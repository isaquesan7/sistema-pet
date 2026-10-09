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
  listarAjustesPonto,
  analisarAjustePonto,
  fechamentoMensal,
  fecharPontoFuncionario,
  fecharCompetencia,
  reabrirFechamento,
  exportarFechamento,
} from "./funcionarios.controller.js";

const router = Router();
router.use(autenticarUsuario, selecionarEmpresa);

router.get("/funcoes", exigirPermissao("funcionarios.visualizar"), listarFuncoes);
router.post("/funcoes", exigirPermissao("funcionarios.gerenciar"), criarFuncao);
router.patch("/funcoes/:id", exigirPermissao("funcionarios.gerenciar"), atualizarFuncao);

// Ponto — gestão mensal e aprovação ficam antes das rotas parametrizadas de funcionário.
router.get("/ponto/ajustes", exigirModulo("PONTO"), exigirPermissao("ponto.aprovar_ajustes"), listarAjustesPonto);
router.post("/ponto/ajustes/:ajusteId/analisar", exigirModulo("PONTO"), exigirPermissao("ponto.aprovar_ajustes"), analisarAjustePonto);
router.get("/ponto/fechamento", exigirModulo("PONTO"), exigirPermissao("ponto.fechamento"), fechamentoMensal);
router.get("/ponto/fechamento/exportar", exigirModulo("PONTO"), exigirPermissao("ponto.fechamento"), exportarFechamento);
router.post("/ponto/fechamento/fechar", exigirModulo("PONTO"), exigirPermissao("ponto.fechamento"), fecharCompetencia);
router.post("/ponto/fechamento/:fechamentoId/reabrir", exigirModulo("PONTO"), exigirPermissao("ponto.fechamento"), reabrirFechamento);

router.get("/", exigirPermissao("funcionarios.visualizar"), listar);
router.post("/", exigirPermissao("funcionarios.gerenciar"), criar);
router.patch("/:id", exigirPermissao("funcionarios.gerenciar"), atualizar);
router.put("/:id/jornadas", exigirPermissao("funcionarios.gerenciar"), salvarJornadas);

router.get("/:id/ponto/status", exigirModulo("PONTO"), exigirPermissao("ponto.registrar"), statusPonto);
router.post("/:id/ponto/bater", exigirModulo("PONTO"), exigirPermissao("ponto.registrar"), baterPonto);
router.get("/:id/ponto/registros", exigirModulo("PONTO"), exigirPermissao("ponto.gerenciar"), registros);
router.post("/:id/ponto/fechar", exigirModulo("PONTO"), exigirPermissao("ponto.fechamento"), fecharPontoFuncionario);
router.post("/ponto/registros/:registroId/ajustes", exigirModulo("PONTO"), exigirPermissao("ponto.gerenciar"), ajustarPonto);

export default router;
