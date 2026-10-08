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
  adicionarPeso,
  especies,
  criarEspecie,
  atualizarEspecie,
  racas,
  criarRaca,
  atualizarRaca,
} from "./pets.controller.js";

const router = Router();
router.use(autenticarUsuario, selecionarEmpresa);

router.get("/catalogos/especies", exigirPermissao("pets.visualizar"), especies);
router.post("/catalogos/especies", exigirPermissao("cadastros.gerenciar"), criarEspecie);
router.patch("/catalogos/especies/:id", exigirPermissao("cadastros.gerenciar"), atualizarEspecie);

router.get("/catalogos/racas", exigirPermissao("pets.visualizar"), racas);
router.post("/catalogos/racas", exigirPermissao("cadastros.gerenciar"), criarRaca);
router.patch("/catalogos/racas/:id", exigirPermissao("cadastros.gerenciar"), atualizarRaca);

router.get("/", exigirPermissao("pets.visualizar"), listar);
router.post("/", exigirPermissao("pets.criar"), criar);
router.post("/:id/pesos", exigirPermissao("pets.editar"), adicionarPeso);
router.get("/:id", exigirPermissao("pets.visualizar"), buscarPorId);
router.patch("/:id", exigirPermissao("pets.editar"), atualizar);

export default router;
