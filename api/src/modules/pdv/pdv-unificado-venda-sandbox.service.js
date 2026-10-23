/**
 * Fase 20.2.4A — EXCLUSIVAMENTE sandbox PostgreSQL descartável.
 *
 * Cria vendas-filhas ABERTAS (sem efeito econômico) para validar arquitetura
 * transacional, FK, idempotência, estado e rollback multiempresa. Não exportar
 * por HTTP. NÃO gera pagamentos, baixa estoque, fiscal, crédito ou eventos.
 *
 * Trava tripla: NODE_ENV=test + variável explícita + nome real do banco CI.
 * Não é um mecanismo de ativação de checkout em produção.
 */
import prisma from "../../config/prisma.js";
import {planejarFechamento,consultarReservaFechamento} from "./pdv-unificado.service.js";
import {conferirAlocacaoFechamento} from "./pdv-unificado-preparacao.service.js";

const DATABASE_ISOLATED="pointvet_unified_ci";
export function exigirBancoIsolado(){
 if(process.env.NODE_ENV!=="test"||
    process.env.POINTVET_UNIFIED_SALES_SANDBOX!=="1")throw Error("EXECUCAO_SANDBOX_DESABILITADA");
 const url=process.env.DATABASE_URL;
 if(!url)throw Error("EXECUCAO_SANDBOX_DESABILITADA");
 let dbName;
 try{dbName=decodeURIComponent(new URL(url).pathname.slice(1));}
 catch{throw Error("EXECUCAO_SANDBOX_DESABILITADA");}
 if(dbName!==DATABASE_ISOLATED)throw Error("BANCO_NAO_ISOLADO");
}
function cents(amount){
 const n=Math.round(Number(amount)*100);
 if(!Number.isSafeInteger(n)||n<0)throw Error("VALOR_INVALIDO");
 return n;
}
function resposta(ops,reutilizada=false){
 return {tipo:"VENDA_ABERTA_SANDBOX",reutilizada,execucaoRealHabilitada:false,
  vendas:ops.map(o=>({empresaId:o.empresaId,vendaId:o.vendaId,estado:o.status})),
  pagamentosCriados:false,estoqueMovimentado:false,fiscalGerado:false};
}
/**
 * Sandbox service with deterministic failure injection for rollback tests.
 * All companies are written in ONE database transaction. Real PSP payments
 * will require separate durable orchestration/outbox and cannot use this API.
 *
 * No HTTP entry point intentionally exists.
 */
export async function criarVendasFilhasSomenteSandbox({
 organizacaoId,usuarioId,empresaId,id,versao,simularFalhaAposEmpresaId=null
}){
 exigirBancoIsolado();
 return prisma.$transaction(async tx=>{
  const actual=await tx.$queryRaw`SELECT current_database() AS nome`;
  if(actual[0]?.nome!==DATABASE_ISOLATED)throw Error("BANCO_NAO_ISOLADO");
  return criarVendasFilhasEmTransacao(tx,{
   organizacaoId,usuarioId,empresaId,id,versao,simularFalhaAposEmpresaId
  });
 },{isolationLevel:"Serializable",maxWait:5000,timeout:18000});
}
/** Núcleo comum: chamar exclusivamente dentro de transação autorizada.
 * A rota HTTP nunca deve importar este módulo; use o orquestrador protegido.
 */
