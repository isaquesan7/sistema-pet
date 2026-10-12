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


/**
 * Persist observations only when called by a separate authenticated collector.
 * Manual dashboard refreshes never create incidents or change their state.
 */
router.post("/incident-observations", async (req, res, next) => {
  if (!tokenMatches(req.get("x-pointvet-monitor-token"), process.env.MONITOR_INGEST_TOKEN)) {
    return res.status(401).json({success:false,message:"Não autorizado"});
  }
  const {serviceKey, status, detail} = req.body || {};
  if (!["admin","portal"].includes(serviceKey) || !["healthy","error"].includes(status)) {
    return res.status(400).json({success:false,message:"Observação inválida"});
  }
  const reason=typeof detail==="string" ? detail.slice(0,200) : "Falha de conectividade";
  try {
    if(status==="error") {
      await prisma.$executeRaw`
        INSERT INTO platform_service_incidents(service_key,last_reason)
        VALUES (${serviceKey},${reason})
        ON CONFLICT (service_key) WHERE recovered_at IS NULL
        DO UPDATE SET last_failed_at=now(),failure_count=platform_service_incidents.failure_count+1,last_reason=EXCLUDED.last_reason
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE platform_service_incidents SET recovered_at=now()
        WHERE service_key=${serviceKey} AND recovered_at IS NULL
      `;
    }
    return res.status(202).json({success:true});
  } catch(err) { if(err?.meta?.code==="42P01") return res.status(503).json({success:false,message:"Migração pendente"}); return next(err); }
});

router.use(autenticarUsuario, exigirSuperAdmin);


// PointVet 17.7 — alerts are derived from persisted incidents and worker evidence.
// Acknowledgement is an operator action; it never closes an incident or verifies R2.
async function activeAlerts() {
  const incidents=await prisma.$queryRaw`
    SELECT id::text, service_key AS "serviceKey", opened_at AS "openedAt",
           failure_count AS "failureCount" FROM platform_service_incidents
    WHERE recovered_at IS NULL ORDER BY opened_at DESC LIMIT 100
  `;
  const backup=await prisma.$queryRaw`
    SELECT completed_at AS "completedAt" FROM platform_backup_evidence
    ORDER BY completed_at DESC LIMIT 1
  `;
  const alerts=incidents.map(x=>({
    key:"incident:"+x.id, category:"INFRASTRUCTURE", severity:"critical",
    title:"Incidente aberto: "+(x.serviceKey==="admin"?"Console":"Portal"),
    detail:"O coletor registrou "+x.failureCount+" falha(s) desde a abertura.",
    detectedAt:x.openedAt, source:"collector"
  }));
  if(backup.length) {
    const at=new Date(backup[0].completedAt);
    if(Date.now()-at.getTime()>26*3600000) alerts.push({
      key:"backup:stale:"+at.toISOString(),category:"BACKUP",severity:"critical",
      title:"Backup diário atrasado",
      detail:"A última evidência autenticada do upload tem mais de 26 horas. Verifique o worker e o R2.",
      detectedAt:new Date(at.getTime()+26*3600000),source:"backup-evidence"
    });
  }
  // No evidence is not evidence of failure; show as informational, not critical.
  if(!backup.length) alerts.push({
    key:"backup:no-evidence",category:"BACKUP",severity:"info",
    title:"Backup ainda sem evidência no painel",
    detail:"Nenhuma execução foi registrada pela integração. O status do R2 permanece não verificado.",
    detectedAt:null,source:"backup-evidence"
  });
  if(!alerts.length) return [];
  const keys=alerts.map(x=>x.key);
  const acknowledges=await prisma.$queryRaw`
    SELECT alert_key AS "key", acknowledged_at AS "acknowledgedAt", acknowledged_by AS "acknowledgedBy"
    FROM platform_alert_acknowledgements WHERE alert_key = ANY(${keys}::text[])
  `;
  const byKey=new Map(acknowledges.map(x=>[x.key,x]));
  return alerts.map(x=>({...x,acknowledgement:byKey.get(x.key)||null}));
}
router.get("/alertas",async(_req,res,next)=>{
  try {const alerts=await activeAlerts();res.set("Cache-Control","no-store");
    return res.json({success:true,dados:alerts,checkedAt:new Date().toISOString(),
      note:"Alertas baseados em incidentes persistidos e evidências de backup. Não inclui métricas internas do Railway."});}
  catch(error){next(error);}
});
router.post("/alertas/reconhecer",async(req,res,next)=>{
  const key=req.body?.key;
  if(typeof key!=="string"||key.length>160||!(/^(incident:[0-9a-f-]{36}|backup:(no-evidence|stale:.*))$/.test(key)))
    return res.status(400).json({success:false,message:"Chave de alerta inválida"});
  try{
    const alerts=await activeAlerts();
    if(!alerts.some(x=>x.key===key))return res.status(404).json({success:false,message:"Alerta não está ativo"});
    await prisma.$executeRaw`INSERT INTO platform_alert_acknowledgements(alert_key,acknowledged_by)
      VALUES (${key},${req.usuario.id}) ON CONFLICT (alert_key) DO NOTHING`;
    return res.json({success:true});
  }catch(error){next(error);}
});

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

