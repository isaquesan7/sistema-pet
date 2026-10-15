import {test} from "node:test";
import assert from "node:assert/strict";
import {projetarEtapasRepassesM516} from "../src/modules/pdv/pdv-unificado-fluxo-operacional.contract.js";
const base=()=>({organizacaoId:"org-A",empresaId:"empresa-A",comandaId:"comanda-A",
 preparacoes:[{id:"prep-A",organizacaoId:"org-A",empresaId:"empresa-A",
  comandaId:"comanda-A",usuarioId:"maker-A",contaFinanceiraId:"conta-A",
  referenciaExtrato:"REF-EXTRATO-A",dataCredito:"2026-10-15",
  fingerprint:"a".repeat(64),status:"PREPARADA_SEM_BAIXA",
  tipo:"REPASSE_NORMAL",bruto:"60.00",tarifaCartao:"1.20",
  descontoAntecipacao:"0.00",liquidoDeclarado:"58.80",parecerDocumental:null}],
 entradas:[],correcoes:[]});
const review=()=>({preparacaoId:"prep-A",empresaId:"empresa-A",organizacaoId:"org-A",
 conferenteId:"second-A",status:"CONFERENCIA_DOCUMENTAL_DECLARADA"});
const entry=()=>({id:"in-A",origemId:"prep-A",empresaId:"empresa-A",
 contaFinanceiraId:"conta-A",origem:"REPASSE_CARTAO_MANUAL_UNIFICADO",
 direcao:"ENTRADA",valor:"58.80",usuarioId:"maker-A"});
const correction=()=>({id:"out-A",origemId:"in-A",empresaId:"empresa-A",
 contaFinanceiraId:"conta-A",origem:"ESTORNO_REPASSE_CARTAO_MANUAL_UNIFICADO",
 direcao:"SAIDA",valor:"58.80",usuarioId:"second-A"});
test("M.5.16 shows the four operational steps without granting bank access",()=>{
 const a=base();
 for(const stage of ["AGUARDANDO_SEGUNDA_CONFERENCIA",
  "SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA",
  "REPASSE_INTERNO_CONFIRMADO_MANUALMENTE","CORRECAO_INTERNA_REGISTRADA"]){
  const result=projetarEtapasRepassesM516(a);
  assert.equal(result.preparacoes[0].etapa,stage);
  assert.equal(result.preparacoes[0].valorLiquido,"58.80");
  for(const k of ["integracaoBancaria","provaBancariaIndependente",
   "permissoesParaEscritaConcedidas","confirmacaoDisponivelNaTela",
   "correcaoDisponivelNaTela","checkoutDisponivel"])assert.equal(result[k],false,k);
  if(stage==="AGUARDANDO_SEGUNDA_CONFERENCIA")a.preparacoes[0].parecerDocumental=review();
  else if(stage==="SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA")a.entradas.push(entry());
  else if(stage==="REPASSE_INTERNO_CONFIRMADO_MANUALMENTE")a.correcoes.push(correction());
 }
});
test("M.5.16 rejects cross-tenant and inconsistent/duplicated amounts",()=>{
 const mutate=[
  x=>{x.preparacoes[0].empresaId="empresa-B";},
  x=>{x.preparacoes[0].tarifaCartao="1.50";},
  x=>{x.preparacoes[0].tipo="ANTECIPACAO";},
  x=>{x.preparacoes.push({...x.preparacoes[0]});},
  x=>{x.preparacoes[0].parecerDocumental={...review(),conferenteId:"maker-A"};},
  x=>{x.entradas.push(entry());},
  x=>{x.preparacoes[0].parecerDocumental=review();x.entradas.push({...entry(),valor:"60.00"});},
  x=>{x.preparacoes[0].parecerDocumental=review();x.entradas.push(entry(),entry());},
  x=>{x.preparacoes[0].parecerDocumental=review();x.entradas.push(entry());x.correcoes.push({...correction(),empresaId:"empresa-B"});},
  x=>{x.preparacoes[0].parecerDocumental=review();x.entradas.push(entry());x.correcoes.push({...correction(),valor:"50.00"});}
 ];
 for(const apply of mutate){const a=base();apply(a);
  assert.throws(()=>projetarEtapasRepassesM516(a),/M516_/);
 }
});
test("M.5.16 zero preparations never authorizes any action",()=>{
 const x=base();x.preparacoes=[];
 const r=projetarEtapasRepassesM516(x);
 assert.equal(r.quantidade,0);assert.equal(r.checkoutDisponivel,false);
});
