/** M.5.71 — PDV primeiro por comandas e quantidade de serviços. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isValidPdvQuantity,sanitizePdvQuantity,stepPdvQuantity,serviceNeedsTutorAndPet} from "../src/lib/pdvQuantity.js";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const page=read("../src/pages/PdvPage.jsx"),home=read("../src/components/PdvOrdersHome.jsx"),unified=read("../src/pages/UnifiedPdvPreviewPage.jsx");
test("serviços só permitem números inteiros positivos, sem arredondar fraude",()=>{
 const service={tipo:"SERVICO"},bulk={tipo:"PRODUTO"};
 for(const invalid of [-3,0,0.5,1.5,2.001,NaN,Infinity]){
  assert.equal(isValidPdvQuantity(service,invalid),false,String(invalid));
  assert.equal(sanitizePdvQuantity(service,invalid,2),2);
 }
 for(const valid of [1,2,3,15])assert.equal(sanitizePdvQuantity(service,valid),valid);
 assert.equal(stepPdvQuantity(service,1,-1),1);
 assert.equal(stepPdvQuantity(service,2,-1),1);
 assert.equal(stepPdvQuantity(service,2,1),3);
 assert.equal(isValidPdvQuantity(bulk,0.333),true);
 assert.equal(sanitizePdvQuantity(bulk,0.333),0.333);
 assert.equal(serviceNeedsTutorAndPet(service),true);
 assert.equal(serviceNeedsTutorAndPet(bulk),false);
});
test("entrada do PDV é a central de comandas com abertura lateral e categorias",()=>{
 assert.match(page,/useState\("COMANDAS"\)/);
 assert.match(page,/<PdvOrdersHome/);
 assert.match(home,/Em aberto/);
 assert.match(home,/Fechadas hoje/);
 assert.match(home,/Orçamentos/);
 assert.match(home,/Abrir nova comanda/);
 assert.match(home,/Tutor \(opcional para produtos\)/);
 assert.match(home,/Pet \(obrigatório apenas para serviços\)/);
 assert.match(page,/pdv-order-workspace/);
 assert.match(page,/Voltar às comandas/);
});
test("comanda lançada exige tutor e pet para serviço e quantidade configurável",()=>{
 assert.match(page,/serviceNeedsTutorAndPet\(selectedCommandItem\)/);
 assert.match(page,/Quantidade a lançar na comanda/);
 assert.match(page,/quantidade: commandQuantity/);
 assert.match(page,/petId: item\?\.tipo === "SERVICO"/);
 assert.match(page,/\(!commandClient\?\.id\|\|!commandPetId\)/);
 assert.match(unified,/stepPdvQuantity\(row,row.quantidade,-1\)/);
 assert.match(unified,/sanitizePdvQuantity\(row,e.target.value,row.quantidade\)/);
 assert.match(unified,/min=\{row.tipo==="SERVICO"\?"1":"0.001"\}/);
});
test("histórico e rascunho multiempresa são consultados pela central",()=>{
 assert.match(page,/\["pdv-unified-order-list",selectedOrganization\?\.id,selectedCompany\?\.id\]/);
 assert.match(page,/onOpenDraft=\{draft=>/);
 assert.match(page,/openDraftId=\{unifiedDraftToOpen\}/);
 assert.match(unified,/restoredId.current=openDraftId;reopen\(saved\)/);
 assert.match(home,/kind:"COMANDA"/);
 assert.match(home,/kind:"UNIFICADA"/);
 assert.match(home,/kind:"VENDA"/);
});
