/** Customer-scoped quotes and read-only prepaid-credit API. */
import {Router} from "express";
import {autenticarUsuario,selecionarEmpresa,exigirPermissao} from "../../middlewares/auth.middleware.js";
import {createSchema,listQuotes,createQuote,setQuoteStatus,creditLedger} from "./client-finance.service.js";
const r=Router();
r.use(autenticarUsuario,selecionarEmpresa);
function err(e,res,next){const messages={CADASTRO_INVALIDO:[404,"Cliente ou empresa não encontrado."],PET_INVALIDO:[400,"O pet selecionado não pertence ao cliente."],DESCONTO_INVALIDO:[400,"Desconto superior ao subtotal."],ORCAMENTO_NAO_ENCONTRADO:[404,"Orçamento não encontrado."],ORCAMENTO_FECHADO:[409,"O orçamento não está mais disponível para alteração."],ORCAMENTO_EXPIRADO:[409,"O orçamento expirou."],TOTAL_INVALIDO:[400,"Total inválido."],OPERADOR_OBRIGATORIO:[403,"Operador ausente."]};const v=messages[e.message];return v?res.status(v[0]).json({success:false,message:v[1]}):next(e);}
r.get("/:clienteId/orcamentos",exigirPermissao("financeiro.visualizar"),async(req,res,next)=>{try{res.json({success:true,dados:await listQuotes(req.organizacao.id,req.empresa.id,req.params.clienteId)});}catch(e){err(e,res,next);}});
r.post("/:clienteId/orcamentos",exigirPermissao("financeiro.gerenciar"),async(req,res,next)=>{try{
 const data=createSchema.safeParse({...req.body,clienteId:req.params.clienteId});
 if(!data.success)return res.status(400).json({success:false,message:"Verifique os itens e valores do orçamento.",errors:data.error.flatten().fieldErrors});
 const orcamento=await createQuote(req.organizacao.id,req.empresa.id,data.data,req.usuario.id);
 return res.status(201).json({success:true,orcamento});
}catch(e){err(e,res,next);}});
r.post("/:clienteId/orcamentos/:id/status",exigirPermissao("financeiro.gerenciar"),async(req,res,next)=>{try{
 const allowed=["ENVIADO","APROVADO","REJEITADO","CANCELADO"];
 if(!allowed.includes(req.body?.status))return res.status(400).json({success:false,message:"Situação inválida."});
 const orcamento=await setQuoteStatus(req.organizacao.id,req.empresa.id,req.params.clienteId,req.params.id,req.body.status,req.usuario.id);
 return res.json({success:true,orcamento});
}catch(e){err(e,res,next);}});
r.get("/:clienteId/credito",exigirPermissao("financeiro.visualizar"),async(req,res,next)=>{try{
 return res.json({success:true,dados:await creditLedger(req.organizacao.id,req.empresa.id,req.params.clienteId)});
}catch(e){err(e,res,next);}});
export default r;
