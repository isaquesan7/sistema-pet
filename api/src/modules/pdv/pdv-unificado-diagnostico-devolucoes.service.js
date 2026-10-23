/**
 * PointVet M.5.24 — READ-ONLY evidence/fiscal gap diagnostic from already
 * authorized M.5.16/M.5.23 projections within ONE RepeatableRead snapshot.
 * Cross-source mismatches return 409; never authorizes settlement/refund.
 */
import prisma from "../../config/prisma.js";
import {consultarRecebiveisCartaoEmTransacaoM57}
 from "./pdv-unificado-recebiveis-leitura.service.js";
import {projetarEtapasRepassesEmTransacaoM516}
 from "./pdv-unificado-fluxo-operacional.service.js";
import {projetarHistoricoDevolucoesEmTransacaoM523}
 from "./pdv-unificado-devolucoes-historico.service.js";
import {diagnosticarDivergenciasDevolucoesM524}
 from "./pdv-unificado-diagnostico-devolucoes.contract.js";
/** Reusable authorized source snapshot; caller MUST hold the same transaction. */
export async function reunirFontesConferenciaDevolucoesEmTransacaoM524(tx,{
 organizacaoId,empresaId,usuarioId,comandaId
}={}){
 await consultarRecebiveisCartaoEmTransacaoM57(tx,{
  organizacaoId,empresaId,usuarioId,comandaId
 });
 const fluxo=await projetarEtapasRepassesEmTransacaoM516(tx,{
  organizacaoId,empresaId,comandaId
 });
 const historico=await projetarHistoricoDevolucoesEmTransacaoM523(tx,{
  organizacaoId,empresaId,comandaId
 });
 const diagnostico=diagnosticarDivergenciasDevolucoesM524({
  organizacaoId,empresaId,comandaId,fluxo,historico
 });
 return {diagnostico,historico};
}
export async function consultarDiagnosticoDevolucoesM524(contexto={}){
 // M.5.25: authorization and both sources MUST stay on ONE RepeatableRead
 // snapshot. The wrapper remains the public service entry point.
 return prisma.$transaction(async tx=>
  (await reunirFontesConferenciaDevolucoesEmTransacaoM524(tx,contexto)).diagnostico,
 {isolationLevel:"RepeatableRead",maxWait:8000,timeout:20000});
}
