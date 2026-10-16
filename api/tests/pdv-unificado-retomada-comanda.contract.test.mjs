import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rehydrateUnifiedDraft,unifiedPrecloseMessages} from "../../admin-web/src/lib/unifiedDraft.js";

test("retomada de comanda multiempresa usa os snapshots persistidos sem catálogo da busca atual",()=>{
 const saved={itens:[
  {id:"linha-1",empresaId:"petshop",empresaNome:"Loja Pet",itemCatalogoId:"racao",descricao:"Ração premium 1kg",valorUnitario:99.9,quantidade:2,petId:null,exigePet:false,status:"ATIVO"},
  {id:"linha-2",empresaId:"banho",empresaNome:"Banho e Tosa",itemCatalogoId:"servico",descricao:"Banho pequeno porte",valorUnitario:75,quantidade:1,petId:"pet-1",exigePet:true,status:"ATIVO"},
  {id:"linha-antiga",empresaId:"banho",empresaNome:"Banho e Tosa",itemCatalogoId:"antigo",descricao:"Removido",valorUnitario:10,quantidade:1,status:"CANCELADO"}
 ]};
 const rows=rehydrateUnifiedDraft(saved);
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>[x.rascunhoItemId,x.nome,x.empresa,x.preco]),[
  ["linha-1","Ração premium 1kg","Loja Pet",99.9],
  ["linha-2","Banho pequeno porte","Banho e Tosa",75]
 ]);
 assert.deepEqual(rows.map(x=>[x.petId,x.exigePet]),[["",false],["pet-1",true]]);
 assert.equal(rows[0].quantidade,2);
});

test("pré-fechamento informa pendências de gestão e não cria requisito de provedor fiscal",()=>{
 assert.match(unifiedPrecloseMessages.PRECO_ALTERADO,/Preço do catálogo mudou/);
 assert.match(unifiedPrecloseMessages.PET_OBRIGATORIO,/pet/);
 const ui=readFileSync(new URL("../../admin-web/src/pages/UnifiedPdvPreviewPage.jsx",import.meta.url),"utf8");
 assert.match(ui,/rehydrateUnifiedDraft\(saved\)/);
 assert.doesNotMatch(ui,/\(catalog\.data\|\|\[\]\)\.find\(p=>p\.id===i\.itemCatalogoId\)/);
 assert.match(ui,/unifiedPrecloseMessages\[p\.codigo\]/);
});
