/** M.5.71 — quantidade e início do atendimento por comandas. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isValidPdvQuantity,normalizePdvQuantity,stepPdvQuantity} from "../src/lib/pdvQuantity.js";
import {buildUnifiedDraftPayload} from "../src/lib/unifiedDraft.js";
const code=file=>readFileSync(new URL(file,import.meta.url),"utf8");

test("serviços exigem inteiros >= 1 em todos os controles",()=>{
 for(const value of [1,2,3,200]) assert.equal(isValidPdvQuantity("SERVICO",value),true);
 for(const value of [0,-1,0.001,0.5,1.5,2.25,NaN,Infinity,"abc"]) assert.equal(isValidPdvQuantity("SERVICO",value),false);
 assert.equal(normalizePdvQuantity("SERVICO",0.5,3),3);
 assert.equal(normalizePdvQuantity("SERVICO",2.7,1),1);
 assert.equal(stepPdvQuantity("SERVICO",1,-1),1);
 assert.equal(stepPdvQuantity("SERVICO",1,1),2);
});

test("produtos a granel continuam permitindo frações",()=>{
 assert.equal(isValidPdvQuantity("PRODUTO",0.333),true);
 assert.equal(normalizePdvQuantity("PRODUTO",0.333),0.333);
 assert.equal(stepPdvQuantity("PRODUTO",1,-1),0.001);
});

test("rascunho multiempresa recusa serviço sem pet e quantidade fracionada antes da API",()=>{
 const servico={tipo:"SERVICO",empresaId:"e1",itemCatalogoId:"i1",petId:"p1",quantidade:1};
 assert.equal(buildUnifiedDraftPayload("c1",[servico]).itens[0].quantidade,1);
 assert.throws(()=>buildUnifiedDraftPayload("c1",[{...servico,quantidade:1.5}]),/inteiras/);
 assert.throws(()=>buildUnifiedDraftPayload("c1",[{...servico,petId:null}]),/pet/);
 assert.equal(buildUnifiedDraftPayload("c1",[{...servico,tipo:"PRODUTO",petId:null,quantidade:0.333}]).itens[0].quantidade,0.333);
});

test("modo tradicional começa pela central e valida tutor e pet antes do fechamento",()=>{
 const page=code("../src/pages/PdvPage.jsx");
 assert.match(page,/useState\("COMANDAS"\)/);
 assert.match(page,/isValidPdvQuantity\(line.item.tipo,line.quantidade\)/);
 assert.match(page,/line.item.tipo === "SERVICO"\) && !clientId/);
 assert.match(page,/line.item.tipo === "SERVICO" && !line.petId/);
 assert.match(page,/min=\{line.item.tipo === "SERVICO" \? 1 : 0.001\}/);
 const unified=code("../src/pages/UnifiedPdvPreviewPage.jsx");
 assert.match(unified,/stepPdvQuantity\(row.tipo,row.quantidade,-1\)/);
 assert.match(unified,/normalizePdvQuantity\(row.tipo,e.target.value,row.quantidade\)/);
});
