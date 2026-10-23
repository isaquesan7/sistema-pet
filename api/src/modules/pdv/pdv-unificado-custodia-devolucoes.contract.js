/**
 * PointVet M.5.29 — privacy/custody READINESS, not evidence custody.
 * Only uses identifiers and fingerprints of the M.5.27/28 CI projections.
 * No document bytes, filenames, account details, legal retention guesses,
 * storage, export, deletion, bank verification, refund or fiscal action.
 */
import {createHash} from "node:crypto";

const fail=code=>{throw Error("M529_"+code);};
const sha=x=>typeof x==="string"&&/^[0-9a-f]{64}$/.test(x);
const id=x=>typeof x==="string"&&x.length>=3&&x.length<=120&&
 /^[a-zA-Z0-9_-]+$/.test(x);
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");

// Deliberately no approved duration, purpose or legal basis here. Each
// decision needs a separately approved, versioned policy before real intake.
export const GATES_CUSTODIA_M529=Object.freeze([
 "FINALIDADE_E_BASE_LEGAL_APROVADAS",
 "MINIMIZACAO_E_CATEGORIAS_DE_DADOS_APROVADAS",
 "ACESSO_SEGREGADO_E_AUDITORIA_DE_CONSULTAS",
 "CRIPTOGRAFIA_E_GESTAO_DE_CHAVES",
 "CADEIA_DE_CUSTODIA_E_AUTENTICIDADE",
 "RETENCAO_POR_CATEGORIA_E_MARCO_INICIAL",
 "DESCARTE_SEGURO_E_SUSPENSAO_POR_LITIGIO",
 "DIREITOS_DO_TITULAR_E_TRATAMENTO_DE_INCIDENTES",
 "REGRAS_CONTABEIS_E_FISCAIS_POR_CNPJ",
 "STAGING_RESTORE_ROLLBACK_E_HOMOLOGACAO_HUMANA"
]);
const gates=GATES_CUSTODIA_M529;

export function planejarCustodiaDevolucoesM529({dossie,pareceres=[]}={}){
 if(dossie?.fase!=="M5_27_DOSSIE_REVISAO_INDEPENDENTE_READ_ONLY"||
    ![dossie.organizacaoId,dossie.empresaId,dossie.comandaId].every(id)||
    !sha(dossie.codigoDossie)||!Array.isArray(dossie.preparacoes)||
    dossie.preparacoes.length>50||dossie.leituraSomente!==true||
    dossie.provasBancariasValidas!==false||
    dossie.revisaoFiscalHomologada!==false||
    dossie.permiteConcluirRevisao!==false||
    dossie.permiteNovoReembolso!==false||
    dossie.permiteLancamentoFinanceiro!==false||
    dossie.permiteOperacaoFiscal!==false||dossie.habilitaCheckout!==false)
  fail("DOSSIE_NAO_CONFIAVEL");
 if(!Array.isArray(pareceres)||pareceres.length>500)
  fail("PARECERES_INVALIDOS");

 const declarations=new Map();
 for(const preparacao of dossie.preparacoes){
  if(!id(preparacao?.preparacaoId)||!Array.isArray(preparacao.declaracoes)||
     preparacao.declaracoes.length>500)
   fail("PREPARACAO_INVALIDA");
  for(const d of preparacao.declaracoes){
   if(!id(d?.declaracaoId)||declarations.has(d.declaracaoId)||
      d.comprovanteVerificado!==false||
      d.revisorIndependenteConfirmado!==false)
    fail("DECLARACAO_NAO_CONFIAVEL");
   declarations.set(d.declaracaoId,true);
  }
 }
 if(declarations.size>500||dossie.totais?.quantidadeDeclaracoes!==declarations.size)
  fail("TOTAIS_INCONSISTENTES");

 const reviews=new Map();
 for(const p of pareceres){
  if(!id(p?.id)||!id(p.devolucaoId)||!id(p.conferenteId)||
     p.organizacaoId!==dossie.organizacaoId||
     p.empresaId!==dossie.empresaId||p.comandaId!==dossie.comandaId||
     !declarations.has(p.devolucaoId)||reviews.has(p.devolucaoId)||
     !sha(p.codigoDossie)||!sha(p.fingerprint)||
     p.status!=="CONFERENCIA_DOCUMENTAL_DECLARADA_CI")
   fail("PARECER_INCONSISTENTE");
  reviews.set(p.devolucaoId,p);
 }

 const items=Object.freeze([...declarations.keys()].sort().map(devolucaoId=>{
  const p=reviews.get(devolucaoId);
  const estado=!p?"SEM_PARECER_CI":
   p.codigoDossie===dossie.codigoDossie?
    "PARECER_DECLARADO_NA_VERSAO_ATUAL":"PARECER_DE_VERSAO_ANTERIOR";
  return Object.freeze({devolucaoId,estado,
   parecerFingerprint:p?.fingerprint||null,
   parecerAtualNaoComprovaBanco:true,
   evidenciaExternaAutenticada:false,
   revisaoLegalConcluida:false});
 }));
 const contagem=Object.freeze({
  declaracoes:items.length,
  pareceresDeclarados:reviews.size,
  pareceresNaVersaoAtual:items.filter(i=>i.estado===
   "PARECER_DECLARADO_NA_VERSAO_ATUAL").length,
  pareceresHistoricos:items.filter(i=>i.estado===
   "PARECER_DE_VERSAO_ANTERIOR").length
 });
 const codigoPlano=hash({versao:"M5_29_PLANO_CUSTODIA_NAO_APROVADO_CI",
  organizacaoId:dossie.organizacaoId,empresaId:dossie.empresaId,
  comandaId:dossie.comandaId,codigoDossie:dossie.codigoDossie,
  items:items.map(i=>({id:i.devolucaoId,estado:i.estado,
   parecerFingerprint:i.parecerFingerprint})),gates});
 return Object.freeze({fase:"M5_29_PLANO_CUSTODIA_NAO_APROVADO_CI",
  organizacaoId:dossie.organizacaoId,empresaId:dossie.empresaId,
  comandaId:dossie.comandaId,codigoDossie:dossie.codigoDossie,
  codigoPlano,contagem,devolucoes:items,
  pendenciasPolitica:gates,
  estadoPolitica:"AGUARDANDO_DEFINICAO_JURIDICA_E_HOMOLOGACAO",
  finalidadeAprovada:null,baseLegalDefinida:null,
  prazoRetencaoDias:null,inicioContagemRetencao:null,
  dataDescarte:null,cadeiaCustodiaRealDisponivel:false,
  conteudoDocumentoAutenticado:false,bancoVerificadoIndependentemente:false,
  politicaAprovada:false,permiteUpload:false,permiteArmazenamento:false,
  permiteExportacao:false,permiteDescarteReal:false,
  permiteReembolso:false,permiteLancamentoFinanceiro:false,
  permiteOperacaoFiscal:false,habilitaCheckout:false,somenteLeitura:true});
}
