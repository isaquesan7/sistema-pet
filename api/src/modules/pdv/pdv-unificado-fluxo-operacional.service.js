/**
 * PointVet M.5.16 — read-only company/card repasse operational stages.
 * M.5.7 checks PDV+FINANCEIRO, org opt-in, tenant, active role and user.
 * A stage describes INTERNAL declarations, never a verified bank transfer.
 */
import prisma from "../../config/prisma.js";
import {consultarRecebiveisCartaoLeituraM57} from "./pdv-unificado-recebiveis-leitura.service.js";
import {projetarEtapasRepassesM516} from "./pdv-unificado-fluxo-operacional.contract.js";
export async function consultarEtapasRepassesM516({organizacaoId,empresaId,
 usuarioId,comandaId}={}){
 // Strict pre-authorization and validation from the existing M.5.7 service.
 await consultarRecebiveisCartaoLeituraM57({
  organizacaoId,empresaId,usuarioId,comandaId
 });
 return prisma.$transaction(tx=>projetarEtapasRepassesEmTransacaoM516(tx,{
  organizacaoId,empresaId,comandaId
 }),{isolationLevel:"RepeatableRead",maxWait:8000,timeout:12000});
}
// Internal projection only: caller must authorize M.5.7 in this same tx.
export async function projetarEtapasRepassesEmTransacaoM516(tx,{
 organizacaoId,empresaId,comandaId
}={}){
  const preparacoes=await tx.preparacaoBaixaCartaoManualUnificada.findMany({
   where:{organizacaoId,empresaId,comandaId},
   select:{id:true,organizacaoId:true,empresaId:true,comandaId:true,
    usuarioId:true,contaFinanceiraId:true,referenciaExtrato:true,
    fingerprint:true,dataCredito:true,tipo:true,status:true,
    bruto:true,tarifaCartao:true,descontoAntecipacao:true,
    liquidoDeclarado:true,
    parecerDocumental:{select:{preparacaoId:true,organizacaoId:true,
     empresaId:true,conferenteId:true,status:true,fingerprint:true}}},
   orderBy:[{createdAt:"desc"},{id:"desc"}],take:51
  });
  if(preparacoes.length>50)throw Error("M516_LIMITE_EXCEDIDO");
  if(!preparacoes.length)return projetarEtapasRepassesM516({
   organizacaoId,empresaId,comandaId,preparacoes:[],entradas:[],correcoes:[]
  });
  const entradas=await tx.conciliacaoFinanceira.findMany({where:{
   empresaId,origem:"REPASSE_CARTAO_MANUAL_UNIFICADO",
   origemId:{in:preparacoes.map(p=>p.id)}
  },select:{id:true,origemId:true,empresaId:true,contaFinanceiraId:true,
   origem:true,direcao:true,valor:true,usuarioId:true}});
  const correcoes=entradas.length?await tx.conciliacaoFinanceira.findMany({
   where:{empresaId,origem:"ESTORNO_REPASSE_CARTAO_MANUAL_UNIFICADO",
    origemId:{in:entradas.map(e=>e.id)}},
   select:{id:true,origemId:true,empresaId:true,contaFinanceiraId:true,
    origem:true,direcao:true,valor:true,usuarioId:true}
  }):[];
  const convert=p=>({...p,
   bruto:String(p.bruto),tarifaCartao:String(p.tarifaCartao),
   descontoAntecipacao:String(p.descontoAntecipacao),
   liquidoDeclarado:String(p.liquidoDeclarado),
   dataCredito:p.dataCredito.toISOString().slice(0,10)
  });
  return projetarEtapasRepassesM516({
   organizacaoId,empresaId,comandaId,
   preparacoes:preparacoes.map(convert),
   entradas:entradas.map(x=>({...x,valor:String(x.valor)})),
   correcoes:correcoes.map(x=>({...x,valor:String(x.valor)}))
  });
}
