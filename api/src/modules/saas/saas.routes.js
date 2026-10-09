import { Router } from "express";
import rateLimit from "express-rate-limit";
import { autenticarUsuario, selecionarEmpresaParaAssinatura, exigirGestorOrganizacao, exigirSuperAdmin } from "../../middlewares/auth.middleware.js";
import * as controller from "./saas.controller.js";

const router = Router();
const onboardingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Muitas tentativas de cadastro. Aguarde antes de tentar novamente." },
});

// Public commercial surface.
router.get("/publico/planos", controller.planosPublicos);
router.post("/onboarding", onboardingLimiter, controller.onboarding);

// PetRise platform console. Does not require a tenant/company selection.
router.get("/plataforma/painel", autenticarUsuario, exigirSuperAdmin, controller.painelPlataforma);
router.get("/plataforma/organizacoes", autenticarUsuario, exigirSuperAdmin, controller.organizacoesPlataforma);
router.get("/plataforma/planos", autenticarUsuario, exigirSuperAdmin, controller.planosPlataforma);
router.post("/plataforma/planos", autenticarUsuario, exigirSuperAdmin, controller.criarPlano);
router.patch("/plataforma/planos/:id", autenticarUsuario, exigirSuperAdmin, controller.atualizarPlano);
router.patch("/plataforma/organizacoes/:organizacaoId/assinatura", autenticarUsuario, exigirSuperAdmin, controller.atualizarAssinatura);
router.get("/plataforma/faturas", autenticarUsuario, exigirSuperAdmin, controller.faturasPlataforma);
router.post("/plataforma/faturas", autenticarUsuario, exigirSuperAdmin, controller.criarFaturaManual);
router.post("/plataforma/faturas/:id/pagar", autenticarUsuario, exigirSuperAdmin, controller.liquidarFatura);
router.post("/plataforma/faturas/:id/cancelar", autenticarUsuario, exigirSuperAdmin, controller.cancelarFatura);

// Tenant subscription/billing area.
router.get("/assinatura", autenticarUsuario, selecionarEmpresaParaAssinatura, exigirGestorOrganizacao, controller.minhaAssinatura);
router.post("/assinatura/faturas", autenticarUsuario, selecionarEmpresaParaAssinatura, exigirGestorOrganizacao, controller.gerarFatura);
router.post("/assinatura/faturas/:id/simular-pagamento", autenticarUsuario, selecionarEmpresaParaAssinatura, exigirGestorOrganizacao, controller.simularPagamento);

export default router;
