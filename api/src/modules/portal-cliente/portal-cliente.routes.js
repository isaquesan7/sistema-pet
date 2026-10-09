import { Router } from "express";
import * as controller from "./portal-cliente.controller.js";
import { autenticarCliente } from "./portal-cliente.middleware.js";

const router = Router();

router.get("/public/:slug", controller.publicConfig);
router.post("/auth/cadastro", controller.cadastrar);
router.post("/auth/login", controller.login);
router.post("/auth/refresh", controller.refresh);
router.post("/auth/logout", controller.logout);

router.use(autenticarCliente);
router.get("/me", controller.me);
router.patch("/me", controller.atualizarPerfil);
router.get("/catalogos", controller.catalogos);
router.get("/pets", controller.pets);
router.post("/pets", controller.criarPet);
router.patch("/pets/:id", controller.atualizarPet);
router.get("/pets/:id/saude", controller.saudePet);
router.get("/servicos", controller.servicos);
router.get("/agenda/disponibilidade", controller.disponibilidade);
router.get("/agendamentos", controller.agendamentos);
router.post("/agendamentos/consultorio", controller.agendarConsultorio);
router.post("/agendamentos/banho-tosa", controller.agendarBanho);
router.post("/agendamentos/:tipo/:id/cancelar", controller.cancelar);
router.post("/pagamentos/:id/simular-aprovacao", controller.simularPagamento);

export default router;
