import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {addUnifiedCatalogItem,updateUnifiedLine,removeUnifiedLine,rehydrateUnifiedDraft} from "../../admin-web/src/lib/unifiedDraft.js";

const banho={id:"banho",empresaId:"estetica",nome:"Banho",tipo:"SERVICO",precoVenda:70,empresa:{nomeFantasia:"Banho & Tosa"},servico:{exigePet:true}};
const racao={id:"racao",empresaId:"loja",nome:"Ração",tipo:"PRODUTO",precoVenda:180,empresa:{nomeFantasia:"Petshop"}};

test("serviços iguais mantêm linhas separadas para pets diferentes, sem alterar a outra linha",()=>{
 const a=addUnifiedCatalogItem([],banho,"nova:1");
 const b=addUnifiedCatalogItem(a,banho,"nova:2");
 assert.equal(b.length,2);
 assert.deepEqual(b.map(x=>x.lineKey),["nova:1","nova:2"]);
 const withFirst=updateUnifiedLine(b,"nova:1",{petId:"pet-bela"});
 const withBoth=updateUnifiedLine(withFirst,"nova:2",{petId:"pet-tico",quantidade:2});
 assert.deepEqual(withBoth.map(x=>[x.petId,x.quantidade]),[["pet-bela",1],["pet-tico",2]]);
 assert.deepEqual(removeUnifiedLine(withBoth,"nova:1").map(x=>[x.lineKey,x.petId]),[["nova:2","pet-tico"]]);
});

test("produtos repetidos somam quantidade, mas não mesclam linhas de serviços",()=>{
 let lines=addUnifiedCatalogItem([],racao,"nova:1");
 lines=addUnifiedCatalogItem(lines,racao,"nova:2");
 lines=addUnifiedCatalogItem(lines,banho,"nova:3");
 lines=addUnifiedCatalogItem(lines,banho,"nova:4");
 assert.equal(lines.length,3);
 assert.equal(lines[0].quantidade,2);
 assert.equal(lines[0].lineKey,"nova:1");
 assert.deepEqual(lines.slice(1).map(x=>x.lineKey),["nova:3","nova:4"]);
});

test("retomada preserva duas ocorrências do mesmo serviço e suas identidades persistidas",()=>{
 const saved={itens:[
  {id:"persistida-a",itemCatalogoId:"banho",empresaId:"estetica",empresaNome:"Banho & Tosa",descricao:"Banho",valorUnitario:70,quantidade:1,petId:"pet-bela",tipo:"SERVICO",exigePet:true,status:"ATIVO"},
  {id:"persistida-b",itemCatalogoId:"banho",empresaId:"estetica",empresaNome:"Banho & Tosa",descricao:"Banho",valorUnitario:70,quantidade:2,petId:"pet-tico",tipo:"SERVICO",exigePet:true,status:"ATIVO"}
 ]};
 const rows=rehydrateUnifiedDraft(saved);
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>[x.lineKey,x.itemCatalogoId,x.petId,x.quantidade]),[
  ["persistida:persistida-a","banho","pet-bela",1],
  ["persistida:persistida-b","banho","pet-tico",2]
 ]);
 const ui=readFileSync(new URL("../../admin-web/src/pages/UnifiedPdvPreviewPage.jsx",import.meta.url),"utf8");
 assert.match(ui,/key=\{row\.lineKey\}/);
 assert.match(ui,/updateUnifiedLine\(ls,row\.lineKey/);
 assert.match(ui,/removeUnifiedLine\(ls,row\.lineKey\)/);
 assert.doesNotMatch(ui,/key=\{row\.itemCatalogoId\}/);
});
