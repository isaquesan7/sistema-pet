/** M.4D.2 — pure hash chain verification, no official fiscal evidence. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {
 raizFiscalCi,hashFiscalCi,hashCadeiaEventoFiscalCi,
 fingerprintEventoFiscalCi,confirmarInvestigacaoManualCi,
 avaliarCadeiaFiscalCi
} from "../src/modules/fiscal/fiscal-unificado-integridade-ci.contract.js";
import {proximoEstadoFiscalCi} from "../src/modules/fiscal/fiscal-unificado-protocolo-ci.contract.js";

const base={id:"flow",organizacaoId:"org",empresaId:"firm",vendaId:"sale",
 criadoPorId:"user",classe:"PRODUTO",tipoDocumento:"NFE",
 pedidoFingerprint:"request",snapshotFingerprint:"snapshot-hash",
 snapshot:{a:1,z:{x:"value",b:true}},estado:"PREPARADA_CI",
 integridadeContador:0};
const makeRow=()=>{const row=structuredClone(base);
 row.integridadeRaiz=raizFiscalCi(row);row.integridadeCabeca=row.integridadeRaiz;
 return row;};
const pushEvent=(row,events,{tipo,motivo="Evidencia interna e ficticia de ambiente de teste",manual}={})=>{
 const decision=manual?confirmarInvestigacaoManualCi({
  estado:row.estado,motivo,referenciaInterna:manual.ref,
  descricaoVerificacao:manual.description
 }):proximoEstadoFiscalCi({estado:row.estado,tipo,motivo});
 const evidence=manual?decision:{...decision,
  origem:"SIMULADOR_LOCAL_CI",consultouProvedorFiscal:false,
  comprovacaoEmissorExterno:false};
 const event={
  id:"event-"+(events.length+1),fluxoId:row.id,usuarioId:"user",
  chaveEvento:"unique-event-"+(events.length+1),tipo,
  eventoFingerprint:fingerprintEventoFiscalCi({fluxoId:row.id,
   chaveEvento:"unique-event-"+(events.length+1),tipo,motivo,usuarioId:"user",
   referenciaInterna:manual?.ref,descricaoVerificacao:manual?.description}),
  estadoAnterior:decision.estadoAnterior,estadoPosterior:decision.estadoPosterior,
  evidencia:evidence,sequencia:events.length+1,
  hashAnterior:row.integridadeCabeca
 };
 event.hashEvento=hashCadeiaEventoFiscalCi(event);
 events.push(event);row.estado=event.estadoPosterior;
 row.integridadeContador++;row.integridadeCabeca=event.hashEvento;
 return event;
};
test("canonical snapshot fingerprints are independent of object key order",()=>{
 assert.equal(hashFiscalCi({z:4,a:{y:2,b:1}}),
  hashFiscalCi({a:{b:1,y:2},z:4}));
});
test("empty and full signed CI chain: matching states and audit ordering",()=>{
 const row=makeRow(),events=[];
 assert.equal(avaliarCadeiaFiscalCi(row,events).confiavel,true);
 pushEvent(row,events,{tipo:"SIMULAR_RESPOSTA_INDETERMINADA"});
 assert.equal(avaliarCadeiaFiscalCi(row,events).investigacaoManualNecessaria,true);
 pushEvent(row,events,{tipo:"REGISTRAR_INVESTIGACAO_MANUAL_CI",
  manual:{ref:"CI-internal-review",description:
   "Inspecao local no simulador sem consulta ao provedor fiscal externo."}});
 assert.equal(avaliarCadeiaFiscalCi(row,events).investigacaoManualNecessaria,false);
 pushEvent(row,events,{tipo:"SIMULAR_CONSULTA_REJEITADA"});
 const status=avaliarCadeiaFiscalCi(row,events);
 assert.equal(status.confiavel,true);
 assert.equal(status.estadoConferido,"REJEITADA_CI");
 assert.equal(status.eventosConferidos,3);
 assert.equal(status.autorizacaoOficial,false);
 assert.equal(status.permiteReenvioAutomatico,false);
});
test("detect modified evidence, missing event, broken chain, head and state spoofing",()=>{
 const row=makeRow(),events=[];
 pushEvent(row,events,{tipo:"SIMULAR_RESPOSTA_INDETERMINADA"});
 const original=structuredClone(events[0]);
 const missing=avaliarCadeiaFiscalCi(row,[]);
 assert.equal(missing.confiavel,false);
 events[0].evidencia.motivo="Alterado sem registrar em cadeia";
 assert.equal(avaliarCadeiaFiscalCi(row,events).confiavel,false);
 events[0]=original;
 row.integridadeCabeca="a".repeat(64);
 assert.equal(avaliarCadeiaFiscalCi(row,events).confiavel,false);
 row.integridadeCabeca=original.hashEvento;
 row.estado="ACEITA_SIMULADA_CI";
 assert.equal(avaliarCadeiaFiscalCi(row,events).confiavel,false);
 row.estado="INDETERMINADA_CI";
 row.snapshot.z.x="new value";
 assert.equal(avaliarCadeiaFiscalCi(row,events).confiavel,false);
});
test("manual investigation must be for uncertain/contingency and contain CI-only evidence",()=>{
 for(const bad of [
  {estado:"PREPARADA_CI",referenciaInterna:"CI-review-123",
   descricaoVerificacao:"Descricao suficientemente completa para CI"},
  {estado:"INDETERMINADA_CI",referenciaInterna:"EXT-123456",
   descricaoVerificacao:"Descricao suficientemente completa para CI"},
  {estado:"INDETERMINADA_CI",referenciaInterna:"CI-review-123",
   descricaoVerificacao:"short"}
 ])assert.throws(()=>confirmarInvestigacaoManualCi({
  ...bad,motivo:"Auditoria interna de situacao fiscal inconclusiva"
 }),/M4D2_/);
 const x=confirmarInvestigacaoManualCi({
  estado:"CONTINGENCIA_REVISAO_CI",motivo:"Analise manual sem transmissao",
  referenciaInterna:"CI-review-123456",
  descricaoVerificacao:"Apenas revisao interna; sem referencia oficial da prefeitura."
 });
 assert.equal(x.estadoAnterior,x.estadoPosterior);
 assert.equal(x.consultouProvedorFiscal,false);
 assert.equal(x.autorizadoOficialmente,false);
});
