/** M.5.70 — contrato explícito: um único design e regras financeiras distintas. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const shared=file("../src/components/PdvSaleLayout.jsx");
const individual=file("../src/pages/PdvPage.jsx");
const intelligent=file("../src/pages/UnifiedPdvPreviewPage.jsx");
const settings=file("../src/pages/SettingsPage.jsx");
const css=file("../src/pdv.css");

test("ambos os motores usam o mesmo cliente, totais, pagamentos e CTA",()=>{
 for(const block of ["PdvSaleLayout","PdvProductCard","PdvEmptyCart","PdvCustomerPicker","PdvTotals","PdvPaymentSection","PdvCheckoutButton"]){
  assert.ok(individual.includes("<"+block),"Individual sem componente: "+block);
  assert.ok(intelligent.includes("<"+block),"Inteligente sem componente: "+block);
 }
 for(const block of ["PdvCustomerPicker","PdvTotals","PdvPaymentSection","PdvCheckoutButton"]){
  assert.match(shared,new RegExp("export function "+block+"\\("));
 }
 assert.match(shared,/catalogTitle="Catálogo de produtos e serviços"/);
 assert.match(shared,/cartDescription="Revise cliente, itens, valores e pagamentos\."/);
 assert.doesNotMatch(intelligent,/catalogTitle="|cartDescription="/);
});

test("o campo de cliente é único em repouso e pesquisa aparece sob demanda",()=>{
 assert.match(shared,/aria-expanded=\{searchOpen\}/);
 assert.match(shared,/searchOpen&&onSearch&&<input/);
 assert.match(shared,/<select id="pdv-sale-customer-select"/);
 assert.match(intelligent,/visibleUnifiedClients\(clients\.data,selectedClient\)/);
 assert.match(intelligent,/value=\{clientId\} disabled=\{isReserved\}/);
 assert.match(individual,/clients=\{clients\.filter/);
});

test("o modo inteligente não permite desconto global fictício nem fechamento por clique direto",()=>{
 assert.match(shared,/lockedDiscount=!canDiscount\|\|typeof onDiscountChange/);
 assert.match(shared,/lockedAddition=typeof onAdditionChange/);
 assert.match(intelligent,/discount=\{0\} addition=\{0\} canDiscount=\{false\}/);
 assert.match(intelligent,/<PdvCheckoutButton[\s\S]*?disabled=\{!canContinue\}/);
 assert.match(intelligent,/label=\{checkoutActionLabel\}/);
 assert.match(intelligent,/onClick=\{continueCheckout\}/);
 assert.match(intelligent,/checkoutEnabled=\{manualCheckoutEnabled\}/);
 assert.match(intelligent,/<UnifiedAllocationConference/);
 assert.match(intelligent,/\/fechar-manual/);
 assert.doesNotMatch(intelligent,/onClick=\{finalizeSale\}/);
 assert.match(individual,/onClick=\{finalizeSale\}/);
 assert.match(individual,/api\.post\("\/pdv\/vendas"/);
 assert.match(shared,/disabled=\{disabled\|\|pending\}/);
 assert.match(shared,/aria-describedby=\{reason\?reasonId:undefined\}/);
 assert.match(shared,/<small id=\{reasonId\} className="pdv-checkout-action__reason" role="status">/);
});

test("mesmos campos de pagamentos sem simular recebimento real",()=>{
 assert.match(shared,/export function PdvPaymentPending/);
 assert.match(shared,/aria-label="Forma de pagamento indisponível" disabled/);
 assert.match(shared,/aria-label="Valor do pagamento indisponível" value="0" readOnly disabled/);
 assert.match(intelligent,/<PdvPaymentPending message=/);
 assert.match(intelligent,/Salvar rascunho/);
 assert.match(intelligent,/Validar e calcular sem cobrar/);
 assert.match(individual,/<PaymentEditor payments=\{payments\}/);
});

test("conferência de perfis aparece só em Configurações do staging",()=>{
 assert.doesNotMatch(intelligent,/UnifiedRoleAcceptancePanel|pv-unified-acceptance/);
 assert.match(settings,/POINTVET_IS_STAGING&&hasPermission\("pdv\.acessar"\)/);
 assert.match(settings,/<PdvRoleAcceptanceSettings/);
 assert.match(settings,/enabled:visible&&Boolean\(organizationId&&companyId\)/);
 assert.match(settings,/queryKey:\["pdv-role-acceptance-settings",organizationId,companyId\]/);
 assert.match(settings,/onRefresh=\{\(\)=>query\.refetch\(\)\}/);
});

test("a tela continua responsiva e acessível",()=>{
 assert.match(css,/\.pdv-page \.pdv-customer-picker__search-toggle:focus-visible/);
 assert.match(css,/\.pdv-page \.pdv-checkout-action>/);
 assert.match(css,/@media\(max-width:560px\)/);
 assert.match(shared,/aria-label="Desconto geral"/);
 assert.match(shared,/aria-label="Acréscimo"/);
 assert.match(shared,/aria-label="Distribuição dos pagamentos"/);
});
