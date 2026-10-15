import {test} from "node:test";
import assert from "node:assert/strict";
import {validarDeclaracaoDevolucaoM522,conferirLimiteAcumuladoM522}
 from "../src/modules/pdv/pdv-unificado-devolucao-declarada.contract.js";
import {gerarReferenciaRevisaoManualM519} from "../src/modules/pdv/pdv-unificado-revisao-financeira.contract.js";
const fixture=()=>{
 const pre={id:"prep",organizacaoId:"org",empresaId:"co",comandaId:"cmd",
  status:"PREPARADA_SEM_BAIXA",fingerprint:"a".repeat(64),
  contaFinanceiraId:"account",bruto:"120.00",liquidoDeclarado:"113.50"};
 const parecer={preparacaoId:"prep",organizacaoId:"org",empresaId:"co",
  status:"CONFERENCIA_DOCUMENTAL_DECLARADA",fingerprint:"b".repeat(64)};
 const entrada={id:"entry",origem:"REPASSE_CARTAO_MANUAL_UNIFICADO",
  origemId:"prep",empresaId:"co",contaFinanceiraId:"account",
  direcao:"ENTRADA",valor:"113.50",usuarioId:"first"};
 const version=gerarReferenciaRevisaoManualM519({
  organizacaoId:"org",empresaId:"co",comandaId:"cmd",
  preparacaoId:"prep",etapa:"REPASSE_INTERNO_CONFIRMADO_MANUALMENTE",
  fingerprintPreparacao:pre.fingerprint,fingerprintParecer:parecer.fingerprint,
  contaFinanceiraId:"account",valorLiquido:"113.50",
  lancamentoOriginalId:"entry"
 });
 return {organizacaoId:"org",empresaId:"co",usuarioId:"second",
  preparacao:pre,parecer,entrada,dados:{
   codigoRevisaoEsperado:version.codigoRevisao,
   conciliacaoOrigemIdEsperada:"entry",
   referenciaExterna:"CLIENT-REFUND-1",
   motivo:"Devolução externa informada após contato com o cliente",
   valorBrutoDevolvido:"20.00",saldoRestanteBrutoEsperado:"120.00",
   confirmouDevolucaoExterna:true}};
};
test("M522 binds manual refund declaration to current confirmed repasse",()=>{
 const ctx=fixture(),a=validarDeclaracaoDevolucaoM522(ctx);
 assert.equal(a.fingerprint.length,64);
 assert.equal(a.executouReembolso,false);
 assert.equal(a.saldoEsperadoCentavos,12000);
 assert.deepEqual(a,validarDeclaracaoDevolucaoM522(ctx));
 for(const change of [
  x=>{x.empresaId="other";},x=>{x.usuarioId="first";},
  x=>{x.preparacao.fingerprint="c".repeat(64);},
  x=>{x.parecer.fingerprint="c".repeat(64);},
  x=>{x.entrada.valor="113.49";},
  x=>{x.dados.conciliacaoOrigemIdEsperada="other";},
  x=>{x.dados.valorBrutoDevolvido="120.01";},
  x=>{x.dados.confirmouDevolucaoExterna=false;},
  x=>{x.dados.referenciaExterna="X";},
  x=>{x.dados.motivo="curto";},
  x=>{x.dados.saldoRestanteBrutoEsperado="120.01";}
 ]){const v=fixture();change(v);
  assert.throws(()=>validarDeclaracaoDevolucaoM522(v),/M522_/);}
});
test("M522 partials accumulate exactly to gross, never past the remainder",()=>{
 const first=conferirLimiteAcumuladoM522({
  bruto:"120.00",novoValor:"20.00",
  saldoRestanteBrutoEsperado:"120.00"
 });
 assert.equal(first.restanteDepois,"100.00");
 const next=conferirLimiteAcumuladoM522({
  bruto:"120.00",anteriores:[{referenciaExterna:"CLIENT-REFUND-1",
   valorBruto:"20.00",confirmacaoHumanaExterna:true}],
  novoValor:"100.00",saldoRestanteBrutoEsperado:"100.00"
 });
 assert.equal(next.restanteDepois,"0.00");
 for(const params of [
  {novoValor:"100.01",saldoRestanteBrutoEsperado:"100.00"},
  {novoValor:"1.00",saldoRestanteBrutoEsperado:"120.00"},
  {novoValor:"0.00",saldoRestanteBrutoEsperado:"100.00"},
  {novoValor:"1e4",saldoRestanteBrutoEsperado:"100.00"}
 ])assert.throws(()=>conferirLimiteAcumuladoM522({
  bruto:"120.00",anteriores:[{referenciaExterna:"CLIENT-REFUND-1",
   valorBruto:"20.00",confirmacaoHumanaExterna:true}],...params}),/M522_/);
});
test("M522 duplicate references or unaudited prior rows fail closed",()=>{
 assert.throws(()=>conferirLimiteAcumuladoM522({
  bruto:"120.00",saldoRestanteBrutoEsperado:"100.00",
  novoValor:"5.00",anteriores:[
   {referenciaExterna:"CLIENT-REFUND-1",valorBruto:"10.00",confirmacaoHumanaExterna:true},
   {referenciaExterna:"CLIENT-REFUND-1",valorBruto:"10.00",confirmacaoHumanaExterna:true}
  ]}),/M522_HISTORICO_INVALIDO/);
});
