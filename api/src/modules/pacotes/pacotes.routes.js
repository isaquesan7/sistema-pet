import { Router } from "express";
import {
  autenticarUsuario,
  selecionarEmpresa,
  exigirPermissao,
} from "../../middlewares/auth.middleware.js";
import {
  listarModelos,
  criarModelo,
  atualizarModelo,
  listarClientes,
  criarCliente,
  consumir,
} from "./pacotes.controller.js";

const router = Router();
router.use(autenticarUsuario, selecionarEmpresa);

router.get("/modelos", exigirPermissao("pacotes.visualizar"), listarModelos);
router.post("/modelos", exigirPermissao("pacotes.gerenciar"), criarModelo);
router.patch("/modelos/:id", exigirPermissao("pacotes.gerenciar"), atualizarModelo);
router.get("/clientes", exigirPermissao("pacotes.visualizar"), listarClientes);
router.post("/clientes", exigirPermissao("pacotes.gerenciar"), criarCliente);
router.post("/clientes/itens/:itemId/consumir", exigirPermissao("pacotes.gerenciar"), consumir);

export default router;
