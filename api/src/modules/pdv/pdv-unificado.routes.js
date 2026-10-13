/** Phase 20.1: read-only eligibility; no payment, sale or stock mutation. */
import {Router} from "express";
import {z} from "zod";
import prisma from "../../config/prisma.js";
import {previewSchema,buscarCatalogo,simularComanda,salvarRascunho,listarRascunhos} from "./pdv-unificado.service.js";
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

function erroRascunho(e,res,next){
 const errors={CLIENTE_NAO_ENCONTRADO:[404,"Cliente não encontrado."],EMPRESA_SEM_ACESSO:[403,"Acesso negado a uma das empresas."],PET_INVALIDO:[400,"Pet não pertence ao tutor."],ITEM_INVALIDO:[400,"Item inválido para a empresa."],PET_OBRIGATORIO:[400,"Selecione o pet para este serviço."],QUANTIDADE_INVALIDA:[400,"Quantidade inválida."],RASCUNHO_NAO_ENCONTRADO:[404,"Rascunho não encontrado."],RASCUNHO_BLOQUEADO:[409,"Rascunho não pode ser modificado."],RASCUNHO_DESATUALIZADO:[409,"A comanda foi alterada. Recarregue antes de salvar."],RASCUNHO_CLIENTE_IMUTAVEL:[409,"Não é permitido trocar o tutor deste rascunho."]};
 if(e.code==="P2034")return res.status(409).json({success:false,message:"Conflito simultâneo. Recarregue e tente novamente."});
 const result=errors[e.message];return result?res.status(result[0]).json({success:false,message:result[1]}):next(e);
}
r.get("/rascunhos",async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"PDV unificado desativado."});
 return res.json({success:true,dados:await listarRascunhos({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id})});
}catch(e){next(e);}});
r.post("/rascunhos",async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"PDV unificado desativado."});
 const parsed=previewSchema.safeParse(req.body);
 if(!parsed.success)return res.status(400).json({success:false,message:"Itens inválidos.",errors:parsed.error.flatten().fieldErrors});
 return res.status(201).json({success:true,dados:await salvarRascunho({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id,...parsed.data})});
}catch(e){erroRascunho(e,res,next);}});
r.put("/rascunhos/:id",async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"PDV unificado desativado."});
 const parsed=previewSchema.extend({versao:z.number().int().positive()}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({success:false,message:"Rascunho ou revisão inválida."});
 const {versao,...dados}=parsed.data;
 return res.json({success:true,dados:await salvarRascunho({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id,...dados},{id:req.params.id,versao})});
}catch(e){erroRascunho(e,res,next);}});
export default r;
