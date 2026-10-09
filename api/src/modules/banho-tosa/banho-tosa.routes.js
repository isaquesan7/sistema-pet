import { Router } from "express";
import {
  autenticarUsuario,
  selecionarEmpresa,
  exigirModulo,
  exigirPermissao,
} from "../../middlewares/auth.middleware.js";
import * as controller from "./banho-tosa.controller.js";

const router = Router();

function exigirEmpresaBanhoTosa(req, res, next) {
  if (req.empresa?.tipo === "LOJA_CONSULTORIO") {
    return res.status(403).json({ success: false, message: "O Banho e Tosa não está disponível para o CNPJ selecionado." });
  }
  next();
}

router.use(autenticarUsuario, selecionarEmpresa, exigirModulo("BANHO_TOSA"), exigirEmpresaBanhoTosa);

router.get("/resumo", exigirPermissao("banho_tosa.acessar"), controller.resumo);
router.get("/profissionais", exigirPermissao("banho_tosa.acessar"), controller.profissionais);
router.get("/agenda", exigirPermissao("agenda.visualizar"), controller.agenda);
router.post("/agenda", exigirPermissao("agenda.gerenciar"), controller.criarAgendamento);
router.patch("/agenda/:id", exigirPermissao("agenda.gerenciar"), controller.atualizarAgendamento);
router.post("/agenda/:id/checkin", exigirPermissao("banho_tosa.gerenciar"), controller.checkin);

router.get("/ordens", exigirPermissao("banho_tosa.acessar"), controller.ordens);
router.post("/ordens", exigirPermissao("banho_tosa.gerenciar"), controller.criarOrdem);
router.get("/ordens/:id", exigirPermissao("banho_tosa.acessar"), controller.buscarOrdem);
router.patch("/ordens/:id/status", exigirPermissao("banho_tosa.gerenciar"), controller.statusOrdem);
router.post("/ordens/:id/anexos", exigirPermissao("banho_tosa.gerenciar"), controller.adicionarAnexo);
router.delete("/ordens/:id/anexos/:anexoId", exigirPermissao("banho_tosa.gerenciar"), controller.removerAnexo);

router.get("/creditos", exigirPermissao("banho_tosa.acessar"), controller.creditos);
router.get("/pets/:petId/ficha", exigirPermissao("banho_tosa.acessar"), controller.buscarFicha);
router.put("/pets/:petId/ficha", exigirPermissao("banho_tosa.gerenciar"), controller.salvarFicha);

export default router;
