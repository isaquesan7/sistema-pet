import { Router } from "express";
import { autenticarUsuario, exigirPermissao, selecionarEmpresa } from "../../middlewares/auth.middleware.js";
import * as controller from "./seguranca.controller.js";

const router = Router();
router.use(autenticarUsuario, selecionarEmpresa);

router.get("/auditoria", exigirPermissao("seguranca.auditoria"), controller.auditoria);
router.get("/arquivos", exigirPermissao("arquivos.gerenciar"), controller.listarArquivos);
router.post("/arquivos/upload", exigirPermissao("arquivos.gerenciar"), controller.upload);
router.get("/arquivos/:id/url", exigirPermissao("arquivos.gerenciar"), controller.obterUrl);
router.delete("/arquivos/:id", exigirPermissao("arquivos.gerenciar"), controller.excluir);
router.get("/lgpd/solicitacoes", exigirPermissao("lgpd.gerenciar"), controller.solicitacoesLGPD);
router.post("/lgpd/clientes/:clienteId/exportar", exigirPermissao("lgpd.gerenciar"), controller.exportarLGPD);
router.post("/lgpd/clientes/:clienteId/anonimizar", exigirPermissao("lgpd.gerenciar"), controller.anonimizarLGPD);

export default router;
