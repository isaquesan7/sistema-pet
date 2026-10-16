import {test} from "node:test";
import assert from "node:assert/strict";
import {validarParecerDevolucaoCiM528 as validate}
 from "../src/modules/pdv/pdv-unificado-parecer-devolucao-ci.contract.js";

const fixture=()=>({
 devolucaoId:"devolucao-ci-1",devolucaoFingerprint:"a".repeat(64),
 codigoDossie:"b".repeat(64),conferenteId:"terceiro-conferente",
 usuarioDeclaranteId:"declarante-ci",criadorPreparacaoId:"preparador-ci",
 usuarioRepasseId:"repasse-ci",referenciaExterna:"CI-REFUND-1000",
 valorBrutoDeclarado:"20.00",evidenciaReferencia:"CI-PROTOCOLO-EXTERNO-001",
 evidenciaSha256:"c".repeat(64),confirmouComparacaoDocumental:true
});

test("M.5.28 binds a reviewer-supplied document reference to an immutable refund snapshot",()=>{
 const actual=validate(fixture());
 assert.match(actual.fingerprint,/^[0-9a-f]{64}$/);
 assert.equal(actual.status,"CONFERENCIA_DOCUMENTAL_DECLARADA_CI");
 assert.equal(actual.valorBruto,"20.00");
 assert.equal(actual.comprovanteAnexado,false);
 assert.equal(actual.conteudoDocumentoAutenticado,false);
 assert.equal(actual.bancoVerificadoIndependentemente,false);
 assert.equal(actual.segundaRevisaoLegalConcluida,false);
 assert.equal(actual.permiteReembolso,false);
 assert.equal(actual.permiteLancamentoFinanceiro,false);
 assert.equal(actual.permiteOperacaoFiscal,false);
 assert.equal(actual.habilitaCheckout,false);
 assert.deepEqual(actual,validate(fixture()));
 for(const field of ["devolucaoId","devolucaoFingerprint","codigoDossie",
  "conferenteId","referenciaExterna","valorBrutoDeclarado",
  "evidenciaReferencia","evidenciaSha256"]){
  const altered=fixture();
  altered[field]=field==="valorBrutoDeclarado"?"21.00":
   field==="devolucaoFingerprint"?"d".repeat(64):
   field==="codigoDossie"?"e".repeat(64):
   field==="evidenciaSha256"?"f".repeat(64):"ALTERED-CI-VALUE";
  assert.notEqual(validate(altered).fingerprint,actual.fingerprint,field);
 }
});

test("M.5.28 forbids self-review, implicit approval and malformed evidence",()=>{
 const changes=[
  x=>{x.conferenteId=x.usuarioDeclaranteId;},
  x=>{x.conferenteId=x.criadorPreparacaoId;},
  x=>{x.conferenteId=x.usuarioRepasseId;},
  x=>{x.confirmouComparacaoDocumental=false;},
  x=>{x.evidenciaReferencia="Documento de cliente em texto livre";},
  x=>{x.evidenciaSha256="hash-nao-verificado";},
  x=>{x.codigoDossie="invalid";},
  x=>{x.devolucaoFingerprint="invalid";},
  x=>{x.valorBrutoDeclarado="0.00";},
  x=>{x.valorBrutoDeclarado="20.001";},
  x=>{x.valorBrutoDeclarado="-1.00";},
  x=>{x.conferenteId="";}
 ];
 for(const mutate of changes){
  const input=fixture();mutate(input);
  assert.throws(()=>validate(input),/M528_/);
 }
});
