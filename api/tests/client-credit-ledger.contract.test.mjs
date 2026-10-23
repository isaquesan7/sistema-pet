/** M.4B.2 — pure signed ledger and fail-closed historical records. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {valorCreditoCentavos,checarRazaoCreditoCausal} from "../src/modules/clientes/client-credit-ledger.contract.js";
const entry={id:"e",organizacaoId:"o",empresaId:"c",clienteId:"u",tipo:"ENTRADA",valor:"100.00",
 solicitacaoFingerprint:"sha",idempotencia:"idem",responsavelId:"act",
 conciliacaoId:"proof",evidencia:{tipo:"BAIXA_CONCILIADA_CI"}};
const debit={...entry,id:"d",tipo:"UTILIZACAO",valor:"40.00",conciliacaoId:null,
 evidencia:{tipo:"DEBITO_SIMULADO_CI"}};
const reversal={...entry,id:"r",tipo:"ESTORNO",valor:"40.00",conciliacaoId:null,
 reverteMovimentoId:"d",evidencia:{tipo:"ESTORNO_CAUSAL_CI"}};
test("exact cents reject exponent, negative, zero and fractions",()=>{
 assert.equal(valorCreditoCentavos("100.00"),10000);
 for(const v of ["0","0.00","0.001","1e2","-1","NaN","01"])assert.throws(()=>valorCreditoCentavos(v),/M4B2_VALOR/);
});
test("causal reversal restores only the referenced debit",()=>{
 assert.deepEqual(checarRazaoCreditoCausal([entry,debit,reversal]),{
  saldoCentavos:10000,saldoConfiavel:true,motivo:null
 });
 assert.equal(checarRazaoCreditoCausal([entry,debit,{...reversal,reverteMovimentoId:null}]).motivo,
 "ESTORNO_SEM_VINCULO_ORIGINAL");
 assert.equal(checarRazaoCreditoCausal([entry,debit,reversal,{...reversal,id:"r2"}]).motivo,
 "ESTORNO_CAUSAL_INCONSISTENTE");
});
test("legacy, unverified and negative credits are never spendable",()=>{
 assert.equal(checarRazaoCreditoCausal([{...entry,id:"old",solicitacaoFingerprint:null}]).saldoConfiavel,false);
 assert.equal(checarRazaoCreditoCausal([{...entry,conciliacaoId:null}]).motivo,"ORIGEM_NAO_COMPROVADA");
 assert.equal(checarRazaoCreditoCausal([debit]).motivo,"RAZAO_SALDO_NEGATIVO");
});


test("M.4B.3: refund of an ENTRY without outbound reconciliation is not trusted",()=>{
 const r={...reversal,id:"return-entry",valor:"100.00",reverteMovimentoId:"e",
  devolucaoConciliacaoId:null,evidencia:{tipo:"ESTORNO_CAUSAL_CI"}};
 assert.equal(checarRazaoCreditoCausal([entry,r]).motivo,"DEVOLUCAO_SEM_LASTRO_CONTABIL");
 const withProof={...r,devolucaoConciliacaoId:"outbound-proof",
  evidencia:{tipo:"ESTORNO_CAUSAL_CI",devolucaoConciliacaoId:"outbound-proof",
   devolucaoExternaDeclarada:true,verificadoPeloBanco:false}};
 assert.deepEqual(checarRazaoCreditoCausal([entry,withProof]),{
  saldoCentavos:0,saldoConfiavel:true,motivo:null
 });
 assert.equal(checarRazaoCreditoCausal([entry,{
  ...withProof,evidencia:{...withProof.evidencia,devolucaoExternaDeclarada:false}
 }]).motivo,"DEVOLUCAO_SEM_LASTRO_CONTABIL");
 assert.equal(checarRazaoCreditoCausal([entry,debit,{
  ...reversal,devolucaoConciliacaoId:"outbound-proof"
 }]).motivo,"DEVOLUCAO_INDEVIDA_PARA_DEBITO");
});
