/** Phase 20.1: read-only eligibility; no payment, sale or stock mutation. */
import {Router} from "express";
import {z} from "zod";
import prisma from "../../config/prisma.js";
import {conferenciaAlocacaoSchema,conferirAlocacaoFechamento,diagnosticarRecuperacaoFechamento,listarCaixasDisponiveisUnificados,prepararExecucaoUnificada,consultarPreparacaoUnificada} from "./pdv-unificado-preparacao.service.js";
import {previewSchema,buscarCatalogo,simularComanda,salvarRascunho,listarRascunhos,conferirPreFechamento,planejarFechamento,reservarOperacoesFechamento,consultarReservaFechamento,cancelarReservaFechamento} from "./pdv-unificado.service.js";
import {autenticarUsuario,selecionarEmpresa,exigirModulo,exigirPermissao} from "../../middlewares/auth.middleware.js";
import {consultarRecebiveisCartaoLeituraM57,listarComandasRecebiveisCartaoLeituraM57} from "./pdv-unificado-recebiveis-leitura.service.js";
import {listarHistoricoRepasseCartaoM514,consultarConferenciaManualM515} from "./pdv-unificado-repasse-historico.service.js";
import {consultarEtapasRepassesM516} from "./pdv-unificado-fluxo-operacional.service.js";
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
/**
 * M.5.7 — somente consulta. As rotas NÃO fazem fechamento de venda,
 * reconciliação de caixa, movimentação financeira ou emissão fiscal.
 * Dois níveis de acesso: pdv.acessar (global), financeiro.gerenciar (local).
 */
function erroRecebiveisM57(error,res,next){
 const codes={
  M57_SEM_ACESSO_FINANCEIRO:[403,"Acesso financeiro negado."],
  M57_PREFERENCIA_DESATIVADA:[403,"PDV unificado desativado nesta organização."],
  M57_COMANDA_NAO_ENCONTRADA:[404,"Comanda não encontrada."],
  M57_CONTEXTO_INVALIDO:[400,"Parâmetros inválidos."]
 };
 if(error?.message?.startsWith("M516_"))return res.status(409).json({
  success:false,message:"Fluxo manual inconsistente ou incompleto. Encaminhe à revisão financeira."
 });
 if(error?.message?.startsWith("M515_"))return res.status(409).json({
  success:false,message:"Histórico financeiro incompleto ou divergente. Solicite revisão financeira."
 });
 if(error?.message?.startsWith("M56_"))return res.status(409).json({
  success:false,message:"Inconsistência de recebíveis identificada. Encaminhe à revisão financeira."
 });
 const entry=codes[error?.message];
 return entry?res.status(entry[0]).json({success:false,message:entry[1]}):next(error);
}
r.get("/recebiveis-cartao/comandas",
 exigirModulo("FINANCEIRO"),exigirPermissao("financeiro.gerenciar"),
 async(req,res,next)=>{try{
  if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)
   return res.status(403).json({success:false,message:"PDV unificado desativado."});
  const dados=await listarComandasRecebiveisCartaoLeituraM57({
   organizacaoId:req.organizacao.id,empresaId:req.empresa.id,usuarioId:req.usuario.id
  });
  return res.set("Cache-Control","no-store").json({success:true,dados});
 }catch(e){erroRecebiveisM57(e,res,next);}
});
/**
 * M.5.15 — one read-only, financially separated manual confirmation overview.
 * Never accepts POST/PUT/DELETE, cannot book cash or do actual checkout.
 */
/**
 * M.5.16: read-only status of preparacao / documentary check /
 * human internal repasse / correction. Not a bank attestation endpoint.
 */
