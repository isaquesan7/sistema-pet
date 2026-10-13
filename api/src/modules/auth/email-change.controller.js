/**
 * Two-step, password-gated email verification. No address change before code proof.
 * Uses the existing Resend credentials; never exposes the verification code in responses/logs.
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import {z} from "zod";
import prisma from "../../config/prisma.js";

const requestSchema=z.object({emailNovo:z.email().max(254).transform(v=>v.trim().toLowerCase()),senhaAtual:z.string().min(1)}).strict();
const confirmSchema=z.object({codigo:z.string().regex(/^\d{6}$/)}).strict();
const hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");
const forbidden=(res)=>res.status(400).json({success:false,message:"Não foi possível iniciar ou confirmar a alteração de e-mail."});

export async function requestEmailChange(req,res,next){
 try{
  const parsed=requestSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({success:false,message:"Informe o novo e-mail e a senha atual."});
  if(!process.env.RESEND_API_KEY||!process.env.ALERT_EMAIL_FROM)return res.status(503).json({success:false,message:"Confirmação por e-mail indisponível no momento."});
  const user=await prisma.usuario.findUnique({where:{id:req.usuario.id}});
  if(!user||!await bcrypt.compare(parsed.data.senhaAtual,user.senhaHash))return res.status(403).json({success:false,message:"Senha atual incorreta."});
  const emailNovo=parsed.data.emailNovo;
  if(emailNovo===user.email)return res.status(400).json({success:false,message:"Esse já é o e-mail da sua conta."});
  const duplicate=await prisma.usuario.findUnique({where:{email:emailNovo},select:{id:true}});
  if(duplicate)return res.status(409).json({success:false,message:"E-mail já está em uso."});
  const codigo=String(crypto.randomInt(0,1000000)).padStart(6,"0");
  const codigoHash=hash(user.id+":"+codigo);
  const pending=await prisma.alteracaoEmailPendente.upsert({
    where:{usuarioId:user.id},
    create:{usuarioId:user.id,emailNovo,codigoHash,expiraEm:new Date(Date.now()+10*60*1000)},
    update:{emailNovo,codigoHash,tentativas:0,expiraEm:new Date(Date.now()+10*60*1000)}
  });
  try{
   const result=await fetch("https://api.resend.com/emails",{
    method:"POST",headers:{Authorization:"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({from:process.env.ALERT_EMAIL_FROM,to:[emailNovo],subject:"PointVet — confirme seu novo e-mail",
      text:"Seu código de confirmação PointVet é: "+codigo+"\nEle expira em 10 minutos. Se você não solicitou esta alteração, ignore esta mensagem."}),
    signal:AbortSignal.timeout(12000)
   });
   if(!result.ok)throw Error("EMAIL_DELIVERY_FAILED");
  }catch(e){
   await prisma.alteracaoEmailPendente.deleteMany({where:{id:pending.id,codigoHash}}).catch(()=>{});
   return res.status(502).json({success:false,message:"Não foi possível enviar o código. Tente novamente."});
  }
  return res.json({success:true,message:"Enviamos um código de seis dígitos ao novo e-mail. Ele expira em 10 minutos."});
 }catch(e){next(e);}
}

export async function confirmEmailChange(req,res,next){
 try{
  const parsed=confirmSchema.safeParse(req.body);
  if(!parsed.success)return forbidden(res);
  const userId=req.usuario.id;
  const pending=await prisma.alteracaoEmailPendente.findUnique({where:{usuarioId:userId}});
  if(!pending||pending.expiraEm.getTime()<=Date.now()||pending.tentativas>=5)return forbidden(res);
  const received=Buffer.from(hash(userId+":"+parsed.data.codigo),"hex");
  const expected=Buffer.from(pending.codigoHash,"hex");
  if(expected.length!==received.length||!crypto.timingSafeEqual(expected,received)){
   await prisma.alteracaoEmailPendente.updateMany({where:{id:pending.id,tentativas:{lt:5}},data:{tentativas:{increment:1}}});
   return forbidden(res);
  }
  try{
   await prisma.$transaction(async tx=>{
    const claim=await tx.alteracaoEmailPendente.deleteMany({
      where:{id:pending.id,usuarioId:userId,codigoHash:pending.codigoHash,tentativas:{lt:5},expiraEm:{gt:new Date()}}
    });
    if(claim.count!==1)throw Error("CODE_EXPIRED");
    await tx.usuario.update({where:{id:userId},data:{email:pending.emailNovo}});
    await tx.sessaoUsuario.updateMany({where:{usuarioId:userId,revokedAt:null},data:{revokedAt:new Date()}});
   });
  }catch(e){
   if(e.code==="P2002")return res.status(409).json({success:false,message:"E-mail já está em uso."});
   if(e.message==="CODE_EXPIRED")return forbidden(res);
   throw e;
  }
  return res.json({success:true,message:"E-mail confirmado. Entre novamente.",reloginRequired:true});
 }catch(e){next(e);}
}
