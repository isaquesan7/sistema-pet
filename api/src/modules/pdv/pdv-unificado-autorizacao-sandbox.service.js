/**
 * PointVet 20.2.4B — INTENÇÕES DE AUTORIZAÇÃO / OUTBOX, SANDBOX CI EXCLUSIVO.
 * Sem importação em rotas HTTP e sem conectores de PSP, crédito, fiscal ou estoque.
 * "CONFIRMADA_SIMULADA" NUNCA significa dinheiro recebido nem libera Venda.
 */
import {createHash,randomUUID} from "node:crypto";
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {consultarReservaFechamento} from "./pdv-unificado.service.js";

const DATABASE_CI="pointvet_unified_ci";
const LEASE_MS=60_000; // Simulated lease: expiry never grants another send.
const formes=new Set(["DINHEIRO","PIX","CARTAO_DEBITO","CARTAO_CREDITO","TRANSFERENCIA"]);
function cents(v){
 const n=Math.round(Number(v)*100);
 if(!Number.isSafeInteger(n)||n<0)throw Error("VALOR_INTENCAO_INVALIDO");
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
 // The legacy pre-close refuses a draft with linked sales by design.
 // After sale shells exist, validate the immutable snapshot against live rows
 // WITHOUT weakening that legacy protection or accepting browser totals.
 const saved=await tx.reservaOperacaoUnificada.findMany({where:{reservaId:reserva.id},
  include:{venda:{select:{id:true,status:true,empresaId:true,comandaId:true,valorTotal:true}}}});
 if(saved.length!==reserva.operacoes.length||saved.some(o=>
  o.status!=="VENDA_RASCUNHO"||!o.vendaId||!o.venda||
  o.venda.status!=="ABERTA"||o.venda.empresaId!==o.empresaId||
  o.venda.comandaId!==id||cents(o.venda.valorTotal)!==cents(o.valorTotal)))
  throw Error("VENDAS_SANDBOX_INDISPONIVEIS");
 const snapshot=prep.snapshot;
 if(snapshot.comandaId!==id||snapshot.versaoRascunho!==versao||
  snapshot.operacoes.length!==saved.length)throw Error("SNAPSHOT_INCONSISTENTE");
 const currentLines=await tx.comandaItem.findMany({where:{comandaId:id,status:"ATIVO"},
  include:{itemCatalogo:{select:{id:true,empresaId:true,ativo:true,precoVenda:true,servico:{select:{exigePet:true}}}},
    pet:{select:{id:true,ativo:true,clienteId:true}}}});
 const linesById=new Map(currentLines.map(line=>[line.id,line]));
 const snapLines=snapshot.operacoes.flatMap(op=>op.itens.map(line=>({...line,empresaId:op.empresaId})));
 if(snapLines.length!==currentLines.length||new Set(snapLines.map(x=>x.comandaItemId)).size!==snapLines.length)
  throw Error("SNAPSHOT_INCONSISTENTE");
 for(const line of snapLines){
  const now=linesById.get(line.comandaItemId);
  if(!now||now.empresaId!==line.empresaId||now.itemCatalogoId!==line.itemCatalogoId||
    now.petId!==line.petId||!now.itemCatalogo?.ativo||now.itemCatalogo.empresaId!==now.empresaId||
    cents(now.valorUnitario)!==cents(line.valorUnitario)||
    cents(now.valorTotal)!==cents(line.valorTotal)||
    cents(now.desconto)!==Math.round(Number(line.desconto)*100)||
    Number(now.quantidade)!==Number(line.quantidade)||
    cents(now.itemCatalogo.precoVenda)!==cents(now.valorUnitario))
    throw Error("SNAPSHOT_INCONSISTENTE");
  if((now.petId&&(!now.pet?.ativo||now.pet.clienteId!==snapshot.clienteId))||
    (now.itemCatalogo.servico?.exigePet&&!now.petId))throw Error("PET_INVALIDO");
 }
 const byCompany=new Map(saved.map(x=>[x.empresaId,x]));
 for(const op of snapshot.operacoes){
  const real=byCompany.get(op.empresaId);
  if(!real||op.chaveIdempotencia!==real.chaveIdempotencia||
   cents(op.total)!==cents(real.valorTotal)||
   op.itens.reduce((n,i)=>n+cents(i.valorTotal),0)!==cents(op.total))throw Error("SNAPSHOT_INCONSISTENTE");
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
  const now=new Date();
  const leaseExpiraEm=new Date(now.getTime()+LEASE_MS);
  const changed=await tx.outboxAutorizacaoUnificada.updateMany({
   where:{id:intent.outbox.id,status:"PENDENTE"},
   data:{status:"EM_SIMULACAO",tokenExecucao:token,leaseExpiraEm,
    tentativas:{increment:1},ultimaTentativaEm:now,motivoRevisao:null}
  });
  if(changed.count!==1)throw Error("CLAIM_CONCORRENTE");
  return {intencaoId:intent.id,status:"EM_SIMULACAO",token,leaseExpiraEm,
   podeEnviar:false,reutilizada:false};
 },{isolationLevel:"Serializable",maxWait:5000,timeout:15000});
}
/** Expired claims are fenced into manual reconciliation, never automatically
 * released to PENDENTE. An authentic late PSP result may still resolve the
 * original attempt, with the ORIGINAL token, without a second send.
 * Simulation time can be injected only in this CI-guarded internal function.
 */
