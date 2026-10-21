/** M.5.67 — apresentação do PDV tradicional sem alterar autorizações nem execução financeira. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page=readFileSync(new URL("../src/pages/PdvPage.jsx",import.meta.url),"utf8");
const style=readFileSync(new URL("../src/pdv.css",import.meta.url),"utf8");
const shared=readFileSync(new URL("../src/components/PdvSaleLayout.jsx",import.meta.url),"utf8");

test("PDV tradicional apresenta caixa, catalogo, carrinho e pagamentos de forma clara",()=>{
 for(const marker of [
  'import "../pdv.css";','className="pdv-hero"','className="pdv-hero__chips"',
  'className="pdv-unified-shortcut"','className="pdv-summary-grid"',
  '<nav className="pdv-tabs"','aria-pressed={tab === value}',
  '<PdvSaleLayout','<PdvProductCard','<PdvEmptyCart',
  'className="pdv-totals"','className="pdv-payment-labels"'
 ])assert.ok(page.includes(marker),`Seção ausente: ${marker}`);
 for(const marker of ['className="pdv-sale-layout"','className="pdv-product-grid"','className="pdv-cart-count"','className="pdv-empty-cart"'])assert.ok(shared.includes(marker),`Visual não compartilhado: ${marker}`);
 assert.match(page,/aria-label=\{`Forma de pagamento \$\{index\+1\}\`\}/);
 assert.match(page,/aria-label=\{`Valor do pagamento \$\{index\+1\} em reais\`\}/);
 assert.match(page,/Sem integração com bancos ou maquininhas/);
});

test("continua usando os mesmos fluxos de venda, comandas, caixa e cancelamento",()=>{
 for(const marker of [
  'queryKey: ["pdv-summary", selectedCompany?.id]',
  'queryKey: ["pdv-items", selectedCompany?.id, itemSearch]',
  'api.post("/pdv/vendas"','api.post(`/pdv/comandas/${commandDetailId}/fechar`',
  'api.post(`/pdv/vendas/${cancelSale.id}/cancelar`',
  'if (!openSession) return setSaleError','if (missingPet) return setSaleError',
  'hasPermission("pdv.aplicar_desconto")','hasPermission("pdv.cancelar_venda")',
  'onClick={finalizeSale}','<PaymentEditor payments={payments} total={total} onChange={setPayments}/>',
  '<UnifiedPdvPreviewPage />'
 ])assert.ok(page.includes(marker),`Fluxo ausente: ${marker}`);
});

test("layout padroniza tamanho de fonte e preserva parcelas no mobile",()=>{
 assert.match(style,/\.pdv-page \.pdv-product-card strong\{font-size:14px/);
 assert.match(style,/\.pdv-page \.pdv-payments__heading strong\{font-size:16px/);
 assert.match(style,/\.pdv-page \.pdv-payment-row \.form-control\{[^}]*font-size:13px/);
 assert.match(style,/@media\(max-width:1250px\)/);
 assert.match(style,/@media\(max-width:560px\)/);
 assert.match(style,/\.pdv-page \.pdv-payment-row>:nth-child\(3\)\{display:block\}/);
 assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
});
