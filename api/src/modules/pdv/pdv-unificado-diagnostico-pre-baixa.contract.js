/**
 * PointVet M.5.12 — pure dossier integrity diagnostic. No accounting mutation.
 * A second person's attestation and an SHA reference are NOT independent
 * bank evidence; ALL results keep financial posting and production disabled.
 */
import {createHash} from "node:crypto";
import {validarParecerDocumentalM511} from "./pdv-unificado-parecer-documental.contract.js";
const DECIMAL=/^(?:0|[1-9]\d{0,10})(?:\.\d{1,2})?$/;
function toCents(raw){
 const value=String(raw);if(!DECIMAL.test(value))return null;
 const [whole,dec=""]=value.split(".");
 const cents=Number(whole)*100+Number(dec.padEnd(2,"0"));
 return Number.isSafeInteger(cents)?cents:null;
}
const distinct=(items)=>new Set(items).size===items.length;
export function avaliarDossiePreBaixaM512({
 organizacaoId,empresaId,preparacao,parecer,comanda,conta,parcelas,
 auditoriasPreparacao=[],auditoriasParecer=[],auditoriasDeclaracao=[]
}={}){
 if(!organizacaoId||!empresaId||!preparacao||!Array.isArray(parcelas)||
    !Array.isArray(auditoriasPreparacao)||!Array.isArray(auditoriasParecer)||
    !Array.isArray(auditoriasDeclaracao))
  throw Error("M512_CONTEXTO_INVALIDO");
 const reasons=new Set();
 const block=reason=>reasons.add(reason);
 if(preparacao.organizacaoId!==organizacaoId||
    preparacao.empresaId!==empresaId||
    preparacao.status!=="PREPARADA_SEM_BAIXA"||
    !preparacao.id||!preparacao.usuarioId||
    !/^[a-f0-9]{64}$/.test(preparacao.fingerprint||""))
  block("PREPARACAO_INVALIDA");
 if(!comanda||comanda.id!==preparacao.comandaId||
    comanda.status!=="FECHADA"||comanda.rascunhoUnificado!==true||
    comanda.organizacaoId!==organizacaoId)
  block("COMANDA_INVALIDA");
 if(!conta||conta.id!==preparacao.contaFinanceiraId||
    conta.empresaId!==empresaId||conta.ativo!==true||conta.tipo!=="BANCO")
  block("CONTA_EMPRESA_INVALIDA");
 const snapshot=preparacao.snapshot;
 const docs=snapshot?.parcelas;
 const centsBruto=toCents(preparacao.bruto);
 const centsTarifa=toCents(preparacao.tarifaCartao);
 const centsAntecipacao=toCents(preparacao.descontoAntecipacao);
 const centsLiquido=toCents(preparacao.liquidoDeclarado);
 if(snapshot?.versao!==1||snapshot.fase!=="M5_9_PREVIA_REPASSE_CARTAO"||
    snapshot.baixaRealExecutada!==false||
    snapshot.verificacaoBancariaIndependente!==false||
    !Array.isArray(docs)||!docs.length||
    !snapshot.valores||centsBruto===null||centsTarifa===null||
    centsAntecipacao===null||centsLiquido===null||
    centsBruto<=0||centsLiquido<=0||
    centsBruto!==centsTarifa+centsAntecipacao+centsLiquido||
    centsBruto!==toCents(snapshot.valores?.bruto)||
    centsTarifa!==toCents(snapshot.valores?.tarifaCartao)||
    centsAntecipacao!==toCents(snapshot.valores?.descontoAntecipacao)||
    centsLiquido!==toCents(snapshot.valores?.liquidoDeclarado)||
    (preparacao.tipo==="REPASSE_NORMAL"&&centsAntecipacao!==0)||
    (preparacao.tipo==="ANTECIPACAO"&&centsAntecipacao===0)||
    !["REPASSE_NORMAL","ANTECIPACAO"].includes(preparacao.tipo))
  block("VALORES_OU_SNAPSHOT_DIVERGENTES");
 // Reconstruct the ORIGINAL M.5.9 SHA-256 from current database values.
 // Audit hashes alone cannot detect a coordinated alteration of the source.
 if(centsBruto!==null&&centsTarifa!==null&&centsAntecipacao!==null&&
    centsLiquido!==null&&Array.isArray(docs)&&docs.length){
  const date=preparacao.dataCredito instanceof Date?
   preparacao.dataCredito.toISOString().slice(0,10):
   typeof preparacao.dataCredito==="string"?preparacao.dataCredito.slice(0,10):"";
  const canonical={
   fase:"M5_9_PREVIA_REPASSE_CARTAO",
   organizacaoId,empresaId,comandaId:preparacao.comandaId,
   tipo:preparacao.tipo,contaFinanceiraId:preparacao.contaFinanceiraId,
   referenciaExtrato:preparacao.referenciaExtrato,dataCredito:date,
   parcelaIds:docs.map(p=>p.parcelaId).sort(),
   valorBrutoCentavos:centsBruto,tarifaCartaoCentavos:centsTarifa,
   descontoAntecipacaoCentavos:centsAntecipacao,
   valorLiquidoCentavos:centsLiquido
  };
  const expectedHash=createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  if(preparacao.fingerprint!==expectedHash)block("FINGERPRINT_PREPARACAO_DIVERGENTE");
 }
 const expectedIds=(docs||[]).map(p=>p.parcelaId);
 const attachedIds=parcelas.map(p=>p.id);
 if(!expectedIds.length||!distinct(expectedIds)||
    !distinct(attachedIds)||expectedIds.length!==attachedIds.length||
    expectedIds.some(id=>!attachedIds.includes(id)))
  block("VINCULOS_PARCELAS_DIVERGENTES");
 let soma=0;
 for(const p of parcelas){
  const d=(docs||[]).find(x=>x.parcelaId===p.id);
  const current=toCents(p.valor);
  if(!d||p.status!=="CONCILIADA"||!p.conciliadoEm||
     p.empresaId!==empresaId||p.comandaId!==preparacao.comandaId||
     p.forma!=="CARTAO_CREDITO"||p.pagamentoStatus!=="PENDENTE"||
     p.vendaStatus!=="FINALIZADA"||p.operacaoStatus!=="CONCLUIDA"||
     p.reservaStatus!=="RESERVADA"||
     current===null||current<=0||current!==toCents(d.valorBruto))
   block("PARCELAS_MODIFICADAS_OU_INELEGIVEIS");
  if(current!==null)soma+=current;
 }
 if(centsBruto!==null&&soma!==centsBruto)block("SOMA_PARCELAS_DIVERGENTE");
 if(auditoriasPreparacao.length!==1||
    auditoriasPreparacao[0]?.usuarioId!==preparacao.usuarioId||
    auditoriasPreparacao[0]?.organizacaoId!==organizacaoId||
    auditoriasPreparacao[0]?.empresaId!==empresaId||
    auditoriasPreparacao[0]?.entidadeId!==preparacao.id||
    auditoriasPreparacao[0]?.dadosNovos?.fingerprint!==preparacao.fingerprint)
  block("AUDITORIA_PREPARACAO_INVALIDA");
 if(!parecer)block("SEGUNDA_CONFERENCIA_AUSENTE");
 else{
  let valid=null;
  try{
   valid=validarParecerDocumentalM511({
    preparacaoFingerprint:preparacao.fingerprint,
    conferenteId:parecer.conferenteId,
    evidenciaReferencia:parecer.evidenciaReferencia,
    evidenciaSha256:parecer.evidenciaSha256,
    confirmouConferenciaDocumental:true
   });
  }catch{block("PARECER_INVALIDO");}
  if(!valid||parecer.fingerprint!==valid.fingerprint||
     parecer.preparacaoId!==preparacao.id||
     parecer.organizacaoId!==organizacaoId||parecer.empresaId!==empresaId||
     parecer.status!=="CONFERENCIA_DOCUMENTAL_DECLARADA"||
     parecer.conferenteId===preparacao.usuarioId||
     parecer.snapshot?.versao!==1||
     parecer.snapshot?.preparacaoFingerprint!==preparacao.fingerprint||
     parecer.snapshot?.referenciaExtrato!==preparacao.referenciaExtrato||
     parecer.snapshot?.comprovacaoBancariaIndependente!==false||
     parecer.snapshot?.baixaContabilAutorizada!==false||
     parecer.snapshot?.conteudoDocumentoValidado!==false||
     !Array.isArray(parecer.snapshot?.parcelas)||
     !distinct(parecer.snapshot.parcelas)||
     parecer.snapshot.parcelas.length!==expectedIds.length||
     expectedIds.some(id=>!parecer.snapshot.parcelas.includes(id)))
    block("PARECER_OU_SNAPSHOT_DIVERGENTE");
  if(auditoriasParecer.length!==1||
     auditoriasParecer[0]?.entidadeId!==parecer.id||
     auditoriasParecer[0]?.usuarioId!==parecer.conferenteId||
     auditoriasParecer[0]?.organizacaoId!==organizacaoId||
     auditoriasParecer[0]?.empresaId!==empresaId||
     auditoriasParecer[0]?.dadosNovos?.fingerprint!==parecer.fingerprint||
     auditoriasParecer[0]?.dadosNovos?.segregacaoDeFuncoes!==true||
     auditoriasParecer[0]?.dadosNovos?.comprovacaoBancariaIndependente!==false)
    block("AUDITORIA_PARECER_INVALIDA");
 }
 const declaredIds=auditoriasDeclaracao.map(a=>a.entidadeId);
 if(auditoriasDeclaracao.length!==expectedIds.length||!distinct(declaredIds)||
    expectedIds.some(id=>!declaredIds.includes(id))||
    auditoriasDeclaracao.some(a=>
     a.organizacaoId!==organizacaoId||a.empresaId!==empresaId||
     (parecer&&a.usuarioId===parecer.conferenteId)||
     a.dadosNovos?.status!=="CONCILIADA"||
     a.dadosNovos?.provaBancariaIndependente!==false||
     !Number.isSafeInteger(a.dadosNovos?.valorCentavos)||
     a.dadosNovos.valorCentavos<=0||
     !parcelas.some(p=>p.id===a.entidadeId&&
       toCents(p.valor)===a.dadosNovos?.valorCentavos)))
  block("AUDITORIAS_PARCELAS_INVALIDAS");
 const integridadeInternaAprovada=reasons.size===0;
 const pendencias=Object.freeze([...reasons].sort());
 return Object.freeze({
  fase:"M5_12_DIAGNOSTICO_PRE_BAIXA",
  organizacaoId,empresaId,preparacaoId:preparacao.id,
  integridadeInternaAprovada,
  situacao:integridadeInternaAprovada?"CONFERENCIA_DOCUMENTAL_COERENTE_SEM_BANCO":
   "INCONSISTENCIA_INTERNA_BLOQUEADA",
  pendencias,
  dependenciasExternas:Object.freeze([
   "EXTRATO_BANCARIO_AUTENTICADO_NAO_VERIFICADO",
   "CONCILIACAO_CONTABIL_REAL_NAO_HOMOLOGADA",
   "TRATAMENTO_ESTORNO_POS_REPASSE_NAO_HOMOLOGADO",
   "STAGING_REAL_E_ROLLBACK_NAO_HOMOLOGADOS"
  ]),
  comprovacaoBancariaIndependente:false,
  podeExecutarBaixa:false,podeAprovarPagamento:false,
  podeCreditarBanco:false,podeExecutarEstorno:false,
  podeEmitirFiscal:false,podePublicarPdv:false,
  somenteLeitura:true
 });
}
