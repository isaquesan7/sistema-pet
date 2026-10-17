/**
 * PointVet M.5.32 — denied-by-design evidence operation decision PREVIEW.
 * Roles are hypothetical; no credential, identity, object, file, URL or
 * content. This module NEVER grants a real operation or access capability.
 */
import {createHash} from "node:crypto";
import {CONTROLES_FRONTEIRA_M531}
 from "./pdv-unificado-fronteira-evidencias.contract.js";

const fail=code=>{throw Error("M532_"+code);};
const sha=x=>typeof x==="string"&&/^[0-9a-f]{64}$/.test(x);
const exactly=(x,keys)=>x&&typeof x==="object"&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");

export const OPERACOES_EVIDENCIA_M532=Object.freeze([
 "CAPTURAR_DOCUMENTO","LER_CONTEUDO","EXPORTAR_DOCUMENTO",
 "DESCARTAR_DOCUMENTO","RESTAURAR_DOCUMENTO"
]);
export const PAPEIS_HIPOTETICOS_M532=Object.freeze([
 "OPERADOR_CI","CONFERENTE_CI","AUDITOR_CI","SEGURANCA_CI"
]);
const bloqueiosBase=Object.freeze([
 "POLITICA_DOCUMENTAL_REAL_NAO_APROVADA",
 "PROVEDOR_DE_ARMAZENAMENTO_NAO_ESCOLHIDO",
 "ADAPTADOR_DE_ARMAZENAMENTO_NAO_IMPLEMENTADO",
 "CONTROLES_DE_SEGURANCA_NAO_HOMOLOGADOS",
 "IDENTIDADE_PERMISSAO_E_AUTORIZACAO_REAL_AUSENTES"
]);
const CAMPOS_FRONTEIRA_M531=Object.freeze([
 "fase","organizacaoId","empresaId","comandaId","codigoMinuta",
 "codigoFronteira","controles","coberturaPlanejamento",
 "provedorArmazenamentoSelecionado","adaptadorArmazenamentoImplementado",
 "chavesCriptograficasReaisCriadas","politicaRetencaoAprovada",
 "prazoRetencaoDias","tiposConteudoAprovados","limiteBytesAprovado",
 "autorizacaoParaCaptura","permiteUpload","permiteArmazenamento",
 "permiteExportacao","permiteDescarteReal","permiteReembolso",
 "permiteLancamentoFinanceiro","permiteOperacaoFiscal","habilitaCheckout",
 "somenteLeitura"
]);
const adicional=Object.freeze({
 CAPTURAR_DOCUMENTO:"CLASSIFICACAO_E_CAPTURA_NAO_AUTORIZADAS",
 LER_CONTEUDO:"ACESSO_A_CONTEUDO_NAO_AUTORIZADO",
 EXPORTAR_DOCUMENTO:"DESTINATARIO_E_EXPORTACAO_NAO_AUTORIZADOS",
 DESCARTAR_DOCUMENTO:"RETENCAO_E_SUSPENSAO_POR_LITIGIO_NAO_HOMOLOGADAS",
 RESTAURAR_DOCUMENTO:"PROCEDIMENTO_RESTORE_REAL_NAO_HOMOLOGADO"
});

