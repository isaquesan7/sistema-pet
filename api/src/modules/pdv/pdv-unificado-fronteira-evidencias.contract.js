/**
 * PointVet M.5.31 — storage architecture PROPOSAL, never a storage adapter.
 * No bytes, object key, URL, provider credentials, signing, file or customer
 * data. Even a complete draft has NO authority to capture or retain evidence.
 */
import {createHash} from "node:crypto";

const fail=code=>{throw Error("M531_"+code);};
const sha=x=>typeof x==="string"&&/^[0-9a-f]{64}$/.test(x);
const exactly=(x,keys)=>x&&typeof x==="object"&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");

export const CONTROLES_FRONTEIRA_M531=Object.freeze([
 "ISOLAMENTO_ORGANIZACAO",
 "ISOLAMENTO_CNPJ_EMPRESA",
 "CRIPTOGRAFIA_EM_REPOUSO_PLANEJADA",
 "TRANSPORTE_PROTEGIDO_PLANEJADO",
 "CHAVES_EM_COFRE_SEPARADO_PLANEJADO",
 "ACESSO_TEMPORARIO_MINIMO_PLANEJADO",
 "VERIFICACAO_MALWARE_PLANEJADA",
 "TRILHA_DE_ACESSO_E_CUSTODIA_PLANEJADA",
 "DESCARTE_BLOQUEADO_SEM_POLITICA",
 "PROCEDIMENTO_INCIDENTE_E_RESTORE_PLANEJADO"
]);

export function planejarFronteiraEvidenciasM531({minuta,proposta}={}){
 if(minuta?.fase!=="M5_30_MINUTA_CUSTODIA_NAO_HOMOLOGADA_CI"||
    !sha(minuta.codigoMinuta)||!sha(minuta.codigoPlano)||
    minuta.somenteLeitura!==true||minuta.politicaAprovada!==false||
    minuta.pessoasAprovadorasVerificadas!==false||
    minuta.segregacaoPessoasHomologada!==false||
    minuta.documentoExternoAutenticado!==false||
    minuta.prazoRetencaoHomologado!==null||
    minuta.permiteUpload!==false||minuta.permiteArmazenamento!==false||
    minuta.permiteExportacao!==false||minuta.permiteDescarteReal!==false||
    minuta.permiteReembolso!==false||
    minuta.permiteLancamentoFinanceiro!==false||
    minuta.permiteOperacaoFiscal!==false||minuta.habilitaCheckout!==false)
  fail("MINUTA_NAO_CONFIAVEL");
 if(minuta.coberturaTecnica?.total!==10||
    minuta.coberturaTecnica.especificados!==10||
    minuta.coberturaTecnica.pendentes!==0||
    minuta.coberturaTecnica.matrizTecnicamentePreenchida!==true)
  fail("MINUTA_TECNICA_INCOMPLETA");

 if(!exactly(proposta,["versao","organizacaoId","empresaId",
    "comandaId","codigoMinutaEsperado","controles"])||
    proposta.versao!=="M5_31_FRONTEIRA_EVIDENCIAS_CI_V1"||
    proposta.organizacaoId!==minuta.organizacaoId||
    proposta.empresaId!==minuta.empresaId||
    proposta.comandaId!==minuta.comandaId)
  fail("PROPOSTA_OU_ESCOPO_INVALIDO");
 if(!sha(proposta.codigoMinutaEsperado)||
    proposta.codigoMinutaEsperado!==minuta.codigoMinuta)
  fail("MINUTA_DESATUALIZADA");
 if(!exactly(proposta.controles,CONTROLES_FRONTEIRA_M531))
  fail("CONTROLES_INVALIDOS");
 const controles=Object.freeze(CONTROLES_FRONTEIRA_M531.map(codigo=>{
  const planejado=proposta.controles[codigo];
  if(typeof planejado!=="boolean")fail("CONTROLE_NAO_BOOLEANO");
  return Object.freeze({codigo,planejado,implementado:false,
   validadoEmAmbienteReal:false});
 }));
 const planejados=controles.filter(c=>c.planejado).length;
 const codigoFronteira=hash({versao:proposta.versao,
  organizacaoId:minuta.organizacaoId,empresaId:minuta.empresaId,
  comandaId:minuta.comandaId,codigoMinuta:minuta.codigoMinuta,
  controles:controles.map(c=>({codigo:c.codigo,planejado:c.planejado}))});
 return Object.freeze({fase:"M5_31_FRONTEIRA_STORAGE_NAO_IMPLEMENTADA_CI",
  organizacaoId:minuta.organizacaoId,empresaId:minuta.empresaId,
  comandaId:minuta.comandaId,codigoMinuta:minuta.codigoMinuta,
  codigoFronteira,controles,
  coberturaPlanejamento:Object.freeze({total:controles.length,planejados,
   pendentes:controles.length-planejados,
   propostaTecnicaCompleta:planejados===controles.length}),
  provedorArmazenamentoSelecionado:false,
  adaptadorArmazenamentoImplementado:false,
  chavesCriptograficasReaisCriadas:false,
  politicaRetencaoAprovada:false,prazoRetencaoDias:null,
  tiposConteudoAprovados:Object.freeze([]),limiteBytesAprovado:null,
  autorizacaoParaCaptura:false,
  permiteUpload:false,permiteArmazenamento:false,
  permiteExportacao:false,permiteDescarteReal:false,
  permiteReembolso:false,permiteLancamentoFinanceiro:false,
  permiteOperacaoFiscal:false,habilitaCheckout:false,somenteLeitura:true});
}
