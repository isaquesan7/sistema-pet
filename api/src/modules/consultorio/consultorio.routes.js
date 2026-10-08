import { Router } from "express";
import {
  autenticarUsuario,
  selecionarEmpresa,
  exigirModulo,
  exigirPermissao,
} from "../../middlewares/auth.middleware.js";
import * as controller from "./consultorio.controller.js";

const router = Router();

function exigirEmpresaClinica(req, res, next) {
  if (req.empresa?.tipo === "BANHO_TOSA") {
    return res.status(403).json({
      success: false,
      message: "O consultório não está disponível para o CNPJ selecionado.",
    });
  }
  next();
}

router.use(autenticarUsuario, selecionarEmpresa, exigirModulo("CONSULTORIO"), exigirEmpresaClinica);

router.get("/resumo", exigirPermissao("consultorio.acessar"), controller.resumo);
router.get("/atendimentos", exigirPermissao("consultorio.acessar"), controller.listar);
router.post("/atendimentos", exigirPermissao("consultorio.prontuario"), controller.criar);
router.get("/atendimentos/:id", exigirPermissao("consultorio.acessar"), controller.buscar);
router.patch("/atendimentos/:id", exigirPermissao("consultorio.prontuario"), controller.atualizar);
router.post("/atendimentos/:id/iniciar", exigirPermissao("consultorio.prontuario"), controller.iniciar);
router.post("/atendimentos/:id/finalizar", exigirPermissao("consultorio.prontuario"), controller.finalizar);
router.post("/atendimentos/:id/cancelar", exigirPermissao("consultorio.prontuario"), controller.cancelar);
router.post("/atendimentos/:id/prescricoes", exigirPermissao("consultorio.prescrever"), controller.prescrever);
router.post("/atendimentos/:id/vacinas", exigirPermissao("consultorio.vacinas"), controller.vacinar);
router.post("/atendimentos/:id/vermifugacoes", exigirPermissao("consultorio.vacinas"), controller.vermifugar);
router.post("/atendimentos/:id/exames", exigirPermissao("consultorio.exames"), controller.solicitarExame);
router.patch("/atendimentos/:id/exames/:exameId", exigirPermissao("consultorio.exames"), controller.atualizarExame);
router.post("/atendimentos/:id/procedimentos", exigirPermissao("consultorio.prontuario"), controller.procedimento);
router.post("/atendimentos/:id/documentos", exigirPermissao("consultorio.documentos"), controller.documento);
router.get("/pets/:petId/historico", exigirPermissao("consultorio.acessar"), controller.historicoPet);

export default router;
