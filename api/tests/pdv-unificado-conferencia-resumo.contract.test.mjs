import {test} from "node:test";
import assert from "node:assert/strict";
import {resumirMovimentosManuaisM515} from "../src/modules/pdv/pdv-unificado-conferencia-resumo.contract.js";
const orig=()=>({id:"incoming-1",preparacaoId:"prep-A",empresaId:"empresa-A",
 comandaId:"comanda-A",origemLancamentoId:null,contaFinanceiraId:"account-A",
 tipo:"REPASSE_CONFIRMADO_MANUALMENTE",direcao:"ENTRADA",
 valor:"58.80",possuiCorrecao:false});
const out=()=>({id:"outgoing-1",preparacaoId:"prep-A",empresaId:"empresa-A",
 comandaId:"comanda-A",origemLancamentoId:"incoming-1",contaFinanceiraId:"account-A",
 tipo:"CORRECAO_MANUAL",direcao:"SAIDA",
 valor:"58.80",possuiCorrecao:false});
const summary=movimentos=>resumirMovimentosManuaisM515({
 empresaId:"empresa-A",comandaId:"comanda-A",movimentos});
test("M.5.15 pending/manual net posting is distinct from revenue and real bank",()=>{
 const r=summary([orig()]);
 assert.deepEqual([r.entradaLiquidaDeclarada,r.correcoesLiquidas,r.efeitoLiquidoNoSaldoInterno],
  ["58.80","0.00","58.80"]);
 for(const k of ["ehSaldoBancarioReal","ehReceitaNova","confirmacaoAutomaticaBanco",
 "atualizarConta","executarCheckout","podeConfirmarPelaInterface",
 "podeCorrigirPelaInterface"])assert.equal(r[k],false,k);
});
test("M.5.15 full compensating reversal yields zero internal balance effect",()=>{
 const r=summary([out(),{...orig(),possuiCorrecao:true}]);
 assert.equal(r.quantidadeEntradas,1);assert.equal(r.quantidadeCorrecoes,1);
 assert.equal(r.entradaLiquidaDeclarada,"58.80");
 assert.equal(r.correcoesLiquidas,"58.80");
 assert.equal(r.efeitoLiquidoNoSaldoInterno,"0.00");
});
test("M.5.15 empty company history is zero without falsely approving anything",()=>{
 const r=summary([]);
 assert.equal(r.efeitoLiquidoNoSaldoInterno,"0.00");
 assert.equal(r.podeConfirmarPelaInterface,false);
});
test("M.5.15 incomplete/cross-tenant/duplicated or partial movement histories fail closed",()=>{
 const broken=[
  [out()],
  [orig(),orig()],
  [orig(),{...out(),empresaId:"empresa-B"}],
  [orig(),{...out(),valor:"57.80"}],
  [orig(),{...out(),contaFinanceiraId:"other-bank"}],
  [orig(),{...out(),origemLancamentoId:"orphan"}],
  [{...orig(),possuiCorrecao:true}],
  [orig(),out()],
  [{...orig(),possuiCorrecao:true},out(),{...out(),id:"second-out"}],
  [{...orig(),direcao:"SAIDA"}],
  [{...orig(),valor:"1e2"}],
  [{...orig(),valor:"0.00"}],
  [{...orig(),tipo:"PSP_AUTOMATICO"}],
  [{...orig(),comandaId:"comanda-B"}],
  [{...orig(),valor:"99999999999999999.00"}],
 ];
 for(const data of broken)assert.throws(()=>summary(data),/M515_/,JSON.stringify(data));
});
