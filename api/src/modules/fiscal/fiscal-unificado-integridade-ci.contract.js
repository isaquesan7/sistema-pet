/**
 * PointVet M.4D.2 — reproducible, self-checking chained fiscal CI ledger.
 * Detects accidental/unauthorized edits to a SINGLE database record, lost,
 * reordered or duplicated events. NOT tamper-proof against a privileged DB
 * actor capable of rewriting the entire chain and its anchor.
 */
import {createHash} from "node:crypto";
import {proximoEstadoFiscalCi} from "./fiscal-unificado-protocolo-ci.contract.js";
const fail=s=>{throw Error(s);};
function normalize(value){
 if(value===null)return null;
 if(Array.isArray(value))return value.map(normalize);
 if(typeof value==="object"){
  if(value instanceof Date)return value.toISOString();
  return Object.fromEntries(Object.keys(value).sort().filter(
   k=>value[k]!==undefined).map(k=>[k,normalize(value[k])]));
 }
 if(typeof value==="number"&&!Number.isFinite(value))fail("M4D2_VALOR_NAO_FINITO");
 if(!["string","number","boolean"].includes(typeof value))
  fail("M4D2_DADO_NAO_CANONICO");
 return value;
}
export const hashFiscalCi=x=>createHash("sha256").update(
 JSON.stringify(normalize(x))).digest("hex");
