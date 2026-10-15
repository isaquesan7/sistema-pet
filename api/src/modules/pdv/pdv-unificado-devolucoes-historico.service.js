/**
 * PointVet M.5.23 — authorized READ-ONLY statements of customer refunds.
 * M.5.7 pre-authorizes active tenant, org opt-in, PDV & Financeiro permission;
 * RepeatableRead projects an auditable, bounded history with no write endpoints.
 */
import prisma from "../../config/prisma.js";
import {consultarRecebiveisCartaoLeituraM57}
 from "./pdv-unificado-recebiveis-leitura.service.js";
import {projetarHistoricoDevolucoesM523}
 from "./pdv-unificado-devolucoes-historico.contract.js";
export async function consultarHistoricoDevolucoesM523({
 organizacaoId,empresaId,usuarioId,comandaId
}={}){
 await consultarRecebiveisCartaoLeituraM57({
  organizacaoId,empresaId,usuarioId,comandaId
 });
 return prisma.$transaction(async tx=>{
  const preparacoes=await tx.preparacaoBaixaCartaoManualUnificada.findMany({
   where:{organizacaoId,empresaId,comandaId},
   select:{id:true,organizacaoId:true,empresaId:true,comandaId:true,
    status:true,fingerprint:true,contaFinanceiraId:true,
    referenciaExtrato:true,bruto:true,liquidoDeclarado:true,
    parecerDocumental:{select:{preparacaoId:true,organizacaoId:true,
     empresaId:true,status:true,fingerprint:true}}},take:51,
   orderBy:[{createdAt:"asc"},{id:"asc"}]
  });
  if(preparacoes.length>50)throw Error("M523_LIMITE_PREPARACOES");
  const prepIds=preparacoes.map(p=>p.id);
  if(!prepIds.length)return projetarHistoricoDevolucoesM523({
   organizacaoId,empresaId,comandaId
  });
  const devolucoes=await tx.devolucaoClienteManualUnificada.findMany({
   where:{organizacaoId,empresaId,comandaId,
    preparacaoId:{in:prepIds}},
   select:{id:true,organizacaoId:true,empresaId:true,comandaId:true,
    preparacaoId:true,conciliacaoOrigemId:true,usuarioId:true,
    referenciaExterna:true,valorBruto:true,motivo:true,
    confirmacaoHumanaExterna:true,codigoRevisao:true,
    fingerprint:true,snapshot:true,createdAt:true},
   orderBy:[{createdAt:"asc"},{id:"asc"}],take:501
  });
  if(devolucoes.length>500)throw Error("M523_LIMITE_DECLARACOES");
  const entradas=await tx.conciliacaoFinanceira.findMany({
   where:{empresaId,origem:"REPASSE_CARTAO_MANUAL_UNIFICADO",
    origemId:{in:prepIds}},
   select:{id:true,empresaId:true,origem:true,origemId:true,
    direcao:true,valor:true,usuarioId:true,contaFinanceiraId:true}
  });
  const correcoes=entradas.length?await tx.conciliacaoFinanceira.findMany({
   where:{empresaId,origem:"ESTORNO_REPASSE_CARTAO_MANUAL_UNIFICADO",
    origemId:{in:entradas.map(e=>e.id)}},
   select:{id:true,empresaId:true,origem:true,origemId:true,direcao:true}
  }):[];
  const auditorias=devolucoes.length?await tx.auditoria.findMany({
   where:{organizacaoId,empresaId,
    entidade:"DEVOLUCAO_CLIENTE_MANUAL",
    acao:"DEVOLUCAO_EXTERNA_DECLARADA_CI",
    entidadeId:{in:devolucoes.map(d=>d.id)}},
   select:{organizacaoId:true,empresaId:true,
    entidade:true,entidadeId:true,acao:true,
    usuarioId:true,dadosNovos:true},take:501
  }):[];
  return projetarHistoricoDevolucoesM523({
   organizacaoId,empresaId,comandaId,
   preparacoes:preparacoes.map(p=>({
    ...p,bruto:String(p.bruto),liquidoDeclarado:String(p.liquidoDeclarado)
   })),
   devolucoes:devolucoes.map(d=>({...d,valorBruto:String(d.valorBruto)})),
   entradas:entradas.map(e=>({...e,valor:String(e.valor)})),
   correcoes,auditorias
  });
 },{isolationLevel:"RepeatableRead",maxWait:8000,timeout:12000});
}
