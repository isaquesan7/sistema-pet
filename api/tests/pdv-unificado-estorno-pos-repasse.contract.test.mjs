import {test} from "node:test";
import assert from "node:assert/strict";
import {planejarDevolucaoAposRepasseM521 as plan,
 simularDevolucaoAposRepasseM521 as sim} from "../src/modules/pdv/pdv-unificado-estorno-pos-repasse.contract.js";
const s="a".repeat(64);
const sample=()=>({organizacaoId:"org",empresaId:"co",comandaId:"cmd",
 fluxo:{fase:"M5_16_FLUXO_OPERACIONAL_READ_ONLY",
  leituraSomente:true,integracaoBancaria:false,checkoutDisponivel:false,
  preparacoes:[{preparacaoId:"pre",empresaId:"co",comandaId:"cmd",
   etapa:"REPASSE_INTERNO_CONFIRMADO_MANUALMENTE",tipo:"ANTECIPACAO",
   valorBruto:"120.00",tarifaCartao:"2.40",descontoAntecipacao:"4.10",
   valorLiquido:"113.50",referenciaExtrato:"EXTRATO-EXTERNO",
   confirmacaoManualInterna:true,correcaoInterna:false,lancamentoId:"ledger",
   revisaoFinanceira:{codigoRevisao:s,valorLiquidoEsperado:"113.50",
    etapaRevisada:"REPASSE_INTERNO_CONFIRMADO_MANUALMENTE",habilitaCheckout:false}
  }]}});
const simulate=(p=plan(sample()),changes={})=>sim({
 plano:p,preparacaoId:"pre",codigoRevisaoVisto:s,
 valorBrutoDevolucaoProposto:"120.00",confirmouValoresSaoHipoteses:true,
 ...changes
});
test("M.5.21 full refund with no confirmed fee recovery is not a bank action",()=>{
 const r=simulate();
 assert.equal(r.modalidade,"INTEGRAL_HIPOTETICA");
 assert.equal(r.saidaAoClienteHipotetica,"120.00");
 assert.equal(r.exposicaoHipoteticaSeRecuperacoesOcorrerem,"120.00");
 for(const k of ["executouReembolso","alterouSaldoInterno","registrouDespesa",
 "emitiuNotaDeEstorno","gerouConciliacao","integracaoBancaria",
 "recuperacoesEfetivamenteRecebidas","autorizaCheckout"])assert.equal(r[k],false);
});
test("M.5.21 hypothetical fee recovery is separated, never marked received",()=>{
 const r=simulate(undefined,{recuperacaoTarifaHipotetica:"2.40",
  recuperacaoAntecipacaoHipotetica:"4.10"});
 assert.equal(r.exposicaoHipoteticaSeRecuperacoesOcorrerem,"113.50");
 assert.equal(r.retornoHipoteticoDeTarifa,"2.40");
 assert.equal(r.retornoHipoteticoDeAntecipacao,"4.10");
 assert.equal(r.recuperacoesEfetivamenteRecebidas,false);
 const partial=simulate(undefined,{valorBrutoDevolucaoProposto:"20.00",
  recuperacaoTarifaHipotetica:"1.00"});
 assert.equal(partial.modalidade,"PARCIAL_HIPOTETICA");
 assert.equal(partial.exposicaoHipoteticaSeRecuperacoesOcorrerem,"19.00");
});
test("M.5.21 original correction != customer refund; stale and pending blocked",()=>{
 const b=sample();
 b.fluxo.preparacoes[0].etapa="CORRECAO_INTERNA_REGISTRADA";
 b.fluxo.preparacoes[0].correcaoInterna=true;
 b.fluxo.preparacoes[0].revisaoFinanceira.etapaRevisada="CORRECAO_INTERNA_REGISTRADA";
 const p=plan(b);
 assert.equal(p.preparacoes[0].podeSimularDevolucao,false);
 assert.equal(p.preparacoes[0].contralancamentoM514EquivaleAReembolso,false);
 assert.throws(()=>simulate(p),/M521_REPASSE_NAO_ELEGIVEL/);
 const other=sample();
 other.fluxo.preparacoes[0].etapa="AGUARDANDO_SEGUNDA_CONFERENCIA";
 other.fluxo.preparacoes[0].confirmacaoManualInterna=false;
 other.fluxo.preparacoes[0].lancamentoId=null;
 other.fluxo.preparacoes[0].revisaoFinanceira.etapaRevisada="AGUARDANDO_SEGUNDA_CONFERENCIA";
 assert.equal(plan(other).preparacoes[0].podeSimularDevolucao,false);
});
test("M.5.21 rejects double-count risks and unapproved assumptions",()=>{
 const failed=[
  {codigoRevisaoVisto:"b".repeat(64)},
  {valorBrutoDevolucaoProposto:"120.01"},
  {valorBrutoDevolucaoProposto:"0.00"},
  {valorBrutoDevolucaoProposto:"120,00"},
  {valorBrutoDevolucaoProposto:"1e3"},
  {recuperacaoTarifaHipotetica:"2.41"},
  {recuperacaoAntecipacaoHipotetica:"4.11"},
  {valorBrutoDevolucaoProposto:"2.00",recuperacaoTarifaHipotetica:"2.40"},
  {confirmouValoresSaoHipoteses:false}
 ];
 for(const x of failed)assert.throws(()=>simulate(undefined,x),/M521_/);
 for(const mutation of [
  b=>{b.empresaId="another";},
  b=>{b.fluxo.preparacoes[0].comandaId="other";},
  b=>{b.fluxo.preparacoes[0].tipo="REPASSE_NORMAL";},
  b=>{b.fluxo.preparacoes[0].valorLiquido="113.49";},
  b=>{b.fluxo.preparacoes[0].revisaoFinanceira.codigoRevisao="bogus";},
  b=>{b.fluxo.preparacoes.push(b.fluxo.preparacoes[0]);}
 ]){const b=sample();mutation(b);assert.throws(()=>plan(b),/M521_/);}
});
