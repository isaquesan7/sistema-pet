/**
 * PointVet M.5.30 — CI-only DRAFT acceptance matrix for future custody policy.
 * Code-based controls are not real documents, legal opinions or approvals.
 * No free text, documents, URLs, banking data, file intake or retention dates.
 */
import {createHash} from "node:crypto";
import {GATES_CUSTODIA_M529}
 from "./pdv-unificado-custodia-devolucoes.contract.js";

const fail=code=>{throw Error("M530_"+code);};
const sha=x=>typeof x==="string"&&/^[0-9a-f]{64}$/.test(x);
const ref=x=>typeof x==="string"&&/^CI-[A-Z0-9_-]{6,64}$/.test(x);
const exactly=(obj,keys)=>obj&&typeof obj==="object"&&
 !Array.isArray(obj)&&Object.keys(obj).length===keys.length&&
 keys.every(key=>Object.hasOwn(obj,key));
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");

// Provisional responsibility map. A PERSON and their authority still need
// independent selection/verification before any REAL approval can exist.
export const RESPONSABILIDADES_CUSTODIA_M530=Object.freeze({
 FINALIDADE_E_BASE_LEGAL_APROVADAS:"PRIVACIDADE",
 MINIMIZACAO_E_CATEGORIAS_DE_DADOS_APROVADAS:"PRIVACIDADE",
 ACESSO_SEGREGADO_E_AUDITORIA_DE_CONSULTAS:"SEGURANCA",
 CRIPTOGRAFIA_E_GESTAO_DE_CHAVES:"SEGURANCA",
 CADEIA_DE_CUSTODIA_E_AUTENTICIDADE:"SEGURANCA",
 RETENCAO_POR_CATEGORIA_E_MARCO_INICIAL:"PRIVACIDADE",
 DESCARTE_SEGURO_E_SUSPENSAO_POR_LITIGIO:"PRIVACIDADE",
 DIREITOS_DO_TITULAR_E_TRATAMENTO_DE_INCIDENTES:"PRIVACIDADE",
 REGRAS_CONTABEIS_E_FISCAIS_POR_CNPJ:"FINANCEIRO_FISCAL",
 STAGING_RESTORE_ROLLBACK_E_HOMOLOGACAO_HUMANA:"OPERACOES"
});

const encerramento=Object.freeze([
 "VALIDACAO_DA_POLITICA_POR_RESPONSAVEIS_REAIS",
 "SEGREGACAO_E_IDENTIDADE_DOS_APROVADORES",
 "BASE_LEGAL_E_PRAZO_DOCUMENTADOS_EXTERNAMENTE",
 "TESTE_DE_CONTROLES_E_INCIDENTES_NO_STAGING_REAL",
 "HOMOLOGACAO_CONTABIL_FISCAL_POR_CNPJ",
 "AUTORIZACAO_EXPRESSA_PARA_ARMAZENAMENTO_E_CAPTURA"
]);

export function avaliarMinutaCustodiaM530({plano,minuta}={}){
 if(plano?.fase!=="M5_29_PLANO_CUSTODIA_NAO_APROVADO_CI"||
    !sha(plano.codigoPlano)||!sha(plano.codigoDossie)||
    plano.somenteLeitura!==true||plano.politicaAprovada!==false||
    plano.permiteUpload!==false||plano.permiteArmazenamento!==false||
    plano.permiteExportacao!==false||plano.permiteDescarteReal!==false||
    plano.permiteReembolso!==false||plano.permiteLancamentoFinanceiro!==false||
    plano.permiteOperacaoFiscal!==false||
    plano.cadeiaCustodiaRealDisponivel!==false||
    plano.baseLegalDefinida!==null||plano.prazoRetencaoDias!==null||
    plano.habilitaCheckout!==false||
    JSON.stringify(plano.pendenciasPolitica)!==JSON.stringify(GATES_CUSTODIA_M529))
  fail("PLANO_NAO_CONFIAVEL");
 if(!exactly(minuta,["versao","organizacaoId","empresaId","comandaId",
   "codigoPlanoEsperado","requisitos"])||
    minuta.versao!=="M5_30_MINUTA_CUSTODIA_CI_V1"||
    minuta.organizacaoId!==plano.organizacaoId||
    minuta.empresaId!==plano.empresaId||
    minuta.comandaId!==plano.comandaId)
  fail("MINUTA_OU_ESCOPO_INVALIDO");
 if(!sha(minuta.codigoPlanoEsperado)||
    minuta.codigoPlanoEsperado!==plano.codigoPlano)
  fail("PLANO_DESATUALIZADO");
 if(!Array.isArray(minuta.requisitos)||
    minuta.requisitos.length!==GATES_CUSTODIA_M529.length)
  fail("MATRIZ_INCOMPLETA");

 const byKey=new Map();
 for(const item of minuta.requisitos){
  if(!exactly(item,["codigo","areaResponsavel","especificado",
    "referenciaControle"])||
     !GATES_CUSTODIA_M529.includes(item.codigo)||byKey.has(item.codigo)||
     RESPONSABILIDADES_CUSTODIA_M530[item.codigo]!==item.areaResponsavel||
     typeof item.especificado!=="boolean"||
     (item.especificado?!ref(item.referenciaControle):
       item.referenciaControle!==null))
   fail("CONTROLE_INVALIDO_OU_DUPLICADO");
  byKey.set(item.codigo,item);
 }
 const controles=Object.freeze(GATES_CUSTODIA_M529.map(codigo=>{
  const x=byKey.get(codigo);
  if(!x)fail("CONTROLE_AUSENTE");
  return Object.freeze({codigo,areaResponsavel:x.areaResponsavel,
   especificado:x.especificado,referenciaControle:x.referenciaControle,
   evidenciaRealVerificada:false,aprovacaoHumanaReal:false});
 }));
 const especificados=controles.filter(c=>c.especificado).length;
 const codigoMinuta=hash({versao:minuta.versao,
  organizacaoId:plano.organizacaoId,empresaId:plano.empresaId,
  comandaId:plano.comandaId,codigoPlano:plano.codigoPlano,
  controles:controles.map(c=>({codigo:c.codigo,area:c.areaResponsavel,
   especificado:c.especificado,referencia:c.referenciaControle}))});
 return Object.freeze({fase:"M5_30_MINUTA_CUSTODIA_NAO_HOMOLOGADA_CI",
  organizacaoId:plano.organizacaoId,empresaId:plano.empresaId,
  comandaId:plano.comandaId,codigoPlano:plano.codigoPlano,
  codigoMinuta,controles,
  coberturaTecnica:Object.freeze({total:controles.length,
   especificados,pendentes:controles.length-especificados,
   matrizTecnicamentePreenchida:especificados===controles.length}),
  pendenciasAprovacaoReal:encerramento,
  pessoasAprovadorasVerificadas:false,segregacaoPessoasHomologada:false,
  documentoExternoAutenticado:false,prazoRetencaoHomologado:null,
  politicaAprovada:false,permiteUpload:false,permiteArmazenamento:false,
  permiteExportacao:false,permiteDescarteReal:false,
  permiteReembolso:false,permiteLancamentoFinanceiro:false,
  permiteOperacaoFiscal:false,habilitaCheckout:false,somenteLeitura:true});
}
