import {test} from "node:test";
import assert from "node:assert/strict";
import {normalizarConciliacaoManualM55,fingerprintConciliacaoManualM55} from "../src/modules/pdv/pdv-unificado-conciliacao-manual.contract.js";
const request=()=>({confirmouRepasseExterno:true,referenciaExterna:"CI-REPASS-1001",contaFinanceiraId:"conta-001",valor:"60.00"});
test("M5.5 explicit external receipt declaration and stable fingerprint",()=>{
 const p=normalizarConciliacaoManualM55(request());
 assert.equal(p.valorCentavos,6000);
 assert.equal(p.confirmouRepasseExterno,true);
 assert.equal(fingerprintConciliacaoManualM55({parcelaId:"parc1",organizacaoId:"org1",empresaId:"co1",pedido:p}),
  fingerprintConciliacaoManualM55({parcelaId:"parc1",organizacaoId:"org1",empresaId:"co1",pedido:p}));
 assert.equal(fingerprintConciliacaoManualM55({parcelaId:"parc1",organizacaoId:"org1",empresaId:"co1",pedido:p}).length,64);
});
test("M5.5 cannot assume bank deposit, waive account or declare wrong amount",()=>{
 for(const bad of [
  {...request(),confirmouRepasseExterno:false},
  {...request(),referenciaExterna:"ok"},
  {...request(),referenciaExterna:"postgresql://user:password@host/db"},
  {...request(),contaFinanceiraId:""},
  {...request(),valor:"0"},
  {...request(),valor:"-60.00"},
  {...request(),valor:"60.001"},
  {...request(),valor:"60,00"},
  {...request(),valor:"1e2"}])
  assert.throws(()=>normalizarConciliacaoManualM55(bad),/M55_/);
});