r.get("/recebiveis-cartao/comandas/:comandaId/etapas",
 exigirModulo("FINANCEIRO"),exigirPermissao("financeiro.gerenciar"),
 async(req,res,next)=>{try{
  if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)
   return res.status(403).json({success:false,message:"PDV unificado desativado."});
  const id=z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/)
   .safeParse(req.params.comandaId);
  if(!id.success)return res.status(400).json({success:false,
   message:"Identificador inválido."});
  const dados=await consultarEtapasRepassesM516({
   organizacaoId:req.organizacao.id,empresaId:req.empresa.id,
   usuarioId:req.usuario.id,comandaId:id.data
  });
  return res.set("Cache-Control","no-store").json({success:true,dados});
 }catch(e){erroRecebiveisM57(e,res,next);}
});
r.get("/recebiveis-cartao/comandas/:comandaId/conferencia",
 exigirModulo("FINANCEIRO"),exigirPermissao("financeiro.gerenciar"),
 async(req,res,next)=>{try{
  if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)
   return res.status(403).json({success:false,message:"PDV unificado desativado."});
  const parsed=z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/)
   .safeParse(req.params.comandaId);
  if(!parsed.success)return res.status(400).json({
   success:false,message:"Identificador inválido."
  });
  const dados=await consultarConferenciaManualM515({
   organizacaoId:req.organizacao.id,empresaId:req.empresa.id,
   usuarioId:req.usuario.id,comandaId:parsed.data
  });
  return res.set("Cache-Control","no-store").json({success:true,dados});
 }catch(e){erroRecebiveisM57(e,res,next);}
});
r.get("/recebiveis-cartao/comandas/:comandaId/lancamentos",
 exigirModulo("FINANCEIRO"),exigirPermissao("financeiro.gerenciar"),
 async(req,res,next)=>{try{
  if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)
   return res.status(403).json({success:false,message:"PDV unificado desativado."});
  const parsed=z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/)
   .safeParse(req.params.comandaId);
  if(!parsed.success)return res.status(400).json({success:false,message:"Identificador inválido."});
  const dados=await listarHistoricoRepasseCartaoM514({
   organizacaoId:req.organizacao.id,empresaId:req.empresa.id,
   usuarioId:req.usuario.id,comandaId:parsed.data
  });
  return res.set("Cache-Control","no-store").json({success:true,dados});
 }catch(e){erroRecebiveisM57(e,res,next);}
});
r.get("/recebiveis-cartao/comandas/:comandaId",
 exigirModulo("FINANCEIRO"),exigirPermissao("financeiro.gerenciar"),
 async(req,res,next)=>{try{
  if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)
   return res.status(403).json({success:false,message:"PDV unificado desativado."});
  const id=z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/).safeParse(req.params.comandaId);
  if(!id.success)return res.status(400).json({success:false,message:"Identificador inválido."});
  const dados=await consultarRecebiveisCartaoLeituraM57({
   organizacaoId:req.organizacao.id,empresaId:req.empresa.id,
   usuarioId:req.usuario.id,comandaId:id.data
  });
  return res.set("Cache-Control","no-store").json({success:true,dados});
 }catch(e){erroRecebiveisM57(e,res,next);}
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
 const errors={CLIENTE_NAO_ENCONTRADO:[404,"Cliente não encontrado."],EMPRESA_SEM_ACESSO:[403,"Acesso negado a uma das empresas."],PET_INVALIDO:[400,"Pet não pertence ao tutor."],ITEM_INVALIDO:[400,"Item inválido para a empresa."],PET_OBRIGATORIO:[400,"Selecione o pet para este serviço."],QUANTIDADE_INVALIDA:[400,"Quantidade inválida."],RASCUNHO_NAO_ENCONTRADO:[404,"Rascunho não encontrado."],RASCUNHO_BLOQUEADO:[409,"Rascunho não pode ser modificado."],RASCUNHO_DESATUALIZADO:[409,"A comanda foi alterada. Recarregue antes de salvar."],RASCUNHO_CLIENTE_IMUTAVEL:[409,"Não é permitido trocar o tutor deste rascunho."],RASCUNHO_RESERVADO:[409,"Comanda reservada para fechamento. Cancele a reserva antes de editar."],RESERVA_NAO_ENCONTRADA:[404,"Reserva não encontrada."],RESERVA_CANCELADA:[409,"Reserva cancelada. Atualize a comanda para gerar nova revisão."],RESERVA_NAO_EDITAVEL:[409,"Reserva não pode ser modificada."],PREPARACAO_INVALIDADA:[409,"A preparação foi invalidada com o cancelamento da reserva."],PREPARACAO_DIVERGENTE:[409,"Já existe uma preparação diferente para esta reserva. Não altere a alocação sem nova revisão."],RESERVA_PLANO_DIVERGENTE:[409,"Valores e itens da reserva divergem do plano atualizado."],ALOCACAO_COM_PENDENCIAS:[409,"Revise os caixas e valores alocados antes de preparar a execução."],CANCELAMENTO_SEM_PERMISSAO:[403,"O cancelamento exige permissão em todas as empresas participantes."],PRE_FECHAMENTO_COM_PENDENCIAS:[409,"Existem pendências na comanda. Revise antes de reservar."]};
 if(e.code==="P2002")return res.status(409).json({success:false,message:"Esta reserva já existe. Recarregue a comanda."});
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
r.get("/rascunhos/:id/pre-fechamento",async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"PDV unificado desativado."});
 const versao=z.coerce.number().int().positive().safeParse(req.query.versao);
 if(!versao.success)return res.status(400).json({success:false,message:"Informe a versão do rascunho."});
 return res.json({success:true,dados:await conferirPreFechamento({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id,id:req.params.id,versao:versao.data})});
}catch(e){erroRascunho(e,res,next);}});
r.get("/rascunhos/:id/plano-fechamento",async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"PDV unificado desativado."});
 const versao=z.coerce.number().int().positive().safeParse(req.query.versao);
 if(!versao.success)return res.status(400).json({success:false,message:"Informe a versão do rascunho."});
 return res.json({success:true,dados:await planejarFechamento({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id,id:req.params.id,versao:versao.data})});
}catch(e){
 if(e.message==="PRE_FECHAMENTO_COM_PENDENCIAS")return res.status(409).json({success:false,message:"Há pendências no pré-fechamento. Revise os itens antes de planejar as operações."});
 erroRascunho(e,res,next);
}});
r.get("/rascunhos/:id/reserva",async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"PDV unificado desativado."});
 const versao=z.coerce.number().int().positive().safeParse(req.query.versao);
 if(!versao.success)return res.status(400).json({success:false,message:"Informe uma versão válida."});
 return res.json({success:true,dados:await consultarReservaFechamento({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id,id:req.params.id,versao:versao.data})});
}catch(e){erroRascunho(e,res,next);}});
r.post("/rascunhos/:id/reservar",async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"PDV unificado desativado."});
 const dados=z.object({versao:z.number().int().positive()}).strict().safeParse(req.body);
 if(!dados.success)return res.status(400).json({success:false,message:"Informe uma versão válida."});
 const reserva=await reservarOperacoesFechamento({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id,id:req.params.id,versao:dados.data.versao});
 return res.status(reserva.reutilizada?200:201).json({success:true,dados:reserva});
}catch(e){erroRascunho(e,res,next);}});
r.post("/rascunhos/:id/cancelar-reserva",exigirPermissao("pdv.cancelar_venda"),async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"PDV unificado desativado."});
 const dados=z.object({versao:z.number().int().positive(),motivo:z.string().trim().min(5).max(250)}).strict().safeParse(req.body);
 if(!dados.success)return res.status(400).json({success:false,message:"Versão ou motivo inválido."});
 const reserva=await cancelarReservaFechamento({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id,id:req.params.id,...dados.data});
 return res.json({success:true,dados:reserva});
}catch(e){erroRascunho(e,res,next);}});
/**
 * Routes are intentionally named "conferencia"/"diagnostico".
 * There is no execute/charge/sell endpoint in the unified PDV.
 */
