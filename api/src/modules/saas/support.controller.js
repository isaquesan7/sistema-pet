/**
 * PointVet 18.4 support: tenant membership comes from selected and authenticated company.
 * No ticket lookup occurs without organization_id scope unless caller is superadmin.
 */
import prisma from "../../config/prisma.js";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validBody=x=>typeof x==="string"&&x.trim().length>=1&&x.trim().length<=4000;
const validSubject=x=>typeof x==="string"&&x.trim().length>=4&&x.trim().length<=160;
const statuses=new Set(["ABERTO","EM_ANALISE","AGUARDANDO_CLIENTE","RESOLVIDO"]);
const cats=new Set(["GERAL","ACESSO","FINANCEIRO","ERRO","SUGESTAO"]);
const rows=async (scope)=>scope
 ? prisma.$queryRaw`SELECT t.id::text,t.subject,t.category,t.status,t.created_at AS "createdAt",t.updated_at AS "updatedAt",o.nome AS "organizationName" FROM platform_support_tickets t JOIN organizacoes o ON o.id=t.organization_id WHERE t.organization_id=${scope} ORDER BY t.updated_at DESC LIMIT 100`
 : prisma.$queryRaw`SELECT t.id::text,t.subject,t.category,t.status,t.created_at AS "createdAt",t.updated_at AS "updatedAt",o.nome AS "organizationName" FROM platform_support_tickets t JOIN organizacoes o ON o.id=t.organization_id ORDER BY t.updated_at DESC LIMIT 100`;
export async function listSupport(req,res,next){
 try{res.set("Cache-Control","no-store");res.json({success:true,dados:await rows(req.organizacao?.id||null)});}catch(e){next(e);}
}
export async function openSupport(req,res,next){
 const {subject,category="GERAL",body}=req.body||{};
 if(!validSubject(subject)||!validBody(body)||!cats.has(category))return res.status(400).json({success:false,message:"Assunto, categoria ou mensagem inválidos"});
 try{
  const id=await prisma.$transaction(async tx=>{
   const created=await tx.$queryRaw`INSERT INTO platform_support_tickets(organization_id,subject,category,opened_by)
    VALUES(${req.organizacao.id},${subject.trim()},${category},${req.usuario.id}) RETURNING id::text`;
   await tx.$executeRaw`INSERT INTO platform_support_messages(ticket_id,author_id,body) VALUES(${created[0].id}::uuid,${req.usuario.id},${body.trim()})`;
   return created[0].id;
  });
  return res.status(201).json({success:true,id});
 }catch(e){next(e);}
}
export async function supportThread(req,res,next){
 if(!uuid.test(req.params.id))return res.status(400).json({success:false,message:"ID inválido"});
 try{
  const id=req.params.id;
  const found=req.organizacao
   ? await prisma.$queryRaw`SELECT id::text,subject,status FROM platform_support_tickets WHERE id=${id}::uuid AND organization_id=${req.organizacao.id}`
   : await prisma.$queryRaw`SELECT id::text,subject,status FROM platform_support_tickets WHERE id=${id}::uuid`;
  if(!found.length)return res.status(404).json({success:false,message:"Chamado não encontrado"});
  const messages=await prisma.$queryRaw`SELECT m.id::text,m.body,m.is_staff AS "isStaff",m.created_at AS "createdAt",u.nome AS "authorName"
   FROM platform_support_messages m JOIN usuarios u ON u.id=m.author_id WHERE m.ticket_id=${id}::uuid ORDER BY m.created_at ASC LIMIT 300`;
  res.set("Cache-Control","no-store");return res.json({success:true,dados:{...found[0],messages}});
 }catch(e){next(e);}
}
export async function replySupport(req,res,next){
 if(!uuid.test(req.params.id)||!validBody(req.body?.body))return res.status(400).json({success:false,message:"Dados inválidos"});
 try{
  const id=req.params.id,staff=!req.organizacao;
  const updated=await prisma.$transaction(async tx=>{
   const ticket=staff
    ? await tx.$queryRaw`SELECT id FROM platform_support_tickets WHERE id=${id}::uuid FOR UPDATE`
    : await tx.$queryRaw`SELECT id FROM platform_support_tickets WHERE id=${id}::uuid AND organization_id=${req.organizacao.id} FOR UPDATE`;
   if(!ticket.length)return false;
   await tx.$executeRaw`INSERT INTO platform_support_messages(ticket_id,author_id,is_staff,body) VALUES(${id}::uuid,${req.usuario.id},${staff},${req.body.body.trim()})`;
   await tx.$executeRaw`UPDATE platform_support_tickets SET updated_at=now(),status=${staff?"AGUARDANDO_CLIENTE":"EM_ANALISE"} WHERE id=${id}::uuid`;
   return true;
  });
  return updated?res.json({success:true}):res.status(404).json({success:false,message:"Chamado não encontrado"});
 }catch(e){next(e);}
}
export async function changeSupportStatus(req,res,next){
 if(!uuid.test(req.params.id)||!statuses.has(req.body?.status))return res.status(400).json({success:false,message:"Status inválido"});
 try{
  const result=await prisma.$queryRaw`UPDATE platform_support_tickets SET status=${req.body.status},updated_at=now()
   WHERE id=${req.params.id}::uuid RETURNING id::text`;
  return result.length?res.json({success:true}):res.status(404).json({success:false,message:"Chamado não encontrado"});
 }catch(e){next(e);}
}
