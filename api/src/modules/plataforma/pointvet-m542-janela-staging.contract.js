/**
 * PointVet M.5.4.2 — política pura de liberação para ensaio operacional.
 * Não executa rede, shell, deploy, migração, DNS, restore ou rollback.
 * Autorização de staging e produção são decisões DISTINTAS e externas.
 */
import {revisarManifestoStagingM541} from "./pointvet-m541-auditoria-evidencias.contract.js";
const SHA=/^[a-f0-9]{40}$/;
const validId=x=>typeof x==="string"&&/^[a-zA-Z0-9_.-]{4,80}$/.test(x);
const flagNames=["stagingSegregado","somenteDadosSinteticos","emailSink","webhooksExternosDesligados","fiscalRealDesligado","pspDesligado","pdvUnificadoDesligado","creditoCheckoutDesligado","semDadosPetKing","semMudancasDnsProducao"];
export function avaliarJanelaStagingM542(input){
 const auditoria=revisarManifestoStagingM541(input);
 const motivos=[...auditoria.bloqueios];
 const janela=input.janela;
 if(!janela||typeof janela!=="object"||Array.isArray(janela))motivos.push("JANELA_AUSENTE");
 if(!validId(janela?.responsavel)||!validId(janela?.aprovador)||janela?.responsavel===janela?.aprovador)
  motivos.push("SEGREGACAO_DE_FUNCOES_INVALIDA");
 if(!SHA.test(janela?.commitSha||"")||janela?.commitSha!==input.commitSha)
  motivos.push("COMMIT_NAO_FIXADO");
 if(!validId(janela?.ticketMudanca)||!validId(janela?.planoInterrupcao))
  motivos.push("PLANO_DE_MUDANCA_INCOMPLETO");
 for(const key of flagNames)if(janela?.[key]!==true)motivos.push("CONDICAO_INSEGURA_"+key);
 if(janela?.scope!=="STAGING_SINTETICO_SEM_PRODUCAO")
  motivos.push("ESCOPO_INCORRETO");
 if(janela?.producaoAutorizada===true||janela?.restoreRealAutorizado===true||
    janela?.canarioAutorizado===true)motivos.push("ESCOPO_EXCEDE_STAGING_SINTETICO");
 const impedimentos=Object.freeze([...new Set(motivos)].sort());
 return Object.freeze({
  fase:"M5_4_2_JANELA_STAGING",validacaoDeclarativaCompleta:impedimentos.length===0,
  impedimentos,aprovacaoExternaVerificada:false,
  ambienteRealInspecionado:false,stagingOperacional:false,
  executarDeploy:false,executarMigration:false,executarRestore:false,
  executarRollback:false,habilitarCanario:false,autorizarProducao:false
 });
}
