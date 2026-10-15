import {test} from "node:test";
import assert from "node:assert/strict";
import {discriminarTarifasAntecipacoesM520 as calc} from "../src/modules/pdv/pdv-unificado-discriminacao-tarifas.contract.js";
const base=()=>({empresaId:"empresa-A",comandaId:"cmd-A",fluxo:{
 fase:"M5_16_FLUXO_OPERACIONAL_READ_ONLY",leituraSomente:true,
 integracaoBancaria:false,checkoutDisponivel:false,
 preparacoes:[
  {preparacaoId:"p-1",empresaId:"empresa-A",comandaId:"cmd-A",
   tipo:"REPASSE_NORMAL",valorBruto:"60.00",tarifaCartao:"1.20",
   descontoAntecipacao:"0.00",valorLiquido:"58.80",
   etapa:"SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA",
   confirmacaoManualInterna:false,correcaoInterna:false,lancamentoId:null,
   revisaoFinanceira:{valorLiquidoEsperado:"58.80",
    etapaRevisada:"SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA",habilitaCheckout:false}},
  {preparacaoId:"p-2",empresaId:"empresa-A",comandaId:"cmd-A",
   tipo:"ANTECIPACAO",valorBruto:"120.00",tarifaCartao:"2.40",
   descontoAntecipacao:"4.10",valorLiquido:"113.50",
   etapa:"REPASSE_INTERNO_CONFIRMADO_MANUALMENTE",
   confirmacaoManualInterna:true,correcaoInterna:false,lancamentoId:"ledger-2",
   revisaoFinanceira:{valorLiquidoEsperado:"113.50",
    etapaRevisada:"REPASSE_INTERNO_CONFIRMADO_MANUALMENTE",habilitaCheckout:false}}
 ]}});
test("M.5.20 fees and early discount remain disclosed, never paid expenses",()=>{
 const r=calc(base());
 assert.deepEqual(r.preparacoes,{bruto:"180.00",tarifasInformadas:"3.60",
  descontosAntecipacaoInformados:"4.10",liquidoPrevisto:"172.30"});
 assert.deepEqual(r.repassesAtivos,{brutoCorrespondente:"120.00",
  tarifasInformadas:"2.40",descontosAntecipacaoInformados:"4.10",
  liquidoNoSaldoInterno:"113.50"});
 assert.equal(r.movimentosInternos.efeitoLiquido,"113.50");
 assert.deepEqual(r.quantidade,{aguardando:1,ativo:1,corrigido:0});
 for(const field of ["tarifasSaoDespesasPagas","antecipacoesSaoDespesasPagas",
  "creditoBancarioVerificadoAutomaticamente","receitasNovasReconhecidas",
  "alteraCaixaOuTitulo","alteraSaldoInterno","geraLancamentoContabil",
  "autorizaEstornoReal","autorizaCheckout"])assert.equal(r[field],false);
});
test("M.5.20 full correction offsets internal entry and associated fee disclosure",()=>{
 const x=base();x.fluxo.preparacoes[1]={
  ...x.fluxo.preparacoes[1],etapa:"CORRECAO_INTERNA_REGISTRADA",
  correcaoInterna:true,
  revisaoFinanceira:{valorLiquidoEsperado:"113.50",
   etapaRevisada:"CORRECAO_INTERNA_REGISTRADA",habilitaCheckout:false}
 };
 const r=calc(x);
 assert.deepEqual(r.movimentosInternos,{
  entradasLiquidas:"113.50",correcoesLiquidas:"113.50",efeitoLiquido:"0.00"});
 assert.equal(r.repassesAtivos.tarifasInformadas,"0.00");
 assert.equal(r.repassesAtivos.descontosAntecipacaoInformados,"0.00");
 assert.equal(r.preparacoes.tarifasInformadas,"3.60");
 assert.deepEqual(r.quantidade,{aguardando:1,ativo:0,corrigido:1});
});
test("M.5.20 rejects stale/tenant-crossed/duplicate/truncated reports",()=>{
 const mutators=[
  x=>{x.fluxo.leituraSomente=false;},
  x=>{x.fluxo.preparacoes[0].empresaId="empresa-B";},
  x=>{x.fluxo.preparacoes[0].comandaId="cmd-B";},
  x=>{x.fluxo.preparacoes[0].tipo="ANTECIPACAO";},
  x=>{x.fluxo.preparacoes[1].descontoAntecipacao="4.11";},
  x=>{x.fluxo.preparacoes[0].valorBruto="60.01";},
  x=>{x.fluxo.preparacoes[0].valorLiquido="58.79";},
  x=>{x.fluxo.preparacoes[1].lancamentoId=null;},
  x=>{x.fluxo.preparacoes[0].lancamentoId="forged";},
  x=>{x.fluxo.preparacoes[0].etapa="CORRECAO_INTERNA_REGISTRADA";},
  x=>{x.fluxo.preparacoes.push(x.fluxo.preparacoes[0]);},
  x=>{x.fluxo.preparacoes[0].tarifaCartao="1e2";},
  x=>{x.fluxo.preparacoes[0].valorLiquido="0.00";}
 ];
 for(const m of mutators){const x=base();m(x);
  assert.throws(()=>calc(x),/M520_/,JSON.stringify(x));}
});
test("M.5.20 empty company history is zero and does not unlock checkout",()=>{
 const x=base();x.fluxo.preparacoes=[];
 const r=calc(x);
 assert.equal(r.movimentosInternos.efeitoLiquido,"0.00");
 assert.equal(r.autorizaCheckout,false);
});
