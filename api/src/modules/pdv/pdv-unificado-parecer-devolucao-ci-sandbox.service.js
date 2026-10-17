/**
 * PointVet M.5.28 — CI-ONLY immutable metadata of a human documentary review.
 * Never ingest evidence bytes, reach banks/providers or alter economic state.
 * The document hash/reference are USER SUPPLIED and are NOT authenticated.
 * No route, worker or production data migration is authorized by this service.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {reunirFontesConferenciaDevolucoesEmTransacaoM524}
 from "./pdv-unificado-diagnostico-devolucoes.service.js";
import {montarDossieDevolucoesM527}
 from "./pdv-unificado-dossie-devolucoes.contract.js";
import {validarParecerDevolucaoCiM528}
 from "./pdv-unificado-parecer-devolucao-ci.contract.js";

const fail=code=>{throw Error("M528_"+code);};
const has=x=>typeof x==="string"&&x.trim().length>0;
const presentation=(row,reutilizada)=>Object.freeze({
 parecerId:row.id,devolucaoId:row.devolucaoId,
 empresaId:row.empresaId,codigoDossie:row.codigoDossie,
 fingerprint:row.fingerprint,status:row.status,reutilizada,
 revisaoDeclaradaPorOutroFuncionario:true,
 comprovanteAnexado:false,conteudoDocumentoAutenticado:false,
 bancoVerificadoIndependentemente:false,permiteReembolso:false,
 permiteLancamentoFinanceiro:false,permiteOperacaoFiscal:false,
 habilitaCheckout:false
});

export async function registrarParecerDevolucaoExternaSomenteSandbox({
 organizacaoId,empresaId,conferenteId,devolucaoId,
 codigoDossieEsperado,evidencia={},simularFalhaAposGravacao=false
}={}){
 exigirBancoIsolado();
 if(![organizacaoId,empresaId,conferenteId,devolucaoId,
  codigoDossieEsperado].every(has))fail("CONTEXTO_INVALIDO");
 return prisma.$transaction(async tx=>{
  if((await tx.$queryRaw`SELECT current_database() AS nome`)[0]?.nome!=="pointvet_unified_ci")
   fail("BANCO_NAO_ISOLADO");
  const key=await tx.devolucaoClienteManualUnificada.findUnique({
   where:{id:devolucaoId},select:{comandaId:true}
  });
  if(!key)fail("DECLARACAO_NAO_ENCONTRADA");
  // Same lock order as M.5.22: serialize new declarations and this review.
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${key.comandaId} FOR UPDATE`;
  const refund=await tx.devolucaoClienteManualUnificada.findFirst({
   where:{id:devolucaoId,organizacaoId,empresaId},
   select:{id:true,usuarioId:true,fingerprint:true,preparacaoId:true,
    conciliacaoOrigemId:true,referenciaExterna:true,valorBruto:true,comandaId:true}
  });
  if(!refund)fail("DECLARACAO_DE_OUTRA_EMPRESA");
  const {diagnostico,historico}=
   await reunirFontesConferenciaDevolucoesEmTransacaoM524(tx,{
    organizacaoId,empresaId,comandaId:refund.comandaId,
    usuarioId:conferenteId
   });
  const dossie=montarDossieDevolucoesM527({diagnostico,historico});
  const document=dossie.preparacoes.find(x=>x.preparacaoId===refund.preparacaoId)
   ?.declaracoes.find(x=>x.declaracaoId===devolucaoId);
  if(!document||document.declaranteUsuarioId!==refund.usuarioId||
     document.referenciaInformada!==refund.referenciaExterna||
     document.valorDeclarado!==Number(refund.valorBruto).toFixed(2))
   fail("DECLARACAO_NAO_APARECE_NO_DOSSIE_ATUAL");
  const [pre,entry]=await Promise.all([
   tx.preparacaoBaixaCartaoManualUnificada.findUnique({
    where:{id:refund.preparacaoId},select:{usuarioId:true}
   }),
   tx.conciliacaoFinanceira.findUnique({
    where:{id:refund.conciliacaoOrigemId},select:{usuarioId:true}
   })
  ]);
  if(!pre?.usuarioId||!entry?.usuarioId)
   fail("PARTICIPANTES_SEM_INTEGRIDADE");
  const existing=await tx.parecerDevolucaoExternaCi.findUnique({
   where:{devolucaoId}
  });
  // A saved review is immutable. Safe replay may reference its OLD dossier
  // even after later declarations changed the CURRENT dossier's SHA.
  const sourceCode=existing?.codigoDossie||dossie.codigoDossie;
  const validated=validarParecerDevolucaoCiM528({
   devolucaoId,devolucaoFingerprint:refund.fingerprint,codigoDossie:sourceCode,
   conferenteId,usuarioDeclaranteId:refund.usuarioId,
   criadorPreparacaoId:pre.usuarioId,usuarioRepasseId:entry.usuarioId,
   referenciaExterna:document.referenciaInformada,
   valorBrutoDeclarado:document.valorDeclarado,
   evidenciaReferencia:evidencia.evidenciaReferencia,
   evidenciaSha256:evidencia.evidenciaSha256,
   confirmouComparacaoDocumental:evidencia.confirmouComparacaoDocumental
  });
  if(existing){
   const logs=await tx.auditoria.findMany({where:{
    organizacaoId,empresaId,acao:"DEVOLUCAO_DOCUMENTAL_CONFERIDA_CI",
    entidade:"PARECER_DEVOLUCAO_EXTERNA_CI",entidadeId:existing.id
   },select:{usuarioId:true,dadosNovos:true}});
   if(existing.organizacaoId!==organizacaoId||existing.empresaId!==empresaId||
      existing.conferenteId!==conferenteId||
      existing.codigoDossie!==codigoDossieEsperado||
      existing.fingerprint!==validated.fingerprint||
      existing.status!=="CONFERENCIA_DOCUMENTAL_DECLARADA_CI"||
      logs.length!==1||logs[0].usuarioId!==conferenteId||
      logs[0].dadosNovos?.fingerprint!==existing.fingerprint)
    fail("PARECER_EXISTENTE_DIVERGENTE");
   return presentation(existing,true);
  }
  if(dossie.codigoDossie!==codigoDossieEsperado)
   fail("DOSSIE_DESATUALIZADO");
  const record=await tx.parecerDevolucaoExternaCi.create({data:{
   organizacaoId,empresaId,comandaId:refund.comandaId,
   devolucaoId,conferenteId,codigoDossie:validated.codigoDossie,
   evidenciaReferencia:validated.evidenciaReferencia,
   evidenciaSha256:validated.evidenciaSha256,
   fingerprint:validated.fingerprint,
   snapshot:{versao:1,devolucaoFingerprint:refund.fingerprint,
    referenciaDevolucao:refund.referenciaExterna,valorBruto:validated.valorBruto,
    evidenciaApenasInformada:true,semBytesOuUrlDeComprovante:true,
    conteudoDocumentoAutenticado:false,comprovacaoBancariaIndependente:false,
    autorizacaoReembolsoOuFiscal:false}
  }});
  await tx.auditoria.create({data:{
   organizacaoId,empresaId,usuarioId:conferenteId,
   entidade:"PARECER_DEVOLUCAO_EXTERNA_CI",entidadeId:record.id,
   acao:"DEVOLUCAO_DOCUMENTAL_CONFERIDA_CI",
   dadosNovos:{fingerprint:record.fingerprint,devolucaoId,
    codigoDossie:record.codigoDossie,
    evidenciaReferencia:record.evidenciaReferencia,
    evidenciaSha256:record.evidenciaSha256,
    revisaoPorFuncionarioIndependente:true,
    comprovacaoBancariaIndependente:false,semEfeitoFinanceiroFiscal:true}
  }});
  if(simularFalhaAposGravacao)fail("ROLLBACK_SIMULADO");
  return presentation(record,false);
 },{isolationLevel:"Serializable",maxWait:10000,timeout:30000});
}
