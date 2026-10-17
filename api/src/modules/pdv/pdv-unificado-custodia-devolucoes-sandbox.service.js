/**
 * PointVet M.5.29 — CI ONLY read-only custody policy preflight.
 * No public route, evidence upload, legal policy approval or production worker.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {reunirFontesConferenciaDevolucoesEmTransacaoM524}
 from "./pdv-unificado-diagnostico-devolucoes.service.js";
import {montarDossieDevolucoesM527}
 from "./pdv-unificado-dossie-devolucoes.contract.js";
import {planejarCustodiaDevolucoesM529}
 from "./pdv-unificado-custodia-devolucoes.contract.js";

const fail=code=>{throw Error("M529_"+code);};

export async function consultarPlanoCustodiaDevolucoesSomenteSandbox(contexto={}){
 exigirBancoIsolado();
 return prisma.$transaction(async tx=>{
  const db=await tx.$queryRaw`SELECT current_database() AS nome`;
  if(db[0]?.nome!=="pointvet_unified_ci")fail("BANCO_NAO_ISOLADO");
  // M.5.24 checks opt-in, company/organization and financeiro.gerenciar in
  // the same RepeatableRead snapshot used to rebuild the M.5.27 dossier.
  const {diagnostico,historico}=
   await reunirFontesConferenciaDevolucoesEmTransacaoM524(tx,contexto);
  const dossie=montarDossieDevolucoesM527({diagnostico,historico});
  const pareceres=await tx.parecerDevolucaoExternaCi.findMany({where:{
   organizacaoId:dossie.organizacaoId,empresaId:dossie.empresaId,
   comandaId:dossie.comandaId
  },select:{id:true,organizacaoId:true,empresaId:true,comandaId:true,
   devolucaoId:true,conferenteId:true,codigoDossie:true,fingerprint:true,
   status:true}});
  if(pareceres.length){
   const logs=await tx.auditoria.findMany({where:{
    organizacaoId:dossie.organizacaoId,empresaId:dossie.empresaId,
    entidade:"PARECER_DEVOLUCAO_EXTERNA_CI",
    acao:"DEVOLUCAO_DOCUMENTAL_CONFERIDA_CI",
    entidadeId:{in:pareceres.map(p=>p.id)}
   },select:{entidadeId:true,usuarioId:true,dadosNovos:true}});
   if(logs.length!==pareceres.length)fail("AUDITORIA_AUSENTE");
   const byId=new Map();
   for(const log of logs){
    if(byId.has(log.entidadeId))fail("AUDITORIA_DUPLICADA");
    byId.set(log.entidadeId,log);
   }
   for(const p of pareceres){
    const audit=byId.get(p.id);
    if(audit?.usuarioId!==p.conferenteId||
       audit?.dadosNovos?.fingerprint!==p.fingerprint||
       audit?.dadosNovos?.devolucaoId!==p.devolucaoId||
       audit?.dadosNovos?.codigoDossie!==p.codigoDossie||
       audit?.dadosNovos?.comprovacaoBancariaIndependente!==false||
       audit?.dadosNovos?.semEfeitoFinanceiroFiscal!==true)
     fail("AUDITORIA_DIVERGENTE");
   }
  }
  return planejarCustodiaDevolucoesM529({dossie,pareceres});
 },{isolationLevel:"RepeatableRead",maxWait:8000,timeout:20000});
}
