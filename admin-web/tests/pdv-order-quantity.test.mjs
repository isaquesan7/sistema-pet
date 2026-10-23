/** M.5.71 — regressão de quantidades no balcao e nos rascunhos.
 * Adaptado do planejamento da PR #36 ao contrato mais recente da PR #38. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isValidPdvQuantity,sanitizePdvQuantity,stepPdvQuantity} from "../src/lib/pdvQuantity.js";
import {buildUnifiedDraftPayload} from "../src/lib/unifiedDraft.js";
const source=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const service={tipo:"SERVICO"},product={tipo:"PRODUTO"};

test("servico exige inteiro positivo e nao e convertido silenciosamente",()=>{
 for(const qty of [1,2,3,200])assert.equal(isValidPdvQuantity(service,qty),true);
 for(const qty of [0,-1,0.001,0.5,1.5,2.25,NaN,Infinity,"abc"]){
  assert.equal(isValidPdvQuantity(service,qty),false,String(qty));
  assert.equal(sanitizePdvQuantity(service,qty,3),3);
 }
 assert.equal(stepPdvQuantity(service,1,-1),1);
 assert.equal(stepPdvQuantity(service,1,1),2);
});

test("granel mantem precisao 0,001 sem arredondar servicos",()=>{
 assert.equal(isValidPdvQuantity(product,0.333),true);
 assert.equal(sanitizePdvQuantity(product,0.333),0.333);
 assert.equal(stepPdvQuantity(product,1,-1),0.001);
});

test("rascunho falha antes do HTTP se quantidade ou pet/tutor de servico estiver invalido",()=>{
 const linha={tipo:"SERVICO",empresaId:"c1",itemCatalogoId:"s1",petId:"p1",quantidade:1};
 assert.equal(buildUnifiedDraftPayload("t1",[linha]).itens[0].quantidade,1);
 assert.throws(()=>buildUnifiedDraftPayload("t1",[{...linha,quantidade:1.5}]),/inteiras/);
 assert.throws(()=>buildUnifiedDraftPayload("t1",[{...linha,petId:null}]),/pet/);
 assert.throws(()=>buildUnifiedDraftPayload(null,[linha]),/Tutor/);
 assert.equal(buildUnifiedDraftPayload(null,[{...linha,tipo:"PRODUTO",petId:null,quantidade:0.333}]).itens[0].quantidade,0.333);
});

test("o workspace usa quantidades por tipo sem maquininha ou banco",()=>{
 const page=source("../src/pages/PdvPage.jsx"),unified=source("../src/pages/UnifiedPdvPreviewPage.jsx");
 assert.match(page,/useState\("COMANDAS"\)/);
 assert.match(page,/sanitizePdvQuantity\(selectedCommandItem,event.target.value,commandQuantity\)/);
 assert.match(page,/serviceNeedsTutorAndPet\(selectedCommandItem\)/);
 assert.match(unified,/stepPdvQuantity\(row,row.quantidade,-1\)/);
 assert.match(unified,/sanitizePdvQuantity\(row,e.target.value,row.quantidade\)/);
});
