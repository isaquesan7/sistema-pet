import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildUnifiedDraftPayload} from "../src/lib/unifiedDraft.js";

test("simulation and draft share the API field clienteId from selected clientId",()=>{
 const input=[
  {empresaId:"loja",itemCatalogoId:"racao",quantidade:0.333,petId:""},
  {empresaId:"banho",itemCatalogoId:"servico",quantidade:1,petId:"pet-de-teste"}
 ];
 const payload=buildUnifiedDraftPayload("tutor-homologacao",input);
 assert.deepEqual(payload,{
  clienteId:"tutor-homologacao",
  itens:[
   {empresaId:"loja",itemCatalogoId:"racao",quantidade:0.333,petId:null},
   {empresaId:"banho",itemCatalogoId:"servico",quantidade:1,petId:"pet-de-teste"}
  ]
 });
 assert.equal(Object.hasOwn(payload,"clientId"),false);
});

test("missing client selection fails locally with actionable message",()=>{
 for(const value of ["", "  ", null, undefined]){
  assert.throws(()=>buildUnifiedDraftPayload(value,[]),/Selecione um cliente/);
 }
});

test("both UI actions use the shared client payload instead of an undefined shorthand",()=>{
 const page=readFileSync(new URL("../src/pages/UnifiedPdvPreviewPage.jsx",import.meta.url),"utf8");
 assert.equal((page.match(/buildUnifiedDraftPayload\(clientId,lines\)/g)||[]).length,2);
 assert.doesNotMatch(page,/\{\s*clienteId\s*,\s*itens\s*:/);
});
