/**
 * PointVet M.2 — registro durável de DECLARAÇÕES MANUAIS, somente sandbox CI.
 *
 * Não escreve nas tabelas Pagamento, Venda, MovimentacaoCaixa, Estoque ou Fiscal.
 * Não é um checkout. O operador declara o recebimento fora do PointVet;
 * a baixa financeira idempotente e o estorno exigem homologação M.3/M.4.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {consultarReservaFechamento,planejarFechamento} from "./pdv-unificado.service.js";
import {conferirAlocacaoFechamento} from "./pdv-unificado-preparacao.service.js";
import {conferirRecebimentosManuais} from "./pdv-unificado-recebimento-manual.contract.js";

const BANCO_CI="pointvet_unified_ci";
function cents(v){
 const value=Math.round(Number(v)*100);
 if(!Number.isSafeInteger(value)||value<0)throw Error("VALOR_DIVERGENTE");
 return value;
}
function toDecimal(centavos){
 return `${Math.floor(centavos/100)}.${String(centavos%100).padStart(2,"0")}`;
}
function toResult(registro,reutilizada){
 return {
  id:registro.id,reservaId:registro.reservaId,
  criadoPorId:registro.criadoPorId,criadoEm:registro.createdAt,
  status:registro.status,fingerprint:registro.fingerprint,reutilizada,
  linhas:registro.linhas.map(line=>({
   id:line.id,operacaoId:line.operacaoId,empresaId:line.operacao.empresaId,
   indice:line.indice,sessaoCaixaId:line.sessaoCaixaId,
   forma:line.forma,valor:String(line.valor),
   parcelas:line.parcelas,referencia:line.referencia,
   confirmadoEm:line.confirmadoEm
  })).sort((a,b)=>a.empresaId.localeCompare(b.empresaId)||a.indice-b.indice),
  prontoParaFechamentoReal:false,gerouPagamento:false,gerouMovimentoCaixa:false,
  gerouBaixaEstoque:false,gerouNotaFiscal:false,
  mensagem:"Declaração manual auditável registrada; fechamento financeiro real permanece desabilitado."
 };
}
async function guardarEscopo(tx,{organizacaoId,usuarioId,empresaId,id,versao}){
 await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${id} FOR UPDATE`;
 const comanda=await tx.comanda.findFirst({
  where:{id,rascunhoUnificado:true,cliente:{organizacaoId}},
  select:{id:true,clienteId:true,versaoRascunho:true,status:true}
 });
 if(!comanda)throw Error("RASCUNHO_NAO_ENCONTRADO");
 if(comanda.status!=="ABERTA"||comanda.versaoRascunho!==versao)throw Error("RASCUNHO_DESATUALIZADO");
 const reserva=await consultarReservaFechamento({organizacaoId,usuarioId,empresaId,id,versao},tx);
 if(!reserva||reserva.status!=="RESERVADA")throw Error("RESERVA_NAO_EDITAVEL");
 const preparacao=await tx.criacaoPreparacaoUnificada.findUnique({where:{reservaId:reserva.id}});
 if(!preparacao||preparacao.status!=="PREPARADA")throw Error("PREPARACAO_INDISPONIVEL");
 if(preparacao.snapshot.comandaId!==id||
  preparacao.snapshot.versaoRascunho!==versao||
  preparacao.snapshot.clienteId!==comanda.clienteId||
  preparacao.snapshot.operacoes?.length!==reserva.operacoes.length)throw Error("PREPARACAO_DIVERGENTE");
 return {reserva,preparacao,comanda};
}

/**
 * Save immutable per-company cashier declarations. A replay with identical
 * content returns the same record and IDs. Conflicting edits are rejected;
 * correction will require a future audited cancellation/reversal workflow.
 */
export async function registrarRecebimentoManualSomenteSandbox({
 organizacaoId,usuarioId,empresaId,id,dados
}){
 exigirBancoIsolado();
 return prisma.$transaction(async tx=>{
  const row=await tx.$queryRaw`SELECT current_database() AS nome`;
  if(row[0]?.nome!==BANCO_CI)throw Error("BANCO_NAO_ISOLADO");
  return registrarRecebimentoManualEmTransacao(tx,{organizacaoId,usuarioId,empresaId,id,dados});
 },{isolationLevel:"Serializable",maxWait:5000,timeout:15000});
}
/** Parte transacional reutilizável; controle de acesso/ativação no orquestrador.
 * Não exportar por HTTP diretamente.
 */
