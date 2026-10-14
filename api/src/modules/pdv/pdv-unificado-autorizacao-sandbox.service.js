/**
 * PointVet 20.2.4B — INTENÇÕES DE AUTORIZAÇÃO / OUTBOX, SANDBOX CI EXCLUSIVO.
 * Sem importação em rotas HTTP e sem conectores de PSP, crédito, fiscal ou estoque.
 * "CONFIRMADA_SIMULADA" NUNCA significa dinheiro recebido nem libera Venda.
 */
import {createHash,randomUUID} from "node:crypto";
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {consultarReservaFechamento,planejarFechamento} from "./pdv-unificado.service.js";

const DATABASE_CI="pointvet_unified_ci";
const formes=new Set(["DINHEIRO","PIX","CARTAO_DEBITO","CARTAO_CREDITO","TRANSFERENCIA"]);
function cents(v){
 const n=Math.round(Number(v)*100);
 if(!Number.isSafeInteger(n)||n<1)throw Error("VALOR_INTENCAO_INVALIDO");
 return n;
}
async function lockComandaCI(tx,id){
 const db=await tx.$queryRaw`SELECT current_database() AS nome`;
 if(db[0]?.nome!==DATABASE_CI)throw Error("BANCO_NAO_ISOLADO");
 await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${id} FOR UPDATE`;
}
async function validarContextoCI(tx,{organizacaoId,usuarioId,empresaId,id,versao}){
 const draft=await tx.comanda.findFirst({where:{id,rascunhoUnificado:true,cliente:{organizacaoId}},
  select:{id:true,versaoRascunho:true,status:true}});
 if(!draft)throw Error("RASCUNHO_NAO_ENCONTRADO");
 if(draft.versaoRascunho!==versao||draft.status!=="ABERTA")throw Error("RASCUNHO_DESATUALIZADO");
 const reserva=await consultarReservaFechamento({organizacaoId,usuarioId,empresaId,id,versao},tx);
 if(!reserva||reserva.status!=="RESERVADA")throw Error("RESERVA_NAO_EDITAVEL");
 const prep=await tx.criacaoPreparacaoUnificada.findUnique({where:{reservaId:reserva.id}});
 if(!prep||prep.status!=="PREPARADA")throw Error("PREPARACAO_INDISPONIVEL");
 const plano=await planejarFechamento({organizacaoId,usuarioId,empresaId,id,versao},tx);
 if(plano.operacoes.length!==reserva.operacoes.length||
  plano.operacoes.some(p=>!reserva.operacoes.some(o=>o.empresaId===p.empresaId&&o.chaveIdempotencia===p.chaveIdempotencia&&cents(o.valor)===cents(p.total))))
  throw Error("PLANO_DIVERGENTE");
 const saved=await tx.reservaOperacaoUnificada.findMany({where:{reservaId:reserva.id},
  include:{venda:{select:{id:true,status:true,empresaId:true,comandaId:true,valorTotal:true}}}});
 if(saved.length!==plano.operacoes.length||saved.some(o=>
  o.status!=="VENDA_RASCUNHO"||!o.vendaId||!o.venda||
  o.venda.status!=="ABERTA"||o.venda.empresaId!==o.empresaId||
  o.venda.comandaId!==id||cents(o.venda.valorTotal)!==cents(o.valorTotal)))
  throw Error("VENDAS_SANDBOX_INDISPONIVEIS");
 const snapshot=prep.snapshot;
 if(snapshot.comandaId!==id||snapshot.versaoRascunho!==versao||
  snapshot.operacoes.length!==saved.length)throw Error("SNAPSHOT_INCONSISTENTE");
 const byCompany=new Map(saved.map(x=>[x.empresaId,x]));
 for(const op of snapshot.operacoes){
  const real=byCompany.get(op.empresaId);
  if(!real||op.chaveIdempotencia!==real.chaveIdempotencia||
   cents(op.total)!==cents(real.valorTotal))throw Error("SNAPSHOT_INCONSISTENTE");
 }
 return {reserva,prep,saved,snapshot,byCompany};
}
function resumir(registros,reutilizada){
 return {status:"INTENCOES_SANDBOX",reutilizada,operacoes:registros.map(r=>({
  id:r.id,empresaId:r.operacao.empresaId,valor:String(r.valor),
  chaveIdempotencia:r.chaveIdempotencia,estado:r.status,outboxStatus:r.outbox.status
 })),checkoutRealHabilitado:false,nenhumPagamentoCriado:true,nenhumEnvioPSP:true};
}
/** An atomic per-payment preparation and outbox, without network dispatch. */
export async function enfileirarAutorizacoesSomenteSandbox(ctx){
 exigirBancoIsolado();
 return prisma.$transaction(async tx=>{
  await lockComandaCI(tx,ctx.id);
  const {reserva,byCompany,snapshot}=await validarContextoCI(tx,ctx);
  const sessionIds=[...new Set(snapshot.operacoes.map(x=>x.sessaoCaixaId))];
  const sessions=await tx.sessaoCaixa.findMany({where:{id:{in:sessionIds}},
   select:{id:true,status:true,caixa:{select:{ativo:true,empresaId:true}}}});
  const bySession=new Map(sessions.map(s=>[s.id,s]));
  const expected=[];
  for(const op of snapshot.operacoes){
   const session=bySession.get(op.sessaoCaixaId);
   if(!session||session.status!=="ABERTO"||!session.caixa.ativo||
      session.caixa.empresaId!==op.empresaId)throw Error("CAIXA_INDISPONIVEL");
   if(!Array.isArray(op.pagamentos)||op.pagamentos.length===0)throw Error("ALOCACAO_INVALIDA");
   let sum=0;
   for(const [indice,p] of op.pagamentos.entries()){
    if(!formes.has(p.forma)||!Number.isSafeInteger(p.valorCentavos)||p.valorCentavos<=0)
      throw Error("FORMA_OU_VALOR_INVALIDO");
    sum+=p.valorCentavos;
    const base=[byCompany.get(op.empresaId).chaveIdempotencia,indice,p.forma,p.valorCentavos,op.sessaoCaixaId].join(":");
    expected.push({operacaoId:byCompany.get(op.empresaId).id,empresaId:op.empresaId,
     indice,forma:p.forma,valor:(p.valorCentavos/100).toFixed(2),
     sessaoCaixaId:op.sessaoCaixaId,
     chaveIdempotencia:createHash("sha256").update("POINTVET_SANDBOX_AUTH:"+base).digest("hex")});
   }
   if(!Number.isSafeInteger(sum)||sum!==cents(op.total))throw Error("ALOCACAO_DIVERGENTE");
  }
  const previous=await tx.intencaoAutorizacaoUnificada.findMany({where:{operacao:{reservaId:reserva.id}},
   include:{operacao:{select:{empresaId:true}},outbox:true},orderBy:[{operacaoId:"asc"},{indice:"asc"}]});
  if(previous.length){
   if(previous.length!==expected.length||expected.some(e=>!previous.some(p=>
     p.operacaoId===e.operacaoId&&p.indice===e.indice&&p.chaveIdempotencia===e.chaveIdempotencia&&
     p.forma===e.forma&&cents(p.valor)===cents(e.valor)&&p.sessaoCaixaId===e.sessaoCaixaId&&p.outbox)))
    throw Error("INTENCOES_DIVERGENTES");
   return resumir(previous,true);
  }
  for(const e of expected){
   await tx.intencaoAutorizacaoUnificada.create({data:{
    operacaoId:e.operacaoId,criadoPorId:ctx.usuarioId,indice:e.indice,
    forma:e.forma,valor:e.valor,sessaoCaixaId:e.sessaoCaixaId,
    chaveIdempotencia:e.chaveIdempotencia,outbox:{create:{}}
   }});
  }
  const created=await tx.intencaoAutorizacaoUnificada.findMany({where:{operacao:{reservaId:reserva.id}},
   include:{operacao:{select:{empresaId:true}},outbox:true},orderBy:[{operacaoId:"asc"},{indice:"asc"}]});
  return resumir(created,false);
 },{isolationLevel:"Serializable",maxWait:5000,timeout:15000});
}
/** Claim a single outbox job. No HTTP, PSP or outbox worker dispatch.
 * If a claim already exists, it is NEVER automatically resent.
 */
export async function reclamarOutboxSomenteSandbox(ctx){
 exigirBancoIsolado();
 return prisma.$transaction(async tx=>{
  await lockComandaCI(tx,ctx.id);
  const {reserva}=await validarContextoCI(tx,ctx);
  const intent=await tx.intencaoAutorizacaoUnificada.findFirst({
   where:{id:ctx.intencaoId,operacao:{reservaId:reserva.id}},include:{outbox:true}});
  if(!intent?.outbox)throw Error("INTENCAO_NAO_ENCONTRADA");
  if(intent.outbox.status!=="PENDENTE"){
   return {intencaoId:intent.id,status:intent.outbox.status,
    token:intent.outbox.tokenExecucao,podeEnviar:false,reutilizada:true};
  }
  const token=randomUUID();
  const changed=await tx.outboxAutorizacaoUnificada.updateMany({
   where:{id:intent.outbox.id,status:"PENDENTE"},
   data:{status:"EM_SIMULACAO",tokenExecucao:token,
    tentativas:{increment:1},ultimaTentativaEm:new Date()}
  });
  if(changed.count!==1)throw Error("CLAIM_CONCORRENTE");
  return {intencaoId:intent.id,status:"EM_SIMULACAO",token,
   podeEnviar:false,reutilizada:false};
 },{isolationLevel:"Serializable",maxWait:5000,timeout:15000});
}
/** Idempotent synthetic event ingestion. Does not create Pagamento or mark Venda FINALIZADA.
 * Conflicting event IDs or terminal outcomes are rejected, not auto-corrected.
 */
export async function registrarEventoSomenteSandbox(ctx){
 exigirBancoIsolado();
 if(!["CONFIRMADA","RECUSADA","INDETERMINADA"].includes(ctx.resultado)||
    typeof ctx.chaveEvento!=="string"||!ctx.chaveEvento.trim()||
    ctx.chaveEvento.length>120)throw Error("EVENTO_INVALIDO");
 return prisma.$transaction(async tx=>{
  await lockComandaCI(tx,ctx.id);
  const {reserva}=await validarContextoCI(tx,ctx);
  const intent=await tx.intencaoAutorizacaoUnificada.findFirst({
   where:{id:ctx.intencaoId,operacao:{reservaId:reserva.id}},include:{outbox:true}});
  if(!intent?.outbox)throw Error("INTENCAO_NAO_ENCONTRADA");
  const old=await tx.eventoAutorizacaoSimulada.findUnique({where:{chaveEvento:ctx.chaveEvento}});
  if(old){
   if(old.intencaoId!==intent.id||old.resultado!==ctx.resultado)throw Error("EVENTO_CONFLITANTE");
   return {intencaoId:intent.id,reutilizada:true,status:intent.status,outbox:intent.outbox.status};
  }
  if(intent.outbox.tokenExecucao!==ctx.token||!ctx.token||
     !["EM_SIMULACAO","REVISAO_MANUAL"].includes(intent.outbox.status))
     throw Error("EVENTO_NAO_AUTORIZADO");
  if(["CONFIRMADA_SIMULADA","RECUSADA_SIMULADA"].includes(intent.status))throw Error("RESULTADO_TERMINAL");
  if(intent.status==="INDETERMINADA_SIMULADA"&&ctx.resultado==="INDETERMINADA")
    throw Error("RECONCILIACAO_INDETERMINADA");
  const status=ctx.resultado==="CONFIRMADA"?"CONFIRMADA_SIMULADA":
   ctx.resultado==="RECUSADA"?"RECUSADA_SIMULADA":"INDETERMINADA_SIMULADA";
  const outStatus=ctx.resultado==="INDETERMINADA"?"REVISAO_MANUAL":"CONCLUIDO_SIMULADO";
  await tx.eventoAutorizacaoSimulada.create({data:{intencaoId:intent.id,chaveEvento:ctx.chaveEvento,resultado:ctx.resultado}});
  await tx.intencaoAutorizacaoUnificada.update({where:{id:intent.id},data:{status}});
  await tx.outboxAutorizacaoUnificada.update({where:{id:intent.outbox.id},data:{status:outStatus}});
  return {intencaoId:intent.id,reutilizada:false,status,outbox:outStatus,
   pagamentoCriado:false,vendaFinalizada:false};
 },{isolationLevel:"Serializable",maxWait:5000,timeout:15000});
}
