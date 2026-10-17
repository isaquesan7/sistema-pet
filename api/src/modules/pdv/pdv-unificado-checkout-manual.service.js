/**
 * Checkout de gestão, 100% MANUAL. Somente o operador declara dinheiro/Pix/
 * cartões/transferência recebidos fora do PointVet. Não chama fiscal, TEF,
 * PSP, bancos, balança ou leitores. Falha fechado sem a variável explícita,
 * allowlists de organização e de CNPJs (empresa) e preferência da organização.
 *
 * Reutiliza os núcleos M.2/M.3 na MESMA transação SERIALIZABLE. Uma falha em
 * qualquer etapa não deixa declarações, vendas-filhas nem baixa parcial.
 */
import prisma from "../../config/prisma.js";
import {consultarReservaFechamento} from "./pdv-unificado.service.js";
import {conferirRecebimentosManuais} from "./pdv-unificado-recebimento-manual.contract.js";
import {executarComRetrySerializableM540} from "./pdv-unificado-fechamento-manual.contract.js";
import {registrarRecebimentoManualEmTransacao} from "./pdv-unificado-registro-manual-sandbox.service.js";
import {criarVendasFilhasEmTransacao} from "./pdv-unificado-venda-sandbox.service.js";
import {efetivarRecebimentosManuaisEmTransacao} from "./pdv-unificado-fechamento-manual-sandbox.service.js";
import {estornarFechamentoManualEmTransacao} from "./pdv-unificado-estorno-manual-sandbox.service.js";
import {checkoutManualHabilitado,empresaManualAutorizada} from "./pdv-unificado-checkout-manual.gate.js";
export {checkoutManualHabilitado} from "./pdv-unificado-checkout-manual.gate.js";

export async function fecharVendaManualUnificada({
 organizacao,organizacaoId,usuarioId,empresaId,id,dados
}){
 if(!checkoutManualHabilitado(organizacao,empresaId)||organizacao?.id!==organizacaoId)
  throw Error("CHECKOUT_MANUAL_DESATIVADO");
 const versao=dados?.versao;
 const contexto={organizacaoId,usuarioId,empresaId,id,versao};
 return executarComRetrySerializableM540(()=>prisma.$transaction(async tx=>{
  // A preferência pode ter sido revogada depois da autenticação HTTP.
  const configAtual=await tx.configuracaoOrganizacao.findUnique({
   where:{organizacaoId},select:{pdvUnificadoHabilitado:true}
  });
  if(!checkoutManualHabilitado({id:organizacaoId,configuracao:configAtual},empresaId))
   throw Error("CHECKOUT_MANUAL_DESATIVADO");
  // Mesma comanda: serializar registro, venda, pagamentos e replay.
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${id} FOR UPDATE`;
  const reserva=await consultarReservaFechamento(contexto,tx);
  if(!reserva||reserva.status!=="RESERVADA")throw Error("RESERVA_NAO_EDITAVEL");
  if(reserva.operacoes.some(op=>!empresaManualAutorizada(op.empresaId)))
   throw Error("EMPRESA_FORA_DO_PILOTO_MANUAL");
  const preparacao=await tx.criacaoPreparacaoUnificada.findUnique({where:{reservaId:reserva.id}});
  if(!preparacao||preparacao.status!=="PREPARADA")throw Error("PREPARACAO_INDISPONIVEL");
  const validado=conferirRecebimentosManuais({
   dados,snapshot:preparacao.snapshot,organizacaoId,reservaId:reserva.id
  });
  if(!validado.prontoParaPersistirEmTransacao)throw Error("RECEBIMENTO_NAO_CONFIRMADO");
  const operacoes=await tx.reservaOperacaoUnificada.findMany({where:{reservaId:reserva.id}});
  const todosConcluidos=operacoes.length===reserva.operacoes.length&&
   operacoes.every(op=>op.status==="CONCLUIDA"&&op.vendaId);
  let registroId;
  if(todosConcluidos){
   const registrado=await tx.registroRecebimentoManualUnificado.findUnique({
    where:{reservaId:reserva.id},select:{id:true,fingerprint:true}
   });
   if(!registrado||registrado.fingerprint!==validado.fingerprint)
    throw Error("REGISTRO_MANUAL_DIVERGENTE");
   registroId=registrado.id;
  }else{
   if(operacoes.length!==reserva.operacoes.length||
      operacoes.some(op=>op.status!=="RESERVADA"||op.vendaId))
    throw Error("M3_ESTADO_PARCIAL_REQUER_REVISAO");
   const registro=await registrarRecebimentoManualEmTransacao(tx,{
    organizacaoId,usuarioId,empresaId,id,dados
   });
   registroId=registro.id;
   await criarVendasFilhasEmTransacao(tx,{...contexto,contextoExecucao:"GESTAO_MANUAL"});
  }
  const final=await efetivarRecebimentosManuaisEmTransacao(tx,{
   ...contexto,contextoExecucao:"GESTAO_MANUAL"
  });
  return {...final,registroId,execucaoRealHabilitada:true,
   emissaoFiscal:false,recebimento:"DECLARADO_PELO_ATENDENTE",
   mensagem:"Venda de gestão registrada. O PointVet não emitiu documento fiscal nem processou pagamentos."};
 },{isolationLevel:"Serializable",maxWait:10000,timeout:30000}));
}

/** Estorno TOTAL de gestão. A devolução externa é declarada pelo operador;
 * PointVet não efetua refund bancário, fiscal ou TEF. O núcleo M.3C reverte
 * vendas, pagamentos, caixa e movimentos de lote atomicamente. */
export async function estornarVendaManualUnificada({
 organizacao,organizacaoId,usuarioId,empresaId,id,dados
}){
 if(!checkoutManualHabilitado(organizacao,empresaId)||organizacao?.id!==organizacaoId)
  throw Error("CHECKOUT_MANUAL_DESATIVADO");
 return executarComRetrySerializableM540(()=>prisma.$transaction(async tx=>{
  const configAtual=await tx.configuracaoOrganizacao.findUnique({
   where:{organizacaoId},select:{pdvUnificadoHabilitado:true}
  });
  if(!checkoutManualHabilitado({id:organizacaoId,configuracao:configAtual},empresaId))
   throw Error("CHECKOUT_MANUAL_DESATIVADO");
  const reserva=await consultarReservaFechamento({
   organizacaoId,usuarioId,empresaId,id,versao:dados.versao
  },tx);
  if(!reserva)throw Error("M3C_RESERVA_AUSENTE");
  if(reserva.operacoes.some(op=>!empresaManualAutorizada(op.empresaId)))
   throw Error("EMPRESA_FORA_DO_PILOTO_MANUAL");
  const retorno=await estornarFechamentoManualEmTransacao(tx,{
   organizacaoId,usuarioId,empresaId,id,versao:dados.versao,dados,
   contextoExecucao:"GESTAO_MANUAL"
  });
  return {...retorno,execucaoRealHabilitada:true,
   devolucao:"DECLARADA_PELO_ATENDENTE",
   mensagem:"Estorno integral registrado. A devolução externa foi declarada; PointVet não transferiu valores nem emitiu documento fiscal."};
 },{isolationLevel:"Serializable",maxWait:10000,timeout:30000}));
}
