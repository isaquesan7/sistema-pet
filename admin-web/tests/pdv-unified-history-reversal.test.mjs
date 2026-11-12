/** M.5.71 — histórico unificado e estorno são do PDV, não de venda-filha.
 * Testes de regressão do caminho usado pelo operador no staging. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rehydrateUnifiedDraft} from "../src/lib/unifiedDraft.js";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const page=read("../src/pages/PdvPage.jsx");
const unified=read("../src/pages/UnifiedPdvPreviewPage.jsx");
const css=read("../src/pdv.css");
const backend=read("../../api/src/modules/pdv/pdv-unificado.routes.js");

test("Histórico principal oferece vendas unificadas sem confundir com venda por CNPJ",()=>{
 assert.match(page,/tab === "HISTORICO"/);
 assert.match(page,/Vendas unificadas concluídas/);
 assert.match(page,/Últimas vendas do CNPJ selecionado/);
 assert.match(page,/api\.get\("\/pdv-unificado\/rascunhos-concluidos"\)/);
 assert.match(page,/pdv-unified-history-main/);
 assert.match(page,/setUnifiedDraftToOpen\(order\.id\)/);
 assert.match(page,/setTab\("VENDA"\)/);
 assert.match(page,/Abrir comanda para estorno integral/);
 assert.match(page,/unifiedOrderForSelectedSale/);
 assert.match(css,/\.pdv-page \.pdv-unified-history-row/);
 assert.match(backend,/r\.get\("\/rascunhos-concluidos",exigirPermissao\("pdv\.cancelar_venda"\)/);
});
test("o histórico explica as duas permissões sem habilitar cancelamento isolado",()=>{
 assert.match(page,/missingReversalCompanies/);
 assert.match(page,/pdvCancelarVenda/);
 assert.match(page,/pdv\.cancelar_venda/);
 assert.match(page,/estornoUnificadoDisponivel/);
 assert.match(page,/não cancele as vendas-filhas individualmente/);
});
test("recuperação do PDV inteligente busca tanto ABERTA quanto FECHADA",()=>{
 assert.match(unified,/const saved=\(draftList\.data\|\|\[\]\)\.find\(x=>x\.id===openDraftId\)\|\|\(completedList\.data\|\|\[\]\)\.find\(x=>x\.id===openDraftId\)/);
 assert.match(unified,/\[openDraftId,draftList\.data,completedList\.data\]/);
 assert.match(unified,/reversalEnabled=\{reversalEnabled\}/);
});
test("FATURADO só é mostrado na comanda FECHADA, nunca em rascunho aberto",()=>{
 const base={id:"i-1",empresaId:"e-1",itemCatalogoId:"sku",status:"FATURADO",quantidade:1,descricao:"Item de teste",valorUnitario:20,valorTotal:20,empresaNome:"Loja",tipo:"PRODUTO"};
 assert.equal(rehydrateUnifiedDraft({status:"ABERTA",itens:[base]}).length,0);
 const closed=rehydrateUnifiedDraft({status:"FECHADA",itens:[base]});
 assert.equal(closed.length,1);
 assert.equal(closed[0].nome,"Item de teste");
 assert.equal(closed[0].empresaId,"e-1");
 assert.equal(closed[0].quantidade,1);
 assert.equal(rehydrateUnifiedDraft({status:"FECHADA",itens:[{...base,status:"CANCELADO"}]}).length,0);
});