export async function verificarExpiracaoOutboxSomenteSandbox(ctx){
 exigirBancoIsolado();
 const agoraMs=ctx.agoraMs??Date.now();
 if(!Number.isSafeInteger(agoraMs)||agoraMs<0)throw Error("TEMPO_INVALIDO");
 return prisma.$transaction(async tx=>{
  await lockComandaCI(tx,ctx.id);
  const {reserva}=await validarContextoCI(tx,ctx);
  const intent=await tx.intencaoAutorizacaoUnificada.findFirst({
   where:{id:ctx.intencaoId,operacao:{reservaId:reserva.id}},include:{outbox:true}});
  if(!intent?.outbox)throw Error("INTENCAO_NAO_ENCONTRADA");
  const o=intent.outbox;
  if(o.status!=="EM_SIMULACAO")return {
   intencaoId:intent.id,status:o.status,precisaConciliar:o.status==="REVISAO_MANUAL",
   podeReenviar:false,alterado:false};
  if(!o.leaseExpiraEm){
   // Legacy incomplete lease: never automatically resend.
   await tx.outboxAutorizacaoUnificada.updateMany({
    where:{id:o.id,status:"EM_SIMULACAO"},
    data:{status:"REVISAO_MANUAL",motivoRevisao:"LEASE_AUSENTE"}
   });
   return {intencaoId:intent.id,status:"REVISAO_MANUAL",precisaConciliar:true,
    podeReenviar:false,alterado:true,motivo:"LEASE_AUSENTE"};
  }
  if(o.leaseExpiraEm.getTime()>agoraMs)return {
   intencaoId:intent.id,status:"EM_SIMULACAO",precisaConciliar:false,
   podeReenviar:false,alterado:false};
  const updated=await tx.outboxAutorizacaoUnificada.updateMany({
   where:{id:o.id,status:"EM_SIMULACAO",tokenExecucao:o.tokenExecucao,
    leaseExpiraEm:{lte:new Date(agoraMs)}},
   data:{status:"REVISAO_MANUAL",motivoRevisao:"TIMEOUT_SEM_CONFIRMACAO"}
  });
  if(updated.count!==1)throw Error("TIMEOUT_CONCORRENTE");
  return {intencaoId:intent.id,status:"REVISAO_MANUAL",precisaConciliar:true,
   podeReenviar:false,alterado:true,motivo:"TIMEOUT_SEM_CONFIRMACAO"};
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
  await tx.outboxAutorizacaoUnificada.update({where:{id:intent.outbox.id},data:{status:outStatus,
   motivoRevisao:ctx.resultado==="INDETERMINADA"?"RESULTADO_INDETERMINADO":null,
   leaseExpiraEm:null}});
  return {intencaoId:intent.id,reutilizada:false,status,outbox:outStatus,
   pagamentoCriado:false,vendaFinalizada:false};
 },{isolationLevel:"Serializable",maxWait:5000,timeout:15000});
}
