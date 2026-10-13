/** Phase 20.1: read-only eligibility; no payment, sale or stock mutation. */
import {Router} from "express";
import prisma from "../../config/prisma.js";
import {previewSchema,buscarCatalogo,simularComanda} from "./pdv-unificado.service.js";
import {autenticarUsuario,selecionarEmpresa,exigirModulo,exigirPermissao} from "../../middlewares/auth.middleware.js";
const r=Router();
r.use(autenticarUsuario,selecionarEmpresa,exigirModulo("PDV"),exigirPermissao("pdv.acessar"));
r.get("/disponibilidade",async(req,res,next)=>{
 try{
  const access=await prisma.usuarioEmpresa.findMany({where:{usuarioId:req.usuario.id,ativo:true,empresa:{ativo:true,organizacaoId:req.organizacao.id}},select:{empresaId:true,empresa:{select:{id:true,nomeFantasia:true,cnpj:true,tipo:true}}}});
  const pdvHabilitado=Boolean(req.organizacao.configuracao?.pdvUnificadoHabilitado);
  return res.json({success:true,dados:{
   preferenciaUnificado:pdvHabilitado,checkoutUnificadoDisponivel:false,
   modoEfetivo:"INDIVIDUAL",
   empresasAcessiveis:access.map(v=>v.empresa),
   aviso:"O PDV individual permanece em uso até a homologação do fechamento multiempresa."
  }});
 }catch(error){next(error);}
});
r.get("/catalogo",async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"Preferência de PDV unificado desativada."});
 const dados=await buscarCatalogo({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id,busca:String(req.query.busca||"").slice(0,100)});
 return res.json({success:true,dados});
}catch(e){next(e);}});
r.post("/simulacao",async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"Preferência de PDV unificado desativada."});
 const parsed=previewSchema.safeParse(req.body);
 if(!parsed.success)return res.status(400).json({success:false,message:"Itens inválidos.",errors:parsed.error.flatten().fieldErrors});
 const dados=await simularComanda({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id,...parsed.data});
 return res.json({success:true,dados});
}catch(e){
 const messages={CLIENTE_NAO_ENCONTRADO:"Cliente não encontrado.",EMPRESA_SEM_ACESSO:"Você não tem acesso à empresa de um dos itens.",PET_INVALIDO:"Pet não pertence ao cliente.",ITEM_INVALIDO:"Produto ou serviço não encontrado nesta empresa.",PET_OBRIGATORIO:"Este serviço exige um pet.",QUANTIDADE_INVALIDA:"Quantidade deve ter no máximo três casas decimais."};
 if(messages[e.message])return res.status(400).json({success:false,message:messages[e.message]});
 next(e);
}});
export default r;
