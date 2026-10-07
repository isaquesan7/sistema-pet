import { Router } from "express";

import {
  autenticarUsuario,
  selecionarEmpresa,
  exigirPermissao,
} from "../../middlewares/auth.middleware.js";

import {
  criar,
  listar,
  buscarPorId,
  atualizar,
} from "./clientes.controller.js";

const router = Router();

router.use(
  autenticarUsuario,
  selecionarEmpresa
);

router.get(
  "/",
  exigirPermissao("clientes.visualizar"),
  listar
);

router.get(
  "/:id",
  exigirPermissao("clientes.visualizar"),
  buscarPorId
);

router.post(
  "/",
  exigirPermissao("clientes.criar"),
  criar
);

router.patch(
  "/:id",
  exigirPermissao("clientes.editar"),
  atualizar
);

export default router;