/**
 * PointVet M.4B.2 — causal prepaid-credit sandbox for disposable PG only.
 * No public route, no credit-as-payment, no bank/PSP operations.
 *
 * ENTRADA requires an existing, one-to-one fully reconciled bank-side
 * advance title and baixa. This is accounting evidence, NOT independent
 * proof of settlement by a banking institution.
 * UTILIZACAO is strictly an isolated balance test, NOT a sale settlement.
 */
import {createHash} from "node:crypto";
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "../pdv/pdv-unificado-venda-sandbox.service.js";
import {valorCreditoCentavos,checarRazaoCreditoCausal} from "./client-credit-ledger.contract.js";
import {conferirEvidenciasCreditoAtualizadas,obterConciliacaoDevolucaoContabil} from "./client-credit-evidence.service.js";

const fail=x=>{throw Error(x);};
const digest=o=>createHash("sha256").update(JSON.stringify(o)).digest("hex");
const validId=x=>typeof x==="string"&&/^[A-Za-z0-9][A-Za-z0-9:._-]{7,119}$/.test(x);
function paramsBase(input){
 const {organizacaoId,empresaId,clienteId,usuarioId,solicitacaoId}=input;
 if([organizacaoId,empresaId,clienteId,usuarioId].some(x=>!x||typeof x!=="string"))
  fail("M4B2_IDENTIDADE_INVALIDA");
 if(!validId(solicitacaoId))fail("M4B2_CHAVE_IDEMPOTENCIA_INVALIDA");
 return {organizacaoId,empresaId,clienteId,usuarioId,solicitacaoId};
}
async function authorize(tx,x){
 const {organizacaoId,empresaId,clienteId,usuarioId}=x;
 const user=await tx.usuario.findUnique({where:{id:usuarioId},select:{status:true}});
 if(user?.status!=="ATIVO")fail("M4B2_USUARIO_INATIVO");
 const [c,e,link]=await Promise.all([
  tx.cliente.findFirst({where:{id:clienteId,organizacaoId,ativo:true},select:{id:true}}),
  tx.empresa.findFirst({where:{id:empresaId,organizacaoId,ativo:true},select:{id:true}}),
  tx.usuarioEmpresa.findFirst({where:{
   usuarioId,empresaId,ativo:true,empresa:{organizacaoId,ativo:true}
  },include:{cargo:{include:{permissoes:{include:{permissao:true}}}}}})
 ]);
 if(!c||!e)fail("M4B2_TENANT_INVALIDO");
 if(!link?.cargo?.ativo||!link.cargo.permissoes.some(p=>p.permissao.codigo==="financeiro.gerenciar"))
  fail("M4B2_SEM_PERMISSAO_FINANCEIRA");
}
async function lockedContext(tx,input){
 const x=paramsBase(input);
 if((await tx.$queryRawUnsafe("SELECT current_database() AS nome"))[0]?.nome!=="pointvet_unified_ci")
  fail("BANCO_NAO_ISOLADO");
 // One client lock serializes every credit operation, across all company units.
 await tx.$queryRawUnsafe('SELECT "id" FROM "clientes" WHERE "id"=$1 FOR UPDATE',x.clienteId);
 await authorize(tx,x);
 return x;
}
const key=(x,tipo)=>digest({version:1,organizacaoId:x.organizacaoId,
 empresaId:x.empresaId,clienteId:x.clienteId,solicitacaoId:x.solicitacaoId,tipo});
