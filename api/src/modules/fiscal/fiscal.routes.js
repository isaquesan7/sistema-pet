import { Router } from "express";
import {
  autenticarUsuario,
  selecionarEmpresa,
  exigirModulo,
  exigirPermissao,
} from "../../middlewares/auth.middleware.js";
import * as controller from "./fiscal.controller.js";

const router = Router();
router.use(autenticarUsuario, selecionarEmpresa, exigirModulo("FISCAL"));

router.get("/resumo", exigirPermissao("fiscal.visualizar"), controller.resumo);
router.get("/configuracao", exigirPermissao("fiscal.visualizar"), controller.configuracao);
router.put("/configuracao", exigirPermissao("fiscal.gerenciar"), controller.salvarConfiguracao);
router.get("/itens", exigirPermissao("fiscal.visualizar"), controller.itens);
router.put("/itens/:id", exigirPermissao("fiscal.gerenciar"), controller.salvarItem);
router.get("/vendas", exigirPermissao("fiscal.visualizar"), controller.vendas);
router.get("/vendas/:id/validacao", exigirPermissao("fiscal.visualizar"), controller.validarVenda);
router.get("/documentos", exigirPermissao("fiscal.visualizar"), controller.documentos);
router.get("/documentos/:id", exigirPermissao("fiscal.visualizar"), controller.documento);
router.post("/documentos", exigirPermissao("fiscal.emitir"), controller.criarDocumento);
router.post("/documentos/:id/processar", exigirPermissao("fiscal.emitir"), controller.processarDocumento);
router.post("/documentos/:id/cancelar", exigirPermissao("fiscal.cancelar"), controller.cancelarDocumento);

export default router;
