import {test} from "node:test";
import assert from "node:assert/strict";
import {planejarIntencoesManuaisM517,simularIntencaoManualM517} from "../src/modules/pdv/pdv-unificado-intencao-manual.contract.js";
import {gerarReferenciaRevisaoManualM519} from "../src/modules/pdv/pdv-unificado-revisao-financeira.contract.js";
const prep=()=>({preparacaoId:"prep-1",empresaId:"empresa-A",comandaId:"comanda-A",
 etapa:"SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA",
 referenciaExtrato:"EXTRATO-REPASSE-20261015",valorBruto:"60.00",
 tarifaCartao:"1.20",descontoAntecipacao:"0.00",valorLiquido:"58.80",
 segundaConferenciaDocumental:true,confirmacaoManualInterna:false,
 correcaoInterna:false,lancamentoId:null});
const base=()=>({organizacaoId:"org-A",empresaId:"empresa-A",comandaId:"comanda-A",
 fluxo:{fase:"M5_16_FLUXO_OPERACIONAL_READ_ONLY",
 leituraSomente:true,checkoutDisponivel:false,integracaoBancaria:false,
 preparacoes:[prep()]}});
const plan=(data=base())=>{
 // Attach a genuine server-shaped M.5.19 revision; no client-side guessing
 // occurs in production (API gets it from the authoritative DB).
 for(const p of data.fluxo.preparacoes){
  p.contaFinanceiraId="conta-A";
  p.revisaoFinanceira=gerarReferenciaRevisaoManualM519({
   organizacaoId:data.organizacaoId,empresaId:data.empresaId,
   comandaId:data.comandaId,preparacaoId:p.preparacaoId,etapa:p.etapa,
   fingerprintPreparacao:"a".repeat(64),
   fingerprintParecer:p.etapa==="AGUARDANDO_SEGUNDA_CONFERENCIA"?null:"b".repeat(64),
   contaFinanceiraId:p.contaFinanceiraId,valorLiquido:p.valorLiquido,
   lancamentoOriginalId:p.lancamentoId||null
  });
 }
 return planejarIntencoesManuaisM517(data);
};
test("M.5.17 plans local only confirmation and simulated explicit human statement",()=>{
 const p=plan();
 assert.equal(p.planos[0].operacaoSimulavel,"SIMULAR_CONFIRMACAO");
 assert.equal(p.planos[0].revisaoFinanceira.codigoRevisao.length,64);
 const r=simularIntencaoManualM517({planejamento:p,preparacaoId:"prep-1",
  operacao:"SIMULAR_CONFIRMACAO",referencia:"EXTRATO-REPASSE-20261015",
  valorLiquidoInformado:"58.80",confirmouConsultaExterna:true});
 assert.equal(r.simulacaoValida,true);
 for(const key of ["registrouBanco","registrouCaixa","modificouConciliacaoFinanceira",
 "gerouBaixa","alterouPagamento","emitiuFiscal","permitePublicarCheckout"])
  assert.equal(r[key],false,key);
});
test("M.5.17 correction plan needs different reference, reason and original entry",()=>{
 const b=base();b.fluxo.preparacoes[0]={...prep(),
  etapa:"REPASSE_INTERNO_CONFIRMADO_MANUALMENTE",
  confirmacaoManualInterna:true,lancamentoId:"original-1"};
 const p=plan(b);
 assert.equal(p.planos[0].exigeSegundaPessoaParaCorrecao,true);
 assert.equal(simularIntencaoManualM517({planejamento:p,preparacaoId:"prep-1",
  operacao:"SIMULAR_CORRECAO",referencia:"CORRECAO-20261015",
  valorLiquidoInformado:"58.80",confirmouConsultaExterna:true,
  motivo:"Correção manual aprovada após conferência externa"}).registrouBanco,false);
 assert.throws(()=>simularIntencaoManualM517({planejamento:p,preparacaoId:"prep-1",
  operacao:"SIMULAR_CORRECAO",referencia:"EXTRATO-REPASSE-20261015",
  valorLiquidoInformado:"58.80",confirmouConsultaExterna:true,motivo:"Motivo suficiente"}),/M517_/);
});
test("M.5.17 fails closed for stale, wrong tenant, pending review and bad amounts",()=>{
 const mutations=[
  b=>{b.fluxo.preparacoes[0].empresaId="empresa-B";},
  b=>{b.fluxo.preparacoes[0].valorLiquido="59.00";},
  b=>{b.fluxo.preparacoes[0].etapa="REPASSE_INTERNO_CONFIRMADO_MANUALMENTE";},
  b=>{b.fluxo.preparacoes.push({...prep()});},
  b=>{b.fluxo.leituraSomente=false;}
 ];
 for(const m of mutations){const b=base();m(b);assert.throws(()=>plan(b),/M517_/);}
 const b=base();b.fluxo.preparacoes[0].etapa="AGUARDANDO_SEGUNDA_CONFERENCIA";
 b.fluxo.preparacoes[0].segundaConferenciaDocumental=false;
 const pending=plan(b);
 assert.equal(pending.planos[0].operacaoSimulavel,null);
 assert.throws(()=>simularIntencaoManualM517({planejamento:pending,
  preparacaoId:"prep-1",operacao:"SIMULAR_CONFIRMACAO",
  referencia:"EXTRATO-REPASSE-20261015",valorLiquidoInformado:"58.80",
  confirmouConsultaExterna:true}),/M517_/);
 const p=plan();
 for(const mutation of [
  {confirmouConsultaExterna:false},
  {referencia:"WRONG-REFERENCE"},
  {valorLiquidoInformado:"58.81"},
  {valorLiquidoInformado:"58,80"},
  {valorLiquidoInformado:"1e4"}
 ])assert.throws(()=>simularIntencaoManualM517({planejamento:p,
  preparacaoId:"prep-1",operacao:"SIMULAR_CONFIRMACAO",
  referencia:"EXTRATO-REPASSE-20261015",valorLiquidoInformado:"58.80",
  confirmouConsultaExterna:true,...mutation}),/M517_/);
});