r.post("/rascunhos/:id/conferencia-alocacao",async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"PDV unificado desativado."});
 const parsed=conferenciaAlocacaoSchema.safeParse(req.body);
 if(!parsed.success)return res.status(400).json({success:false,message:"Alocação financeira inválida.",errors:parsed.error.flatten().fieldErrors});
 return res.json({success:true,dados:await conferirAlocacaoFechamento({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id,id:req.params.id,dados:parsed.data})});
}catch(e){erroRascunho(e,res,next);}});
r.get("/rascunhos/:id/diagnostico-recuperacao",async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"PDV unificado desativado."});
 const parsed=z.coerce.number().int().positive().safeParse(req.query.versao);
 if(!parsed.success)return res.status(400).json({success:false,message:"Informe uma versão válida."});
 return res.json({success:true,dados:await diagnosticarRecuperacaoFechamento({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id,id:req.params.id,versao:parsed.data})});
}catch(e){erroRascunho(e,res,next);}});
r.get("/rascunhos/:id/caixas-disponiveis",async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"PDV unificado desativado."});
 const parsed=z.coerce.number().int().positive().safeParse(req.query.versao);
 if(!parsed.success)return res.status(400).json({success:false,message:"Informe uma versão válida."});
 return res.json({success:true,dados:await listarCaixasDisponiveisUnificados({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id,id:req.params.id,versao:parsed.data})});
}catch(e){erroRascunho(e,res,next);}});
r.get("/rascunhos/:id/preparacao-execucao",async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"PDV unificado desativado."});
 const parsed=z.coerce.number().int().positive().safeParse(req.query.versao);
 if(!parsed.success)return res.status(400).json({success:false,message:"Informe uma versão válida."});
 return res.json({success:true,dados:await consultarPreparacaoUnificada({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id,id:req.params.id,versao:parsed.data})});
}catch(e){erroRascunho(e,res,next);}});
r.post("/rascunhos/:id/preparacao-execucao",async(req,res,next)=>{try{
 if(!req.organizacao.configuracao?.pdvUnificadoHabilitado)return res.status(403).json({success:false,message:"PDV unificado desativado."});
 const parsed=conferenciaAlocacaoSchema.safeParse(req.body);
 if(!parsed.success)return res.status(400).json({success:false,message:"Alocações inválidas.",errors:parsed.error.flatten().fieldErrors});
 const result=await prepararExecucaoUnificada({organizacaoId:req.organizacao.id,usuarioId:req.usuario.id,empresaId:req.empresa.id,id:req.params.id,dados:parsed.data});
 return res.status(result.reutilizada?200:201).json({success:true,dados:result});
}catch(e){erroRascunho(e,res,next);}});
export default r;
