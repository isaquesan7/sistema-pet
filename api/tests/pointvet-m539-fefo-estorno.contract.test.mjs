/** PointVet M.5.39 — reversão grama a grama dos lotes FEFO. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {conferirCompensacoesEstoquePorLote}
 from "../src/modules/pdv/pdv-unificado-estorno-manual.contract.js";

const origem=[
 {id:"saida-125",empresaId:"loja",produtoId:"racao",loteId:"primeiro",quantidade:"0.125"},
 {id:"saida-208",empresaId:"loja",produtoId:"racao",loteId:"segundo",quantidade:"0.208"}
];
const compensar=m=>({empresaId:m.empresaId,produtoId:m.produtoId,loteId:m.loteId,
 quantidade:m.quantidade,observacao:`Compensa movimento ${m.id}`});

test("333 g em dois lotes precisam ter exatamente uma compensação por baixa",()=>{
 assert.equal(conferirCompensacoesEstoquePorLote(origem,origem.map(compensar)),true);
 assert.equal(conferirCompensacoesEstoquePorLote([],[]),true);
 assert.throws(()=>conferirCompensacoesEstoquePorLote(origem,[compensar(origem[0])]),
  /M3C_REPLAY_INCONSISTENTE/);
 assert.throws(()=>conferirCompensacoesEstoquePorLote(origem,[compensar(origem[0]),compensar(origem[0])]),
  /M3C_REPLAY_INCONSISTENTE/);
});

test("troca de lote, produto, empresa, quantidade ou referência invalida o replay",()=>{
 const [primeira,segunda]=origem.map(compensar);
 for(const altered of [
  {...segunda,loteId:"primeiro"},
  {...segunda,produtoId:"outra-racao"},
  {...segunda,empresaId:"outra-loja"},
  {...segunda,quantidade:"0.207"},
  {...segunda,observacao:"Compensa movimento desconhecido"},
  {...segunda,observacao:"Ajuste manual"}
 ]){
  assert.throws(()=>conferirCompensacoesEstoquePorLote(origem,[primeira,altered]),
   /M3C_REPLAY_INCONSISTENTE/);
 }
});
