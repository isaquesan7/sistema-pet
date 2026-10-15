import {test} from "node:test";
import assert from "node:assert/strict";
import {gerarReferenciaRevisaoManualM519,conferirRevisaoAtualM519} from "../src/modules/pdv/pdv-unificado-revisao-financeira.contract.js";
const base=()=>({organizacaoId:"org-A",empresaId:"empresa-A",
 comandaId:"cmd-A",preparacaoId:"pre-A",
 etapa:"SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA",
 fingerprintPreparacao:"a".repeat(64),fingerprintParecer:"b".repeat(64),
 contaFinanceiraId:"account-A",valorLiquido:"58.80",lancamentoOriginalId:null});
test("M.5.19 financial read revision is deterministic, read-only and binds every visible value",()=>{
 const p=base(),value=gerarReferenciaRevisaoManualM519(p);
 assert.equal(value.codigoRevisao.length,64);
 assert.deepEqual(value,gerarReferenciaRevisaoManualM519(p));
 for(const k of ["comprovaTransferenciaBancaria","concedePermissaoFinanceira",
  "enviaDadosParaBanco","habilitaConfirmacaoReal","habilitaCorrecaoReal",
  "habilitaCheckout"])assert.equal(value[k],false,k);
 for(const mutate of [
  p=>{p.fingerprintPreparacao="c".repeat(64);},
  p=>{p.fingerprintParecer="d".repeat(64);},
  p=>{p.contaFinanceiraId="account-B";},
  p=>{p.valorLiquido="58.79";},
  p=>{p.empresaId="empresa-B";},
  p=>{p.comandaId="cmd-B";},
  p=>{p.etapa="AGUARDANDO_SEGUNDA_CONFERENCIA";p.fingerprintParecer=null;},
  p=>{p.etapa="REPASSE_INTERNO_CONFIRMADO_MANUALMENTE";p.lancamentoOriginalId="entry-1";}
 ]){
  const v=base();mutate(v);
  assert.notEqual(gerarReferenciaRevisaoManualM519(v).codigoRevisao,value.codigoRevisao);
 }
});
test("M.5.19 comparison detects stale revisions and cannot authorize an operation",()=>{
 const a=gerarReferenciaRevisaoManualM519(base());
 assert.equal(conferirRevisaoAtualM519({anterior:a,atual:a}).permaneceAtual,true);
 const b=base();b.valorLiquido="58.79";
 assert.deepEqual(conferirRevisaoAtualM519({anterior:a,
  atual:gerarReferenciaRevisaoManualM519(b)}).precisaRevisar,true);
});
test("M.5.19 refuses invalid state, SHA, absent second review and orphan ledger",()=>{
 const bad=[
  p=>{p.fingerprintParecer=null;},
  p=>{p.fingerprintPreparacao="not-a-hash";},
  p=>{p.valorLiquido="58,80";},
  p=>{p.etapa="REPASSE_INTERNO_CONFIRMADO_MANUALMENTE";},
  p=>{p.etapa="AGUARDANDO_SEGUNDA_CONFERENCIA";},
  p=>{p.lancamentoOriginalId="entry-1";},
  p=>{p.organizacaoId="";}
 ];
 for(const change of bad){const v=base();change(v);
  assert.throws(()=>gerarReferenciaRevisaoManualM519(v),/M519_/);
 }
});
