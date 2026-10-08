import { Router } from "express";
import {
  autenticarUsuario,
  selecionarEmpresa,
  exigirModulo,
  exigirPermissao,
} from "../../middlewares/auth.middleware.js";
import * as controller from "./pdv.controller.js";

const router = Router();
router.use(autenticarUsuario, selecionarEmpresa, exigirModulo("PDV"));

router.get("/resumo", exigirPermissao("pdv.acessar"), controller.resumo);
router.get("/itens", exigirPermissao("pdv.acessar"), controller.listarItens);

router.get("/caixas", exigirPermissao("pdv.acessar"), controller.listarCaixas);
router.post("/caixas", exigirPermissao("financeiro.gerenciar"), controller.criarCaixa);
router.get("/caixa/aberta", exigirPermissao("pdv.acessar"), controller.sessaoAberta);
router.post("/caixas/:id/abrir", exigirPermissao("pdv.acessar"), controller.abrirCaixa);
router.post("/sessoes/:id/movimentacoes", exigirPermissao("pdv.acessar"), controller.movimentarCaixa);
router.post("/sessoes/:id/fechar", exigirPermissao("pdv.acessar"), controller.fecharCaixa);

router.get("/pacotes-pendentes", exigirPermissao("pdv.acessar"), controller.listarPacotesPendentes);
router.post("/pacotes/:id/receber", exigirPermissao("pdv.acessar"), controller.receberPacote);

router.get("/vendas", exigirPermissao("pdv.acessar"), controller.listarVendas);
router.get("/vendas/:id", exigirPermissao("pdv.acessar"), controller.buscarVenda);
router.post("/vendas", exigirPermissao("pdv.acessar"), controller.criarVenda);
router.post("/vendas/:id/cancelar", exigirPermissao("pdv.cancelar_venda"), controller.cancelarVenda);

router.get("/comandas", exigirPermissao("pdv.acessar"), controller.listarComandas);
router.post("/comandas", exigirPermissao("pdv.acessar"), controller.criarComanda);
router.get("/comandas/:id", exigirPermissao("pdv.acessar"), controller.buscarComanda);
router.post("/comandas/:id/itens", exigirPermissao("pdv.acessar"), controller.adicionarItemComanda);
router.delete("/comandas/:id/itens/:itemId", exigirPermissao("pdv.acessar"), controller.cancelarItemComanda);
router.post("/comandas/:id/fechar", exigirPermissao("pdv.acessar"), controller.fecharComanda);

export default router;
