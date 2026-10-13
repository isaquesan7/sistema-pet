/**
 * Current-user profile. Never accepts a userId or authorization flags from input.
 * Credential changes require the account's current password.
 */
import bcrypt from "bcryptjs";
import {z} from "zod";
import prisma from "../../config/prisma.js";

const schema=z.object({
  nome:z.string().trim().min(2).max(120),
  nomeExibicao:z.string().trim().max(80).nullable().optional(),
  email:z.email().max(254).transform(v=>v.trim().toLowerCase()),
  telefone:z.string().trim().max(40).nullable().optional(),
  fotoUrl:z.union([z.url().startsWith("https://").max(2000),z.literal("")]).nullable().optional(),
  senhaAtual:z.string().optional()
}).strict();
const passwordSchema=z.object({
  senhaAtual:z.string().min(1),
  novaSenha:z.string().min(12).max(128),
  confirmarSenha:z.string()
}).strict();

function summary(user){return {id:user.id,nome:user.nome,nomeExibicao:user.nomeExibicao,email:user.email,telefone:user.telefone,fotoUrl:user.fotoUrl,superAdmin:user.superAdmin};}
export async function getMyProfile(req,res,next){
  try{
    const user=await prisma.usuario.findUnique({where:{id:req.usuario.id}});
    if(!user)return res.status(404).json({success:false,message:"Usuário não encontrado."});
    return res.json({success:true,usuario:summary(user)});
  }catch(e){next(e);}
}
export async function editMyProfile(req,res,next){
  try{
    const parsed=schema.safeParse(req.body);
    if(!parsed.success)return res.status(400).json({success:false,message:"Dados inválidos."});
    const data=parsed.data;
    const current=await prisma.usuario.findUnique({where:{id:req.usuario.id}});
    if(!current)return res.status(404).json({success:false,message:"Usuário não encontrado."});
    const changingEmail=data.email!==current.email;
    if(changingEmail && (!data.senhaAtual || !await bcrypt.compare(data.senhaAtual,current.senhaHash))){
      return res.status(403).json({success:false,message:"Confirme a senha atual para alterar o e-mail."});
    }
    const duplicate=changingEmail?await prisma.usuario.findUnique({where:{email:data.email},select:{id:true}}):null;
    if(duplicate)return res.status(409).json({success:false,message:"E-mail já está em uso."});
    const updated=await prisma.usuario.update({where:{id:current.id},data:{
      nome:data.nome,nomeExibicao:data.nomeExibicao||null,email:data.email,
      telefone:data.telefone||null,fotoUrl:data.fotoUrl||null
    }});
    return res.json({success:true,usuario:summary(updated),reloginRequired:changingEmail});
  }catch(e){if(e.code==="P2002")return res.status(409).json({success:false,message:"E-mail já está em uso."});next(e);}
}
export async function changeMyPassword(req,res,next){
  try{
    const parsed=passwordSchema.safeParse(req.body);
    if(!parsed.success)return res.status(400).json({success:false,message:"A nova senha deve ter entre 12 e 128 caracteres."});
    const {senhaAtual,novaSenha,confirmarSenha}=parsed.data;
    if(novaSenha!==confirmarSenha)return res.status(400).json({success:false,message:"A confirmação não corresponde."});
    if(novaSenha===senhaAtual)return res.status(400).json({success:false,message:"Escolha uma senha diferente."});
    const current=await prisma.usuario.findUnique({where:{id:req.usuario.id}});
    if(!current||!await bcrypt.compare(senhaAtual,current.senhaHash))return res.status(403).json({success:false,message:"Senha atual incorreta."});
    const senhaHash=await bcrypt.hash(novaSenha,12);
    await prisma.$transaction([
      prisma.usuario.update({where:{id:current.id},data:{senhaHash}}),
      prisma.sessaoUsuario.updateMany({where:{usuarioId:current.id,revokedAt:null},data:{revokedAt:new Date()}})
    ]);
    return res.json({success:true,message:"Senha alterada. Entre novamente em todos os dispositivos.",reloginRequired:true});
  }catch(e){next(e);}
}