router.get("/incidentes", async (_req,res,next)=>{
  try{
    const rows=await prisma.$queryRaw`
      SELECT id::text, service_key AS "serviceKey",opened_at AS "openedAt",
      recovered_at AS "recoveredAt",last_failed_at AS "lastFailedAt",
      failure_count AS "failureCount",last_reason AS "lastReason"
      FROM platform_service_incidents ORDER BY opened_at DESC LIMIT 100
    `;
    res.set("Cache-Control","no-store");
    return res.json({success:true,dados:rows,collectionConfigured:Boolean(process.env.MONITOR_INGEST_TOKEN)});
  }catch(err){return next(err)}
});

router.get("/infraestrutura", async (_req, res) => {
  const probes = await Promise.all(publicChecks.map(probe));
  res.set("Cache-Control", "no-store");
  return res.json({ success: true, dados: { checkedAt: new Date().toISOString(), checks: probes,
    note: "Testes HTTP sob demanda. Não representam o status interno nem as métricas do Railway." } });
});


// Security checks verify limited, observable controls, not full penetration testing.
// Never return secret values or diagnostic responses from protected routes.
async function verifySecurityControls() {
  const checks = [
    { id: "jwt-config", label: "Assinatura de sessões", status:
      (process.env.JWT_ACCESS_SECRET || "").length >= 32 ? "healthy" : "error",
      detail: "Presença de chave de assinatura com comprimento mínimo (valor não exposto)" },
    { id: "worker-ingest", label: "Credencial de backups", status:
      (process.env.BACKUP_EVIDENCE_INGEST_TOKEN || "").length >= 32 ? "healthy" : "error",
      detail: "Segredo privado configurado com comprimento mínimo (valor não exposto)" },
    { id: "incident-ingest", label: "Credencial de incidentes", status:
      (process.env.MONITOR_INGEST_TOKEN || "").length >= 32 ? "healthy" : "error",
      detail: "Segredo privado configurado com comprimento mínimo (valor não exposto)" }
  ];
  try {
    const response = await fetch("https://petrise-api-production.up.railway.app/api/plataforma/monitoramento/incidentes", {
      signal: AbortSignal.timeout(5000), redirect: "error", cache: "no-store"
    });
    checks.push({ id:"admin-boundary", label:"Bloqueio de acesso anônimo", status:response.status===401?"healthy":"error",
      detail: response.status===401 ? "Rota administrativa recusou acesso sem autenticação" : "Resposta inesperada no controle de acesso" });
  } catch {
    checks.push({ id:"admin-boundary", label:"Bloqueio de acesso anônimo", status:"unknown",
      detail:"Não foi possível verificar a proteção da rota remotamente" });
  }
  const failed = checks.some(x=>x.status==="error");
  return { status:failed?"error":checks.every(x=>x.status==="healthy")?"healthy":"unverified",
    detail:failed?"Falha em um dos controles básicos; conferir detalhes.":checks.every(x=>x.status==="healthy")
      ?"Quatro controles básicos verificados; não representa auditoria completa de segurança."
      :"Algum controle não pôde ser verificado.", checks };
}
router.get("/seguranca", async (_req,res) => {
  const security=await verifySecurityControls();
  res.set("Cache-Control","no-store");
  return res.json({success:true,dados:{checkedAt:new Date().toISOString(), ...security}});
});

// Summary derives states from observed evidence, never from configured schedules alone.
router.get("/resumo", async (_req, res, next) => {
  const checkedAt = new Date().toISOString();
  let database = { status: "unknown", detail: "Verificação não executada" };
  let backup = {
    status: "unverified",
    detail: "Nenhuma evidência recebida do worker atualizado.",
    scheduledLocalTime: "03:00", timeZone: "America/Bahia", retentionDays: 90
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { status: "healthy", detail: "Consulta SELECT 1 executada" };
    const rows = await prisma.$queryRaw`
      SELECT completed_at AS "completedAt" FROM platform_backup_evidence
      ORDER BY completed_at DESC LIMIT 1
    `;
    if (rows.length) {
      const at = new Date(rows[0].completedAt);
      const hours = (Date.now() - at.getTime()) / 3600000;
      const fresh = hours >= 0 && hours <= 26;
      backup = { ...backup, status: fresh ? "healthy" : "error",
        detail: fresh
          ? "Upload criptografado reportado pelo worker; restauração não testada nesta verificação."
          : "Última evidência tem mais de 26 horas; verifique Railway, R2 e Healthchecks.",
        completedAt: at.toISOString() };
    }
  } catch (error) {
    if (database.status !== "healthy") database = { status: "error", detail: "Falha de conectividade com PostgreSQL" };
    else if (error?.meta?.code !== "42P01") return next(error);
  }
  const [checks, security] = await Promise.all([Promise.all(publicChecks.map(probe)),verifySecurityControls()]);
  const infraHealthy = checks.every(x => x.status === "healthy");
  res.set("Cache-Control", "no-store");
  res.status(200).json({ success: true, dados: {
    checkedAt,
    api: { status: "healthy", detail: "API respondeu ao endpoint autenticado" },
    database, backup,
    infrastructure: {
      status: infraHealthy ? "healthy" : "error",
      detail: infraHealthy
        ? "Console e Portal responderam por HTTPS; não inclui estado interno do Railway."
        : "Falha na conectividade HTTPS de pelo menos um serviço; veja detalhes abaixo.",
      checks
    },
    security
  }});
});

export default router;
