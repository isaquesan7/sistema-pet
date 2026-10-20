/** M.5.66: a reformulação do balcão mantém ações, isolamento e conferência do PDV. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page=readFileSync(new URL("../src/pages/UnifiedPdvPreviewPage.jsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/clients.css",import.meta.url),"utf8");

test("balcão reúne tutor e catálogo à esquerda e comanda à direita",()=>{
 const left=page.indexOf('className="pv-unified-sourcing"');
 const customer=page.indexOf('className="panel pv-detail-panel pv-unified-customer"');
 const catalog=page.indexOf('className="panel pv-detail-panel pv-unified-products"');
 const right=page.indexOf('className="pv-unified-order"');
 const cart=page.indexOf('className="panel pv-detail-panel pv-unified-cart"');
 const history=page.indexOf('className="panel pv-unified-history"');
 assert.ok(left>=0&&left<customer&&customer<catalog&&catalog<right&&right<cart&&cart<history);
 assert.match(page,/aria-label="Cliente e catálogo"/);
 assert.match(page,/aria-label="Comanda e fechamento"/);
 assert.match(page,/className="pv-unified-order-summary"/);
 assert.match(page,/className="pv-unified-new-draft"/);
 assert.match(page,/function startNewDraft\(\)/);
 assert.equal(page.match(/onClick=\{startNewDraft\}/g)?.length,2);
});

test("nova apresentação mantém fluxos sensíveis conectados e isolados",()=>{
 for(const guard of [
  'UnifiedRoleAcceptancePanel','/pdv-unificado/disponibilidade',
  'onRefresh={()=>eligibility.refetch()}','buildUnifiedDraftPayload(clientId,lines)',
  'visibleUnifiedClients(clients.data,selectedClient)','UnifiedBulkScaleCheck',
  'preview.mutate()','save.mutate()','<UnifiedAllocationConference',
  'checkoutEnabled={manualCheckoutEnabled}','reversalEnabled={manualReversalEnabled}',
  '/fechar-manual','/estornar-manual'
 ])assert.ok(page.includes(guard),`Fluxo removido: ${guard}`);
 assert.match(page,/formatCurrency\(estimatedCents\/100\)/);
 assert.match(page,/isBulkWeightProduct\(row\)\?bulkTotalCents\(row\)/);
 assert.match(page,/apenas informativo/);
});

test("layout mantém responsividade, legibilidade e foco por teclado",()=>{
 assert.match(css,/\.pv-unified-workspace\{display:grid;grid-template-columns:/);
 assert.match(css,/@media\(max-width:900px\)\{\.pv-unified-workspace\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/\.pv-unified-new-draft:focus-visible/);
 assert.match(css,/\.pv-unified-history>summary:focus-visible/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