const outcome=(x,balance,reutilizada)=>({
 id:x.id,tipo:x.tipo,valor:Number(x.valor),
 clienteId:x.clienteId,empresaId:x.empresaId,
 saldoApos:Number((balance/100).toFixed(2)),reutilizada,
 creditoUsavelNoPdv:false,houvePagamento:false,houveDevolucaoBancaria:false,
 somenteBancoDescartavel:true
});
async function ledger(tx,x){
 const all=await tx.creditoClienteMovimento.findMany({where:{
  organizacaoId:x.organizacaoId,empresaId:x.empresaId,clienteId:x.clienteId
 },orderBy:[{createdAt:"asc"},{id:"asc"}]});
 const sum=checarRazaoCreditoCausal(all);
 if(!sum.saldoConfiavel)fail("M4B2_RAZAO_NAO_HOMOLOGADO_"+sum.motivo);
 const proof=await conferirEvidenciasCreditoAtualizadas(tx,all,x);
 if(!proof.valido)fail("M4B2_RAZAO_NAO_HOMOLOGADO_"+proof.motivo);
 return sum.saldoCentavos;
}
async function replay(tx,x,tipo,fingerprint){
 const found=await tx.creditoClienteMovimento.findUnique({where:{idempotencia:key(x,tipo)}});
 if(!found)return null;
 if(found.tipo!==tipo||found.solicitacaoFingerprint!==fingerprint||
   found.organizacaoId!==x.organizacaoId||found.empresaId!==x.empresaId||
   found.clienteId!==x.clienteId)fail("M4B2_REPLAY_DIVERGENTE");
 return found;
}
async function event(tx,x,acao,movement,summary){
 await tx.auditoria.create({data:{
  organizacaoId:x.organizacaoId,empresaId:x.empresaId,usuarioId:x.usuarioId,
  acao,entidade:"CreditoClienteMovimento",entidadeId:movement.id,dadosNovos:summary
 }});
}
const transOpts={isolationLevel:"Serializable",maxWait:10000,timeout:25000};
/** Append-only, already-reconciled advance. No raw/manual payment proof accepted. */
export async function registrarEntradaCreditoConciliadaSomenteSandbox(input){
 exigirBancoIsolado();
 const x=paramsBase(input);
 const {conciliacaoId,valorCentavos,simularFalhaAposLancamento=false}=input;
 if(!conciliacaoId||!Number.isSafeInteger(valorCentavos)||valorCentavos<=0||
   valorCentavos>999999999999)fail("M4B2_ORIGEM_OU_VALOR_INVALIDO");
 const fingerprint=digest({version:1,tipo:"ENTRADA",conciliacaoId,valorCentavos});
 return prisma.$transaction(async tx=>{
  await lockedContext(tx,x);
  const previous=await replay(tx,x,"ENTRADA",fingerprint);
  if(previous)return outcome(previous,await ledger(tx,x),true);
  const previousBalance=await ledger(tx,x);
  const proof=await tx.conciliacaoFinanceira.findFirst({where:{
   id:conciliacaoId,empresaId:x.empresaId,direcao:"ENTRADA",origem:"BAIXA_TITULO"
  },include:{contaFinanceira:true}});
  if(!proof||!proof.contaFinanceira.ativo||
     proof.contaFinanceira.empresaId!==x.empresaId)
   fail("M4B2_ORIGEM_SEM_CONCILIACAO");
  const baixa=await tx.baixaFinanceira.findUnique({
   where:{id:proof.origemId},include:{titulo:true}
  });
  const titulo=baixa?.titulo;
  if(!baixa||!titulo||baixa.contaFinanceiraId!==proof.contaFinanceiraId||
     titulo.organizacaoId!==x.organizacaoId||titulo.empresaId!==x.empresaId||
     titulo.clienteId!==x.clienteId||titulo.vendaId||titulo.pagamentoId||
     titulo.tipo!=="RECEBER"||titulo.origem!=="OUTRO"||
     titulo.status!=="PAGO"||!titulo.descricao.toUpperCase().startsWith("ADIANTAMENTO CLIENTE"))
   fail("M4B2_TITULO_NAO_E_ADIANTAMENTO");
  const other=await tx.baixaFinanceira.count({where:{tituloId:titulo.id}});
  const amount=valorCreditoCentavos(baixa.valor);
  if(other!==1||amount!==valorCentavos||
     valorCreditoCentavos(proof.valor)!==amount||
     valorCreditoCentavos(titulo.valorOriginal)!==amount||
     valorCreditoCentavos(titulo.valorPago)!==amount||
     Number(baixa.desconto)!==0||Number(baixa.juros)!==0)
   fail("M4B2_VALORES_SEM_CONCILIACAO");
  if(await tx.creditoClienteMovimento.count({where:{conciliacaoId}}))
   fail("M4B2_ORIGEM_JA_CREDITADA");
  if(!Number.isSafeInteger(previousBalance+valorCentavos)||
     previousBalance+valorCentavos>999999999999)fail("M4B2_SALDO_INVALIDO");
  const created=await tx.creditoClienteMovimento.create({data:{
   organizacaoId:x.organizacaoId,empresaId:x.empresaId,clienteId:x.clienteId,
   tipo:"ENTRADA",valor:(amount/100).toFixed(2),conciliacaoId,
   referenciaId:baixa.id,motivo:"Adiantamento de cliente conciliado (CI)",
   responsavelId:x.usuarioId,idempotencia:key(x,"ENTRADA"),
   solicitacaoFingerprint:fingerprint,
   evidencia:{tipo:"BAIXA_CONCILIADA_CI",conciliacaoId,
    baixaId:baixa.id,tituloId:titulo.id,contaFinanceiraId:proof.contaFinanceiraId,
    valorCentavos:amount,conciliadoEm:proof.conciliadoEm.toISOString(),
    verificadoPeloBanco:false}
  }});
  await event(tx,x,"CREDITO_CLIENTE_ENTRADA_CONCILIADA_CI",created,{
   conciliacaoId,baixaId:baixa.id,valorCentavos:amount,
   saldoAntesCentavos:previousBalance,saldoDepoisCentavos:previousBalance+amount
  });
  if(simularFalhaAposLancamento)fail("M4B2_FALHA_SIMULADA_TRANSACAO");
  return outcome(created,previousBalance+amount,false);
 },transOpts);
}
/** CI accounting stress only: no sale, payment or PDV integration. */
export async function simularUtilizacaoCreditoSomenteSandbox(input){
 exigirBancoIsolado();
 const x=paramsBase(input),{valorCentavos,simularFalhaAposLancamento=false}=input;
 if(!Number.isSafeInteger(valorCentavos)||valorCentavos<=0||valorCentavos>999999999999)
  fail("M4B2_VALOR_INVALIDO");
 const fingerprint=digest({version:1,tipo:"UTILIZACAO",valorCentavos,modo:"SIMULACAO_CI"});
 return prisma.$transaction(async tx=>{
  await lockedContext(tx,x);
  const prev=await replay(tx,x,"UTILIZACAO",fingerprint);
  if(prev)return outcome(prev,await ledger(tx,x),true);
  const saldo=await ledger(tx,x);
  if(saldo<valorCentavos)fail("M4B2_SALDO_INSUFICIENTE");
  const created=await tx.creditoClienteMovimento.create({data:{
   organizacaoId:x.organizacaoId,empresaId:x.empresaId,clienteId:x.clienteId,
   tipo:"UTILIZACAO",valor:(valorCentavos/100).toFixed(2),
   motivo:"SIMULACAO SOMENTE CI, não uma compra",responsavelId:x.usuarioId,
   idempotencia:key(x,"UTILIZACAO"),solicitacaoFingerprint:fingerprint,
   evidencia:{tipo:"DEBITO_SIMULADO_CI",semPagamento:true,semVenda:true}
  }});
  await event(tx,x,"CREDITO_CLIENTE_DEBITO_SIMULADO_CI",created,{
   valorCentavos,saldoAntesCentavos:saldo,saldoDepoisCentavos:saldo-valorCentavos
  });
  if(simularFalhaAposLancamento)fail("M4B2_FALHA_SIMULADA_TRANSACAO");
  return outcome(created,saldo-valorCentavos,false);
 },transOpts);
}
/** A reversal refers to EXACTLY ONE original entry/debit. Never a reversal of reversal. */
export async function estornarCreditoCausalSomenteSandbox(input){
 exigirBancoIsolado();
 const x=paramsBase(input);
 const {movimentoOriginalId,motivo,confirmouDevolucaoExterna=false,
  devolucaoConciliacaoId=null,simularFalhaAposLancamento=false}=input;
 if(!movimentoOriginalId||typeof motivo!=="string"||motivo.trim().length<10||
    motivo.trim().length>500)fail("M4B2_MOTIVO_ESTORNO_OBRIGATORIO");
 const m=motivo.trim(),fingerprint=digest({
  version:2,tipo:"ESTORNO",movimentoOriginalId,motivo:m,
  confirmouDevolucaoExterna,devolucaoConciliacaoId
 });
 return prisma.$transaction(async tx=>{
  await lockedContext(tx,x);
  const prev=await replay(tx,x,"ESTORNO",fingerprint);
  if(prev)return outcome(prev,await ledger(tx,x),true);
  const saldo=await ledger(tx,x);
  const original=await tx.creditoClienteMovimento.findFirst({where:{
   id:movimentoOriginalId,organizacaoId:x.organizacaoId,
   empresaId:x.empresaId,clienteId:x.clienteId
  }});
  if(!original||!["ENTRADA","UTILIZACAO"].includes(original.tipo)||
     !original.solicitacaoFingerprint)
   fail("M4B2_ORIGINAL_NAO_ESTORNAVEL");
  if(original.tipo==="ENTRADA"&&confirmouDevolucaoExterna!==true)
   fail("M4B2_DEVOLUCAO_EXTERNA_NAO_CONFIRMADA");
  if(await tx.creditoClienteMovimento.count({where:{reverteMovimentoId:original.id}}))
   fail("M4B2_ESTORNO_JA_EXISTENTE");
  const amount=valorCreditoCentavos(original.valor);
  const after=saldo+(original.tipo==="ENTRADA"?-amount:amount);
  if(after<0)fail("M4B2_ESTORNO_SALDO_INSUFICIENTE");
  if(!Number.isSafeInteger(after)||after>999999999999)fail("M4B2_SALDO_INVALIDO");
  if(original.tipo==="UTILIZACAO"&&devolucaoConciliacaoId)
   fail("M4B3_DEVOLUCAO_NAO_SE_APLICA_A_DEBITO");
  // Only an existing, reconciled outgoing financial payment can account
  // for the return of a previous prepaid deposit. No new payment is made.
  const refund=original.tipo==="ENTRADA"?
   await obterConciliacaoDevolucaoContabil(tx,{
    devolucaoConciliacaoId,organizacaoId:x.organizacaoId,empresaId:x.empresaId,
    clienteId:x.clienteId,valorCentavos:amount
   }):null;
  if(refund&&await tx.creditoClienteMovimento.count({
   where:{devolucaoConciliacaoId:refund.devolucaoConciliacaoId}
  }))fail("M4B3_DEVOLUCAO_JA_UTILIZADA");
  const created=await tx.creditoClienteMovimento.create({data:{
   organizacaoId:x.organizacaoId,empresaId:x.empresaId,clienteId:x.clienteId,
   tipo:"ESTORNO",valor:(amount/100).toFixed(2),
   reverteMovimentoId:original.id,
   devolucaoConciliacaoId:refund?.devolucaoConciliacaoId||null,
   motivo:m,responsavelId:x.usuarioId,
   idempotencia:key(x,"ESTORNO"),solicitacaoFingerprint:fingerprint,
   evidencia:{tipo:"ESTORNO_CAUSAL_CI",originalId:original.id,
    originalTipo:original.tipo,semDevolucaoBancaria:true,
    devolucaoExternaDeclarada:original.tipo==="ENTRADA"&&confirmouDevolucaoExterna===true,
    ...refund,semPagamento:true}
  }});
  await event(tx,x,"CREDITO_CLIENTE_ESTORNO_CAUSAL_CI",created,{
   reverteMovimentoId:original.id,motivo:m,valorCentavos:amount,
   devolucaoConciliacaoId:refund?.devolucaoConciliacaoId||null,
   saldoAntesCentavos:saldo,saldoDepoisCentavos:after
  });
  if(simularFalhaAposLancamento)fail("M4B2_FALHA_SIMULADA_TRANSACAO");
  return outcome(created,after,false);
 },transOpts);
}
