/**
 * PointVet 17.10 — Resend email dispatcher.
 * Disabled until explicitly provisioned with RESEND_API_KEY, ALERT_EMAIL_FROM,
 * ALERT_EMAIL_TO and ALERT_DELIVERY_TOKEN. Never logs secret values.
 */
import prisma from "../../config/prisma.js";
import { timingSafeEqual } from "node:crypto";
function equalToken(candidate, expected){
 if(typeof candidate!=="string"||!expected)return false;
 const a=Buffer.from(candidate),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export function authenticateAlertDispatcher(req,res,next){
 if(!equalToken(req.get("x-pointvet-alert-token"),process.env.ALERT_DELIVERY_TOKEN))
   return res.status(401).json({success:false,message:"Não autorizado"});
 next();
}
export function configured(){
 const names=["RESEND_API_KEY","ALERT_EMAIL_FROM","ALERT_EMAIL_TO","ALERT_DELIVERY_TOKEN"];
 return names.every(name=>String(process.env[name]||"").trim().length>0);
}
async function staleBackupIntent(){
 const evidence=await prisma.$queryRaw`SELECT completed_at AS "completedAt" FROM platform_backup_evidence ORDER BY completed_at DESC LIMIT 1`;
 if(!evidence.length)return;
 const last=new Date(evidence[0].completedAt);
 if(!(Date.now()-last.getTime()>26*3600000))return;
 const key="backup:stale:"+last.toISOString();
 await prisma.$executeRaw`
  INSERT INTO platform_alert_delivery_outbox(event_key,category,severity,title)
  VALUES(${key},'BACKUP','critical','Backup diário atrasado')
  ON CONFLICT(event_key) DO NOTHING
 `;
}
async function sendEmail(item){
 const sender=process.env.ALERT_EMAIL_FROM;
 const recipient=process.env.ALERT_EMAIL_TO;
 const body=[
  "PointVet — alerta operacional",
  "Ocorrência: "+item.title,
  "Categoria: "+item.category,
  "Evento: "+item.eventKey,
  "Data UTC: "+new Date(item.createdAt).toISOString(),
  "Consulte o Console Interno → Alertas para verificar a situação atual.",
  "Mensagem automatizada. Não responda."
 ].join("\n");
 const response=await fetch("https://api.resend.com/emails",{
  method:"POST",signal:AbortSignal.timeout(12000),
  headers:{"Authorization":"Bearer "+process.env.RESEND_API_KEY,
   "Content-Type":"application/json","Idempotency-Key":item.eventKey},
  body:JSON.stringify({from:sender,to:[recipient],subject:"[PointVet] "+item.title,text:body})
 });
 if(!response.ok)throw new Error("Provedor de e-mail respondeu HTTP "+response.status);
 return true;
}
export async function dispatchAlertEmails(req,res,next){
 if(!configured())return res.status(503).json({success:false,message:"Canal de e-mail não configurado",sent:0});
 const activation=process.env.ALERT_DELIVERY_ACTIVE_AFTER;
 if(!activation || !Number.isFinite(Date.parse(activation)))return res.status(503).json({success:false,message:"Data de ativação não configurada",sent:0});
 try{
  await staleBackupIntent();
  // Only one task holds a claim for an event at a time. Expired claims are
  // considered uncertain and require manual review to avoid duplicate mail.
  const rows=await prisma.$queryRaw`
   UPDATE platform_alert_delivery_outbox SET state='QUEUED',
     attempts=attempts+1,last_attempt_at=now()
   WHERE id IN (
     SELECT id FROM platform_alert_delivery_outbox
     WHERE state='AWAITING_CHANNEL' AND created_at >= ${new Date(activation)}
     ORDER BY created_at ASC LIMIT 10 FOR UPDATE SKIP LOCKED
   )
   RETURNING id::text, event_key AS "eventKey",category,title,created_at AS "createdAt"
  `;
  let sent=0,failed=0;
  for(const item of rows){
   try{
    await sendEmail(item);
    await prisma.$executeRaw`UPDATE platform_alert_delivery_outbox
     SET state='SENT' WHERE id=${item.id}::uuid AND state='QUEUED'`;
    sent++;
   }catch(error){
    // Failed or ambiguous delivery is not automatically retried.
    await prisma.$executeRaw`UPDATE platform_alert_delivery_outbox
     SET state='FAILED' WHERE id=${item.id}::uuid AND state='QUEUED'`;
    failed++;
    console.error("Falha ao entregar aviso PointVet",{eventKey:item.eventKey,message:error.message});
   }
  }
  return res.json({success:true,processed:rows.length,sent,failed});
 }catch(error){next(error);}
}

/** Explicit opt-in smoke test: one real provider request, never consumes queued alerts. */
export async function testAlertEmail(req,res,next){
 if(!configured())return res.status(503).json({success:false,message:"Canal incompleto"});
 try{
  await sendEmail({eventKey:"manual-test:"+new Date().toISOString(),category:"TEST",title:"Teste da integração de e-mail",createdAt:new Date()});
  return res.json({success:true,message:"Provedor aceitou o e-mail de teste; entrega na caixa de entrada não confirmada"});
 }catch(error){
  console.error("Falha no teste de e-mail PointVet",{message:error.message});
  return res.status(502).json({success:false,message:"O provedor não aceitou o e-mail de teste"});
 }
}