function verificarFronteira(f){
 if(!exactly(f,CAMPOS_FRONTEIRA_M531)||
    f.fase!=="M5_31_FRONTEIRA_STORAGE_NAO_IMPLEMENTADA_CI"||
    !sha(f.codigoMinuta)||!sha(f.codigoFronteira)||
    typeof f.organizacaoId!=="string"||!f.organizacaoId||
    typeof f.empresaId!=="string"||!f.empresaId||
    typeof f.comandaId!=="string"||!f.comandaId||
    f.somenteLeitura!==true||f.provedorArmazenamentoSelecionado!==false||
    f.adaptadorArmazenamentoImplementado!==false||
    f.chavesCriptograficasReaisCriadas!==false||
    f.politicaRetencaoAprovada!==false||f.autorizacaoParaCaptura!==false||
    f.prazoRetencaoDias!==null||f.limiteBytesAprovado!==null||
    !Array.isArray(f.tiposConteudoAprovados)||f.tiposConteudoAprovados.length||
    f.permiteUpload!==false||f.permiteArmazenamento!==false||
    f.permiteExportacao!==false||f.permiteDescarteReal!==false||
    f.permiteReembolso!==false||f.permiteLancamentoFinanceiro!==false||
    f.permiteOperacaoFiscal!==false||f.habilitaCheckout!==false)
  fail("FRONTEIRA_NAO_CONFIAVEL");
 if(!Array.isArray(f.controles)||
    f.controles.length!==CONTROLES_FRONTEIRA_M531.length||
    f.controles.some((c,i)=>!exactly(c,["codigo","planejado",
       "implementado","validadoEmAmbienteReal"])||
      c.codigo!==CONTROLES_FRONTEIRA_M531[i]||
      typeof c.planejado!=="boolean"||c.implementado!==false||
      c.validadoEmAmbienteReal!==false))
  fail("CONTROLES_NAO_CONFIAVEIS");
 const planejados=f.controles.filter(c=>c.planejado).length;
 if(!exactly(f.coberturaPlanejamento,["total","planejados","pendentes",
    "propostaTecnicaCompleta"])||
    f.coberturaPlanejamento.total!==CONTROLES_FRONTEIRA_M531.length||
    f.coberturaPlanejamento.planejados!==planejados||
    f.coberturaPlanejamento.pendentes!==CONTROLES_FRONTEIRA_M531.length-planejados||
    f.coberturaPlanejamento.propostaTecnicaCompleta!==
       (planejados===CONTROLES_FRONTEIRA_M531.length))
  fail("COBERTURA_DIVERGENTE");
 const esperado=hash({versao:"M5_31_FRONTEIRA_EVIDENCIAS_CI_V1",
  organizacaoId:f.organizacaoId,empresaId:f.empresaId,
  comandaId:f.comandaId,codigoMinuta:f.codigoMinuta,
  controles:f.controles.map(c=>({codigo:c.codigo,planejado:c.planejado}))});
 if(esperado!==f.codigoFronteira)fail("FRONTEIRA_ADULTERADA");
 return planejados;
}

export function simularAcessoEvidenciaM532({fronteira,solicitacao}={}){
 const planejados=verificarFronteira(fronteira);
 if(!exactly(solicitacao,["versao","organizacaoId","empresaId",
    "comandaId","codigoFronteiraEsperado","operacao","papelHipotetico"])||
    solicitacao.versao!=="M5_32_DECISAO_ACESSO_EVIDENCIA_CI_V1"||
    solicitacao.organizacaoId!==fronteira.organizacaoId||
    solicitacao.empresaId!==fronteira.empresaId||
    solicitacao.comandaId!==fronteira.comandaId)
  fail("SOLICITACAO_OU_ESCOPO_INVALIDO");
 if(!sha(solicitacao.codigoFronteiraEsperado)||
    solicitacao.codigoFronteiraEsperado!==fronteira.codigoFronteira)
  fail("FRONTEIRA_DESATUALIZADA");
 if(!OPERACOES_EVIDENCIA_M532.includes(solicitacao.operacao)||
    !PAPEIS_HIPOTETICOS_M532.includes(solicitacao.papelHipotetico))
  fail("OPERACAO_OU_PAPEL_INVALIDO");
 const bloqueios=Object.freeze([...bloqueiosBase,adicional[solicitacao.operacao]]);
 const codigoDecisao=hash({versao:solicitacao.versao,
  codigoFronteira:fronteira.codigoFronteira,
  organizacaoId:fronteira.organizacaoId,empresaId:fronteira.empresaId,
  comandaId:fronteira.comandaId,operacao:solicitacao.operacao,
  papelHipotetico:solicitacao.papelHipotetico,bloqueios});
 return Object.freeze({fase:"M5_32_ACESSO_DOCUMENTAL_NEGADO_CI",
  organizacaoId:fronteira.organizacaoId,empresaId:fronteira.empresaId,
  comandaId:fronteira.comandaId,codigoFronteira:fronteira.codigoFronteira,
  codigoDecisao,operacao:solicitacao.operacao,
  papelHipotetico:solicitacao.papelHipotetico,
  papelRealAutenticado:false,permissaoRealVerificada:false,
  controlesPlanejados:planejados,controlesImplementados:0,
  controlesHomologados:0,bloqueios,
  autorizado:false,capacidadeEmitida:false,tokenEmitido:false,
  urlAssinadaEmitida:false,permiteUpload:false,permiteLeitura:false,
  permiteExportacao:false,permiteDescarte:false,permiteRestore:false,
  permiteOperacaoFiscal:false,permiteReembolso:false,
  habilitaCheckout:false,somenteLeitura:true});
}
