/**
 * PointVet M.5.14 — read-only posting history for one company's comanda.
 * Uses M.5.7 authorization and opt-in; does not allow reversals or payments.
 */
import prisma from "../../config/prisma.js";
import {consultarRecebiveisCartaoLeituraM57} from "./pdv-unificado-recebiveis-leitura.service.js";
const money=v=>{const [a,b=""]=String(v).split(".");return a+"."+b.padEnd(2,"0");};
export async function listarHistoricoRepasseCartaoM514({
 organizacaoId,empresaId,usuarioId,comandaId
}={}){
 // Reuse M.5.7's full authenticated financial permission, tenant,
 // organizational opt-in and underlying card-receivable integrity gates.
 await consultarRecebiveisCartaoLeituraM57({
  organizacaoId,empresaId,usuarioId,comandaId
 });
 return prisma.$transaction(async tx=>{
  const preps=await tx.preparacaoBaixaCartaoManualUnificada.findMany({where:{
   organizacaoId,empresaId,comandaId
  },select:{id:true,createdAt:true},orderBy:{createdAt:"desc"},take:50});
  if(!preps.length)return [];
  const originals=await tx.conciliacaoFinanceira.findMany({where:{
   empresaId,origem:"REPASSE_CARTAO_MANUAL_UNIFICADO",
   origemId:{in:preps.map(p=>p.id)}
  },select:{id:true,origemId:true,valor:true,dataMovimento:true,
   direcao:true,contaFinanceira:{select:{nome:true}},
   usuario:{select:{nome:true}}}});
  const reversals=originals.length?await tx.conciliacaoFinanceira.findMany({where:{
   empresaId,origem:"ESTORNO_REPASSE_CARTAO_MANUAL_UNIFICADO",
   origemId:{in:originals.map(r=>r.id)}
  },select:{id:true,origemId:true,valor:true,dataMovimento:true,
   direcao:true,contaFinanceira:{select:{nome:true}},
   usuario:{select:{nome:true}}}}):[];
  return [...originals.map(p=>({
   id:p.id,preparacaoId:p.origemId,tipo:"REPASSE_CONFIRMADO_MANUALMENTE",
   valor:money(p.valor),direcao:p.direcao,data:p.dataMovimento,
   conta:p.contaFinanceira?.nome||"Conta da empresa",
   operador:p.usuario?.nome||"Funcionário autorizado",
   possuiCorrecao:reversals.some(r=>r.origemId===p.id)
  })),...reversals.map(r=>({
   id:r.id,preparacaoId:originals.find(x=>x.id===r.origemId)?.origemId,
   tipo:"CORRECAO_MANUAL",valor:money(r.valor),direcao:r.direcao,
   data:r.dataMovimento,conta:r.contaFinanceira?.nome||"Conta da empresa",
   operador:r.usuario?.nome||"Funcionário autorizado",
   possuiCorrecao:false
  }))].sort((a,b)=>new Date(b.data)-new Date(a.data));
 },{isolationLevel:"RepeatableRead",maxWait:8000,timeout:12000});
}
