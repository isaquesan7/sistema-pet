import { Router } from "express";
import {
  autenticarUsuario,
  selecionarEmpresa,
  exigirPermissao,
} from "../../middlewares/auth.middleware.js";
import {
  calcular,
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  listarItens,
  buscarItem,
  criarItem,
  atualizarItem,
} from "./catalogo.controller.js";

const router = Router();
router.use(autenticarUsuario, selecionarEmpresa);

router.post("/calcular-preco", exigirPermissao("catalogo.visualizar"), calcular);
router.get("/categorias", exigirPermissao("catalogo.visualizar"), listarCategorias);
router.post("/categorias", exigirPermissao("catalogo.gerenciar"), criarCategoria);
router.patch("/categorias/:id", exigirPermissao("catalogo.gerenciar"), atualizarCategoria);

router.get("/itens", exigirPermissao("catalogo.visualizar"), listarItens);
router.get("/itens/:id", exigirPermissao("catalogo.visualizar"), buscarItem);
router.post("/itens", exigirPermissao("catalogo.gerenciar"), criarItem);
router.patch("/itens/:id", exigirPermissao("catalogo.gerenciar"), atualizarItem);

export default router;
