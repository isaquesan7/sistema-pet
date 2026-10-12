/**
 * PointVet 17.2 - internal monitoring (read-only MVP).
 * Never trusts or exposes Railway/R2 secrets and never fabricates backup statuses.
 */
import { Router } from "express";
import prisma from "../../config/prisma.js";
import { autenticarUsuario, exigirSuperAdmin } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(autenticarUsuario, exigirSuperAdmin);

router.get("/resumo", async (_req, res) => {
  const checkedAt = new Date().toISOString();
  let database = { status: "unknown", detail: "Verificação não executada" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { status: "healthy", detail: "Consulta SELECT 1 executada" };
  } catch {
    database = { status: "error", detail: "Falha na consulta de conectividade" };
  }
  res.set("Cache-Control", "no-store");
  res.status(200).json({
    success: true,
    dados: {
      checkedAt,
      api: { status: "healthy", detail: "API respondeu ao endpoint autenticado" },
      database,
      backup: {
        status: "unverified",
        detail: "Integração com histórico de execução do worker ainda pendente. Consulte Railway, R2 e Healthchecks.io.",
        scheduledLocalTime: "03:00",
        timeZone: "America/Bahia",
        retentionDays: 90
      },
      infrastructure: { status: "unverified", detail: "Estado dos serviços Railway ainda não integrado" },
      security: { status: "unverified", detail: "Auditorias automatizadas ainda não integradas" }
    }
  });
});

export default router;
