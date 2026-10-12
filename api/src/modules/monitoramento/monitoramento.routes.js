/**
 * PointVet 17.2 - internal monitoring (read-only MVP).
 * Never trusts or exposes Railway/R2 secrets and never fabricates backup statuses.
 */
import { Router } from "express";
import { timingSafeEqual } from "node:crypto";

import prisma from "../../config/prisma.js";
import { autenticarUsuario, exigirSuperAdmin } from "../../middlewares/auth.middleware.js";

const router = Router();

function tokenMatches(input, expected) {
  if (typeof input !== "string" || !expected) return false;
  const a = Buffer.from(input); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Ingest endpoint authenticates independently from browser accounts.
// Its credential is never returned by administrative read routes.
router.post("/backup-evidence", async (req, res, next) => {
  if (!tokenMatches(req.get("x-pointvet-backup-token"), process.env.BACKUP_EVIDENCE_INGEST_TOKEN)) {
    return res.status(401).json({ success: false, message: "Não autorizado" });
  }
  const { objectKey, completedAt, sizeBytes } = req.body || {};
  // A valid worker token authorizes a report, not independent proof that R2 is reachable.
  if (typeof objectKey !== "string" || !/^postgres\/daily\/pointvet-[a-zA-Z0-9-]+\.dump\.age$/.test(objectKey) || objectKey.length > 240) {
    return res.status(400).json({ success: false, message: "Objeto inválido" });
  }
  const when = new Date(completedAt);
  if (!Number.isFinite(when.valueOf()) || when.valueOf() > Date.now()+60000 || when.valueOf() < Date.now()-86400000) {
    return res.status(400).json({ success: false, message: "Horário inválido" });
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 32) return res.status(400).json({ success: false, message: "Tamanho inválido" });
  try {
    await prisma.$executeRaw`
      INSERT INTO platform_backup_evidence (object_key, completed_at, size_bytes)
      VALUES (${objectKey}, ${when}, ${BigInt(sizeBytes)})
      ON CONFLICT (object_key) DO NOTHING
    `;
    return res.status(202).json({ success: true });
  } catch (err) { return next(err); }
});

router.use(autenticarUsuario, exigirSuperAdmin);

router.get("/backups", async (_req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT id::text, object_key AS "objectKey", completed_at AS "completedAt",
             size_bytes::text AS "sizeBytes", status, source
      FROM platform_backup_evidence
      ORDER BY completed_at DESC LIMIT 90
    `;
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, dados: rows, integrationReady: true });
  } catch (error) {
    if (error?.meta?.code === "42P01") {
      return res.json({ success: true, dados: [], integrationReady: false });
    }
    return next(error);
  }
});


// Public HTTPS health probes for fixed PointVet services; no user-supplied URLs.
// These checks indicate HTTP reachability only, not Railway deployment state.
const publicChecks = [
  { id: "admin", label: "Console administrativo", url: "https://petrise-admin-production.up.railway.app/health" },
  { id: "portal", label: "Portal do cliente", url: "https://petrise-portal-production.up.railway.app/health" },
];
async function probe(entry) {
  const started = Date.now();
  try {
    const response = await fetch(entry.url, { method: "GET", signal: AbortSignal.timeout(5000), redirect: "error", cache: "no-store" });
    return {
      id: entry.id, label: entry.label, checkedAt: new Date().toISOString(),
      status: response.ok ? "healthy" : "error",
      httpStatus: response.status, latencyMs: Date.now() - started,
      detail: response.ok ? "Endpoint HTTP respondeu" : "Resposta HTTP não saudável"
    };
  } catch {
    return { id: entry.id, label: entry.label, checkedAt: new Date().toISOString(),
      status: "error", httpStatus: null, latencyMs: Date.now() - started,
      detail: "Falha ou tempo limite no teste de conectividade" };
  }
}

router.get("/infraestrutura", async (_req, res) => {
  const probes = await Promise.all(publicChecks.map(probe));
  res.set("Cache-Control", "no-store");
  return res.json({ success: true, dados: { checkedAt: new Date().toISOString(), checks: probes,
    note: "Testes HTTP sob demanda. Não representam o status interno nem as métricas do Railway." } });
});

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
        detail: "O histórico registra declarações autenticadas do worker após o upload; não substitui verificação independente do R2.",
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