export async function criarVendasFilhasEmTransacao(tx,{
 organizacaoId,usuarioId,empresaId,id,versao,simularFalhaAposEmpresaId=null,
 contextoExecucao="CI"
}){
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${id} FOR UPDATE`;
  const draft=await tx.comanda.findFirst({where:{id,rascunhoUnificado:true,cliente:{organizacaoId}},
   select:{id:true,clienteId:true,versaoRascunho:true,status:true}});
  if(!draft)throw Error("RASCUNHO_NAO_ENCONTRADO");
  if(draft.versaoRascunho!==versao||draft.status!=="ABERTA")throw Error("RASCUNHO_DESATUALIZADO");
  const reservation=await consultarReservaFechamento({organizacaoId,usuarioId,empresaId,id,versao},tx);
  if(!reservation||reservation.status!=="RESERVADA")throw Error("RESERVA_NAO_EDITAVEL");
  const prep=await tx.criacaoPreparacaoUnificada.findUnique({where:{reservaId:reservation.id}});
  if(!prep||prep.status!=="PREPARADA")throw Error("PREPARACAO_INDISPONIVEL");
  const snapshot=prep.snapshot;
  if(snapshot.comandaId!==id||snapshot.versaoRascunho!==versao||snapshot.clienteId!==draft.clienteId)throw Error("SNAPSHOT_INCONSISTENTE");
  const saved=await tx.reservaOperacaoUnificada.findMany({where:{reservaId:reservation.id},orderBy:{empresaId:"asc"}});
  const byCompany=new Map(saved.map(o=>[o.empresaId,o]));
  if(saved.length!==reservation.operacoes.length||snapshot.operacoes.length!==saved.length)throw Error("SNAPSHOT_INCONSISTENTE");
  if(saved.every(op=>op.status==="VENDA_RASCUNHO"&&op.vendaId)){
   const linked=await tx.venda.findMany({where:{id:{in:saved.map(op=>op.vendaId)},comandaId:id,status:"ABERTA"}});
   if(linked.length!==saved.length||
      saved.some(op=>!linked.some(v=>v.id===op.vendaId&&v.empresaId===op.empresaId&&cents(v.valorTotal)===cents(op.valorTotal))))
    throw Error("VENDA_SANDBOX_INCONSISTENTE");
   return resposta(saved,true);
  }
  if(saved.some(op=>op.vendaId||op.status!=="RESERVADA"))throw Error("ESTADO_PARCIAL_REQUER_REVISAO");

  // Rechecks prices, tenant access, pets and company ownership in the same TX.
  const plan=await planejarFechamento({organizacaoId,usuarioId,empresaId,id,versao},tx);
  if(plan.operacoes.length!==saved.length||cents(plan.total)!==cents(reservation.total))throw Error("PLANO_DIVERGENTE");
  const checkAllocations=await conferirAlocacaoFechamento({organizacaoId,usuarioId,empresaId,id,dados:{
   versao,alocacoes:snapshot.operacoes.map(op=>({
    empresaId:op.empresaId,sessaoCaixaId:op.sessaoCaixaId,pagamentos:op.pagamentos
   }))
  }},tx);
  if(!checkAllocations.preConferenciaAprovada)throw Error("CAIXA_OU_ALOCACAO_INVALIDA");
  for(const op of snapshot.operacoes){
   const row=byCompany.get(op.empresaId);
   const current=plan.operacoes.find(p=>p.empresaId===op.empresaId);
   if(!row||!current||row.chaveIdempotencia!==op.chaveIdempotencia||
     current.chaveIdempotencia!==op.chaveIdempotencia||
     cents(current.total)!==cents(op.total)||cents(row.valorTotal)!==cents(op.total)||
     !Array.isArray(op.itens)||!op.itens.length)throw Error("SNAPSHOT_INCONSISTENTE");
   const sum=op.itens.reduce((n,i)=>n+cents(i.valorTotal),0);
   if(sum!==cents(op.total))throw Error("SNAPSHOT_INCONSISTENTE");
  }

  // ABERTA: not a finalized sale, never a receivable or payment.
  for(const op of [...snapshot.operacoes].sort((a,b)=>a.empresaId.localeCompare(b.empresaId))){
   const venda=await tx.venda.create({data:{
    empresaId:op.empresaId,comandaId:id,clienteId:draft.clienteId,
    usuarioId,status:"ABERTA",subtotal:op.total,valorTotal:op.total,
    observacoes:contextoExecucao==="CI"?
     "POINTVET SANDBOX 20.2.4A — SEM PAGAMENTO OU FISCAL":
     "POINTVET GESTAO MANUAL — documento fiscal externo, sem emissao pelo sistema"
   }});
   await tx.vendaItem.createMany({data:op.itens.map(line=>({
    vendaId:venda.id,comandaItemId:line.comandaItemId,
    itemCatalogoId:line.itemCatalogoId,petId:line.petId,
    descricao:line.descricao,quantidade:line.quantidade,
    valorUnitario:line.valorUnitario,desconto:line.desconto,
    valorTotal:line.valorTotal
   }))});
   const update=await tx.reservaOperacaoUnificada.updateMany({
    where:{id:byCompany.get(op.empresaId).id,reservaId:reservation.id,status:"RESERVADA",vendaId:null},
    data:{vendaId:venda.id,status:"VENDA_RASCUNHO"}
   });
   if(update.count!==1)throw Error("OPERACAO_CONCORRENTE");
   if(simularFalhaAposEmpresaId===op.empresaId)throw Error("FALHA_SIMULADA_TRANSACAO");
  }
  const completed=await tx.reservaOperacaoUnificada.findMany({where:{reservaId:reservation.id},orderBy:{empresaId:"asc"}});
  return resposta(completed);
}
