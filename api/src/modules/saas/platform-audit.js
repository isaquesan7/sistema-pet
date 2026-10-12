/**
 * Platform-only administrative audit.
 * Records only structured action identifiers after the response is finished.
 * Never persists request bodies, passwords, tokens, cookies or arbitrary URLs.
 */
import prisma from "../../config/prisma.js";
const actions = new Map([
 ["POST /plataforma/planos",["PLAN_CREATED","PLAN"]],
 ["PATCH /plataforma/planos/:id",["PLAN_UPDATED","PLAN"]],
 ["PATCH /plataforma/organizacoes/:organizacaoId/assinatura",["SUBSCRIPTION_UPDATED","ORGANIZATION"]],
 ["POST /plataforma/faturas",["INVOICE_CREATED","INVOICE"]],
 ["POST /plataforma/faturas/:id/pagar",["INVOICE_PAID","INVOICE"]],
 ["POST /plataforma/faturas/:id/cancelar",["INVOICE_CANCELLED","INVOICE"]]
]);
export function auditPlatformMutation(req,res,next){
 const descriptor=actions.get(req.method+" "+(req.route?.path || ""));
 if(!descriptor) return next();
 const actor=req.usuario?.id;
 if(!actor) return next();
 const [action,resourceType]=descriptor;
 const resourceId=String(req.params?.organizacaoId || req.params?.id || "").slice(0,100) || null;
 res.once("finish",()=>{
   const result=res.statusCode>=200 && res.statusCode<300?"SUCCESS":"FAILED";
   prisma.$executeRaw`
     INSERT INTO platform_admin_audit(actor_id,action,resource_type,resource_id,http_method,http_status,result,ip)
     VALUES (${actor},${action},${resourceType},${resourceId},${req.method},${res.statusCode},${result},${String(req.ip||"").slice(0,64)})
   `.catch(error=>console.error("Falha de auditoria administrativa", {code:error.code}));
 });
 next();
}
export async function auditPlatformList(req,res,next){
 try {
  const limit=Math.min(100,Math.max(1,Number.parseInt(req.query.limit,10)||50));
  const action=typeof req.query.action==="string"&&/^[A-Z_]{3,50}$/.test(req.query.action)?req.query.action:null;
  const rows=await prisma.$queryRaw`
    SELECT a.id::text, a.actor_id AS "actorId",u.nome AS "actorName",
      a.action,a.resource_type AS "resourceType",a.resource_id AS "resourceId",
      a.http_status AS "httpStatus",a.result,a.created_at AS "createdAt"
    FROM platform_admin_audit a LEFT JOIN usuarios u ON u.id=a.actor_id
    WHERE (${action}::text IS NULL OR a.action=${action})
    ORDER BY a.created_at DESC LIMIT ${limit}
  `;
  res.set("Cache-Control","no-store");
  return res.json({success:true,dados:rows});
 } catch(error){return next(error)}
}