export function raizFiscalCi(row){
 return hashFiscalCi({v:2,fluxoId:row.id,organizacaoId:row.organizacaoId,
  empresaId:row.empresaId,vendaId:row.vendaId,
  criadoPorId:row.criadoPorId,classe:row.classe,
  tipoDocumento:row.tipoDocumento,pedidoFingerprint:row.pedidoFingerprint,
  snapshotFingerprint:row.snapshotFingerprint,snapshot:row.snapshot});
}
export function fingerprintEventoFiscalCi({
 fluxoId,chaveEvento,tipo,motivo,usuarioId,
 referenciaInterna,descricaoVerificacao
}){
 return hashFiscalCi({v:2,fluxoId,chaveEvento,tipo,motivo,usuarioId,
  ...(tipo==="REGISTRAR_INVESTIGACAO_MANUAL_CI"?{
   referenciaInterna,descricaoVerificacao
  }:{})});
}
export function hashCadeiaEventoFiscalCi(e){
 return hashFiscalCi({v:2,fluxoId:e.fluxoId,sequencia:e.sequencia,
  hashAnterior:e.hashAnterior,usuarioId:e.usuarioId,
  chaveEvento:e.chaveEvento,eventoFingerprint:e.eventoFingerprint,
  tipo:e.tipo,estadoAnterior:e.estadoAnterior,
  estadoPosterior:e.estadoPosterior,evidencia:e.evidencia});
}
export function confirmarInvestigacaoManualCi({
 estado,motivo,referenciaInterna,descricaoVerificacao
}){
 if(!["INDETERMINADA_CI","CONTINGENCIA_REVISAO_CI"].includes(estado))
  fail("M4D2_INVESTIGACAO_ESTADO_INVALIDO");
 const why=typeof motivo==="string"?motivo.trim():"";
 const ref=typeof referenciaInterna==="string"?referenciaInterna.trim():"";
 const desc=typeof descricaoVerificacao==="string"?descricaoVerificacao.trim():"";
 if(why.length<12||why.length>500||
    !/^CI-[A-Za-z0-9_-]{5,60}$/.test(ref)||
    desc.length<25||desc.length>1000)
  fail("M4D2_INVESTIGACAO_EVIDENCIA_INCOMPLETA");
 return {
  tipo:"REGISTRAR_INVESTIGACAO_MANUAL_CI",motivo:why,
  estadoAnterior:estado,estadoPosterior:estado,
  referenciaInterna:ref,descricaoVerificacao:desc,
  origem:"INVESTIGACAO_INTERNA_CI",
  consultouProvedorFiscal:false,comprovacaoEmissorExterno:false,
  recebeuProtocoloReal:false,autorizadoOficialmente:false,
  canceladoOficialmente:false,houveReenvio:false,
  requerComprovacaoExternaNaFuturaHomologacao:true
 };
}
export function avaliarCadeiaFiscalCi(flow,events){
 const errors=[];
 const note=c=>errors.push(c);
 if(!flow?.id||!Array.isArray(events))return {
  confiavel:false,pendencias:["M4D2_ENTRADA_INVALIDA"],
  estadoConferido:null,eventosConferidos:0};
 let root;
 try{root=raizFiscalCi(flow);}catch{note("M4D2_SNAPSHOT_INVALIDO");}
 if(!/^[a-f0-9]{64}$/.test(flow.integridadeRaiz||"")||
    root!==flow.integridadeRaiz)note("M4D2_RAIZ_DIVERGENTE");
 const sorted=[...events].sort((a,b)=>(a.sequencia||0)-(b.sequencia||0));
 let state="PREPARADA_CI",prev=flow.integridadeRaiz;
 let manualSinceUnknown=false;
 for(let i=0;i<sorted.length;i++){
  const e=sorted[i];
  const invalid=()=>note("M4D2_EVENTO_INTEGRO_OBRIGATORIO:"+String(i+1));
  if(e.fluxoId!==flow.id||e.sequencia!==i+1||
     e.hashAnterior!==prev||
     !/^[a-f0-9]{64}$/.test(e.hashEvento||"")){
   invalid();break;
  }
  let computed;
  try{computed=hashCadeiaEventoFiscalCi(e);}catch{invalid();break;}
  if(computed!==e.hashEvento){invalid();break;}
  const ev=e.evidencia||{};
  if(ev.estadoAnterior!==e.estadoAnterior||
     ev.estadoPosterior!==e.estadoPosterior||
     ev.tipo!==e.tipo||
     ev.origem!=="SIMULADOR_LOCAL_CI"&&
     ev.origem!=="INVESTIGACAO_INTERNA_CI"||
     ev.consultouProvedorFiscal!==false||
     ev.comprovacaoEmissorExterno!==false||
     typeof ev.motivo!=="string"||
     e.estadoAnterior!==state||
     fingerprintEventoFiscalCi({
      fluxoId:flow.id,chaveEvento:e.chaveEvento,tipo:e.tipo,
      motivo:ev.motivo,usuarioId:e.usuarioId,
      referenciaInterna:ev.referenciaInterna,
      descricaoVerificacao:ev.descricaoVerificacao
     })!==e.eventoFingerprint){invalid();break;}
  try{
   if(e.tipo==="REGISTRAR_INVESTIGACAO_MANUAL_CI"){
    const expected=confirmarInvestigacaoManualCi({
     estado:state,motivo:ev.motivo,
     referenciaInterna:ev.referenciaInterna,
     descricaoVerificacao:ev.descricaoVerificacao
    });
    if(Object.keys(expected).some(k=>ev[k]!==expected[k]))
     throw Error("incorrect manual evidence");
    manualSinceUnknown=true;
   }else{
    if((e.tipo==="SIMULAR_CONSULTA_ACEITA"||
        e.tipo==="SIMULAR_CONSULTA_REJEITADA")&&!manualSinceUnknown)
     throw Error("manual investigation missing");
    const expected=proximoEstadoFiscalCi({
     estado:state,tipo:e.tipo,motivo:ev.motivo
    });
    if(expected.estadoPosterior!==e.estadoPosterior||
       ev.origem!=="SIMULADOR_LOCAL_CI"||
       Object.keys(expected).some(k=>ev[k]!==expected[k]))
     throw Error("invalid transition evidence");
    if(expected.estadoPosterior==="INDETERMINADA_CI"||
       expected.estadoPosterior==="CONTINGENCIA_REVISAO_CI")
     manualSinceUnknown=false;
   }
  }catch{invalid();break;}
  state=e.estadoPosterior;prev=e.hashEvento;
 }
 if(flow.estado!==state)note("M4D2_ESTADO_DIVERGENTE");
 if(flow.integridadeCabeca!==prev)note("M4D2_CABECA_DIVERGENTE");
 if(flow.integridadeContador!==events.length)
  note("M4D2_CONTADOR_DIVERGENTE");
 // A valid chain may still reflect a locally SIMULATED acceptance only.
 return {confiavel:errors.length===0,pendencias:[...new Set(errors)],
  estadoConferido:state,eventosConferidos:sorted.length,
  raiz:flow.integridadeRaiz,cabeca:prev,
  investigacaoManualNecessaria:
   (state==="INDETERMINADA_CI"||state==="CONTINGENCIA_REVISAO_CI")&&
   !manualSinceUnknown,
  autorizacaoOficial:false,protocoloOficial:false,
  permiteReenvioAutomatico:false};
}