export async function registrarRecebimentoManualEmTransacao(tx,{
 organizacaoId,usuarioId,empresaId,id,dados
}){
  const versao=dados?.versao;
  const {reserva,preparacao}=await guardarEscopo(tx,{organizacaoId,usuarioId,empresaId,id,versao});
  const conferido=conferirRecebimentosManuais({
   dados,snapshot:preparacao.snapshot,organizacaoId,reservaId:reserva.id
  });
  if(conferido.pendencias.length||!conferido.prontoParaPersistirEmTransacao)
   throw Error("RECEBIMENTO_NAO_CONFIRMADO");
  const existing=await tx.registroRecebimentoManualUnificado.findUnique({
   where:{reservaId:reserva.id},include:{linhas:{include:{operacao:{select:{empresaId:true}}}}}
  });
  if(existing){
   if(existing.fingerprint!==conferido.fingerprint)throw Error("REGISTRO_MANUAL_DIVERGENTE");
   return toResult(existing,true);
  }
  // Revalidate catalog, pet, prices and operator access just before writing.
  const plano=await planejarFechamento({organizacaoId,usuarioId,empresaId,id,versao},tx);
  if(plano.operacoes.length!==reserva.operacoes.length||
   cents(plano.total)!==cents(reserva.total)||
   plano.operacoes.some(o=>!reserva.operacoes.some(r=>
    r.empresaId===o.empresaId&&r.chaveIdempotencia===o.chaveIdempotencia&&
    cents(r.valor)===cents(o.total))))throw Error("PLANO_DIVERGENTE");
  const conf=await conferirAlocacaoFechamento({
   organizacaoId,usuarioId,empresaId,id,dados:{
    versao,alocacoes:conferido.movimentos.map(m=>({
     empresaId:m.empresaId,sessaoCaixaId:m.sessaoCaixaId,
     pagamentos:m.pagamentos.map(p=>({forma:p.forma,valorCentavos:p.valorCentavos}))
    }))
   }
  },tx);
  if(!conf.preConferenciaAprovada)throw Error("CAIXA_OU_VALOR_INVALIDO");
  const operacoes=await tx.reservaOperacaoUnificada.findMany({where:{reservaId:reserva.id}});
  const byCompany=new Map(operacoes.map(o=>[o.empresaId,o]));
  if(operacoes.length!==conferido.movimentos.length||
    operacoes.some(o=>o.status!=="RESERVADA"||o.vendaId))throw Error("RESERVA_NAO_EDITAVEL");
  const linhas=[];
  for(const empresa of conferido.movimentos){
   const operation=byCompany.get(empresa.empresaId);
   if(!operation||cents(operation.valorTotal)!==empresa.totalCentavos||
     !preparacao.snapshot.operacoes.some(o=>o.empresaId===empresa.empresaId&&o.cnpj===empresa.cnpj))
     throw Error("PLANO_DIVERGENTE");
   for(const [indice,p] of empresa.pagamentos.entries()){
    if(!p.confirmadoPeloAtendente)throw Error("RECEBIMENTO_NAO_CONFIRMADO");
    linhas.push({
     operacaoId:operation.id,indice,sessaoCaixaId:empresa.sessaoCaixaId,
     forma:p.forma,valor:toDecimal(p.valorCentavos),parcelas:p.parcelas,
     referencia:p.referencia||null
    });
   }
  }
  const registro=await tx.registroRecebimentoManualUnificado.create({
   data:{reservaId:reserva.id,criadoPorId:usuarioId,fingerprint:conferido.fingerprint}
  });
  await tx.linhaRecebimentoManualUnificado.createMany({
   data:linhas.map(line=>({...line,registroId:registro.id}))
  });
  const persisted=await tx.registroRecebimentoManualUnificado.findUnique({
   where:{id:registro.id},include:{linhas:{include:{operacao:{select:{empresaId:true}}}}}
  });
  return toResult(persisted,false);
}
/** Read requires access to all represented companies; never leaks cross-tenant data. */
export async function consultarRecebimentoManualSomenteSandbox({
 organizacaoId,usuarioId,empresaId,id,versao
}){
 exigirBancoIsolado();
 const reserva=await consultarReservaFechamento({organizacaoId,usuarioId,empresaId,id,versao});
 if(!reserva)throw Error("RESERVA_NAO_ENCONTRADA");
 const registro=await prisma.registroRecebimentoManualUnificado.findUnique({
  where:{reservaId:reserva.id},include:{linhas:{include:{operacao:{select:{empresaId:true}}}}}
 });
 return registro?toResult(registro,true):null;
}
