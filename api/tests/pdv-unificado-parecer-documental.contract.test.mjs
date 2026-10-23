import {test} from "node:test";
import assert from "node:assert/strict";
import {validarParecerDocumentalM511} from "../src/modules/pdv/pdv-unificado-parecer-documental.contract.js";
const sample=()=>({preparacaoFingerprint:"a".repeat(64),conferenteId:"reviewer-ci",
 evidenciaReferencia:"EXTRATO-REFERENCIA-CI-01",evidenciaSha256:"b".repeat(64),
 confirmouConferenciaDocumental:true});
test("M.5.11 stable documentary review fingerprint, without banking proof",()=>{
 const a=validarParecerDocumentalM511(sample()),b=validarParecerDocumentalM511(sample());
 assert.deepEqual(a,b);assert.equal(a.fingerprint.length,64);
 assert.equal(a.comprovacaoBancariaIndependente,false);
 assert.equal(a.baixaContabilAutorizada,false);
 assert.equal(a.conteudoDocumentoValidado,false);
});
test("M.5.11 rejects unconfirmed, invalid or missing document reference",()=>{
 for(const mutation of [{confirmouConferenciaDocumental:false},
  {evidenciaReferencia:"x"},{evidenciaReferencia:"x with spaces"},
  {evidenciaSha256:"fake-sha"},{evidenciaSha256:"B".repeat(64)},
  {preparacaoFingerprint:"abc"},{conferenteId:""}])
  assert.throws(()=>validarParecerDocumentalM511({...sample(),...mutation}),/M511_/);
 assert.notEqual(validarParecerDocumentalM511(sample()).fingerprint,
  validarParecerDocumentalM511({...sample(),evidenciaSha256:"c".repeat(64)}).fingerprint);
});
