/** M.5.66: a reformulação do balcão mantém ações, isolamento e conferência do PDV. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page=readFileSync(new URL("../src/pages/UnifiedPdvPreviewPage.jsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/clients.css",import.meta.url),"utf8");

const individual=readFileSync(new URL("../src/pages/PdvPage.jsx",import.meta.url),"utf8");
const shared=readFileSync(new URL("../src/components/PdvSaleLayout.jsx",import.meta.url),"utf8");
const pdvCss=readFileSync(new URL("../src/pdv.css",import.meta.url),"utf8");

test("individual e inteligente usam exatamente os mesmos componentes e classes do balcão",()=>{
 for(const marker of ["<PdvSaleLayout","<PdvProductCard","<PdvEmptyCart"]) {
  assert.ok(page.includes(marker),"Motor inteligente sem visual comum: "+marker);
  assert.ok(individual.includes(marker),"Motor individual sem visual comum: "+marker);
 }
 for(const cls of ['className="pdv-sale-layout"','className="panel pdv-catalog-panel"',
   'className="pdv-product-grid"','className="panel pdv-cart-panel"',
   'className="pdv-cart-list"','className="pdv-cart-count"']){
  assert.ok(shared.includes(cls),"Componente visual ausente: "+cls);
 }
 assert.doesNotMatch(page,/className="pv-unified-workspace"|className="pv-unified-hero"/);
 assert.match(page,/className="pdv-cart-line pdv-unified-line"/);
 assert.match(page,/className="pdv-quantity"/);
 assert.match(page,/className="pdv-totals"/);
 assert.match(page,/className="pdv-payments"/);
 assert.match(shared,/className="pdv-product-card"/);
 assert.match(pdvCss,/\.pdv-page \.pdv-cart-line\.pdv-unified-line/);
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
 assert.match(page,/Valor informativo/);
});

test("responsividade, foco e conferência avançada permanecem no padrão do PDV",()=>{
 assert.match(pdvCss,/\.pdv-page \.pdv-sale-layout\{display:grid;grid-template-columns:/);
 assert.match(pdvCss,/@media\(max-width:1250px\)/);
 assert.match(pdvCss,/@media\(max-width:560px\)/);
 assert.match(pdvCss,/\.pv-unified-acceptance>summary:focus-visible/);
 assert.match(css,/\.pv-unified-history>summary:focus-visible/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
