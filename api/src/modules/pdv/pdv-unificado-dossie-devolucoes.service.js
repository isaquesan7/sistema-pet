/**
 * PointVet M.5.27 — authorized, snapshot-consistent documentary dossier.
 * There is no write path; the returned checklist cannot authorize refunds.
 */
import prisma from "../../config/prisma.js";
import {reunirFontesConferenciaDevolucoesEmTransacaoM524}
 from "./pdv-unificado-diagnostico-devolucoes.service.js";
import {montarDossieDevolucoesM527}
 from "./pdv-unificado-dossie-devolucoes.contract.js";

export async function consultarDossieDevolucoesM527(contexto={}){
 return prisma.$transaction(async tx=>{
  const {diagnostico,historico}=
   await reunirFontesConferenciaDevolucoesEmTransacaoM524(tx,contexto);
  return montarDossieDevolucoesM527({diagnostico,historico});
 },{isolationLevel:"RepeatableRead",maxWait:8000,timeout:20000});
}
