import {test} from "node:test";
import assert from "node:assert/strict";
import {planejarBaixaCartaoM59} from "../src/modules/pdv/pdv-unificado-baixa-cartao.contract.js";
const resume=()=>({fase:"M5_6_RESUMO_RECEBIVEIS_CI",
 organizacaoId:"org-A",empresaId:"company-A",comandaId:"comanda-A",
 leituraSomente:true,provaBancariaIndependente:false,linhas:[
  {linhaId:"linha-A",empresaId:"company-A",situacao:"REPASSE_INTEGRAL_DECLARADO",
   parcelas:[{id:"parcela-1",status:"CONCILIADA",valor:"60.00"},
    {id:"parcela-2",status:"CONCILIADA",valor:"60.00"},
    {id:"parcela-3",status:"CONCILIADA",valor:"60.00"}]}
 ]});
const order=()=>({tipo:"REPASSE_NORMAL",contaFinanceiraId:"account-123",
 referenciaExtrato:"BANCO-REF-0001",dataCredito:"2026-10-15",
 parcelaIds:["parcela-1","parcela-2"],tarifaCartao:"2.40",
 descontoAntecipacao:"0.00",valorLiquidoDeclarado:"117.60",
 confirmouConferenciaExterna:true});
test("M.5.9 normal repasse preserves gross, card fees and net, without crediting accounts",()=>{
 const result=planejarBaixaCartaoM59({resumo:resume(),pedido:order()});
 assert.deepEqual(result.valores,{bruto:"120.00",tarifaCartao:"2.40",
  descontoAntecipacao:"0.00",liquidoDeclarado:"117.60"});
 assert.equal(result.parcelas.length,2);
 for(const key of ["verificacaoBancariaIndependente","baixaRealExecutada",
  "registrarTitulo","aprovarPagamento","alterarSaldoBancario","gerarCaixa",
  "registrarConciliacaoFinanceira","permitirEstornoAutomatico",
  "emitirFiscal","autorizarProducao"])assert.equal(result[key],false,key);
 assert.equal(result.fingerprint.length,64);
 const reordered=planejarBaixaCartaoM59({resumo:resume(),
  pedido:{...order(),parcelaIds:["parcela-2","parcela-1"]}});
 assert.equal(result.fingerprint,reordered.fingerprint);
});
test("M.5.9 early settlement accounts for explicit advance discount",()=>{
 const result=planejarBaixaCartaoM59({resumo:resume(),pedido:{
  ...order(),tipo:"ANTECIPACAO",descontoAntecipacao:"4.10",
  valorLiquidoDeclarado:"113.50"
 }});
 assert.equal(result.valores.descontoAntecipacao,"4.10");
 assert.equal(result.valores.liquidoDeclarado,"113.50");
 assert.equal(result.baixaRealExecutada,false);
});
test("M.5.9 invalid money, missing evidence, false balances and forbidden advance fail closed",()=>{
 for(const patch of [
  {confirmouConferenciaExterna:false},
  {contaFinanceiraId:"wrong id"},
  {referenciaExtrato:"abc"},
  {dataCredito:"2026-02-30"},
  {valorLiquidoDeclarado:"120.00"},
  {valorLiquidoDeclarado:"119.00"},
  {valorLiquidoDeclarado:"0"},
  {valorLiquidoDeclarado:"12,00"},
  {valorLiquidoDeclarado:"1e2"},
  {tarifaCartao:"120.00",valorLiquidoDeclarado:"1.00"},
  {tarifaCartao:"-0.05"},
  {descontoAntecipacao:"0.10"},
  {tipo:"ANTECIPACAO"},
  {tipo:"OUTRO"},
  {parcelaIds:["parcela-1","parcela-1"]},
  {parcelaIds:["parcela-3","parcela-other"]},
  {parcelaIds:[]}
 ])assert.throws(()=>planejarBaixaCartaoM59({resumo:resume(),
    pedido:{...order(),...patch}}),/M59_/);
});
test("M.5.9 rejects orphan, unreconciled, reversed and cross-company installments",()=>{
 const changed=resume();
 changed.linhas[0].parcelas[0].status="AGUARDANDO_REPASSE";
 assert.throws(()=>planejarBaixaCartaoM59({resumo:changed,pedido:order()}),
  /M59_PARCELA_SEM_DECLARACAO/);
 changed.linhas[0].parcelas[0].status="ESTORNADA";
 assert.throws(()=>planejarBaixaCartaoM59({resumo:changed,pedido:order()}),
  /M59_PARCELA_ESTORNADA/);
 changed.linhas[0].parcelas[0].status="CONCILIADA";
 changed.linhas[0].empresaId="company-B";
 assert.throws(()=>planejarBaixaCartaoM59({resumo:changed,pedido:order()}),
  /M59_LINHA_INVALIDA/);
 changed.linhas[0].empresaId="company-A";
 changed.linhas[0].parcelas[1].id="parcela-1";
 assert.throws(()=>planejarBaixaCartaoM59({resumo:changed,pedido:order()}),
  /M59_PARCELA_DUPLICADA_NA_ORIGEM/);
});
test("M.5.9 replay is fingerprint stable and sensitive to business terms",()=>{
 const r=planejarBaixaCartaoM59({resumo:resume(),pedido:order()});
 const changed=planejarBaixaCartaoM59({resumo:resume(),pedido:{
  ...order(),referenciaExtrato:"BANCO-REF-0002"
 }});
 assert.notEqual(r.fingerprint,changed.fingerprint);
 const other=resume();other.empresaId="company-B";other.linhas[0].empresaId="company-B";
 assert.notEqual(r.fingerprint,planejarBaixaCartaoM59({resumo:other,pedido:order()}).fingerprint);
});
