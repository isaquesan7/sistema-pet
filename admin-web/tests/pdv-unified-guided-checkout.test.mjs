/** M.5.71 — o balcão não anuncia uma venda gravada antes do servidor autorizá-la.
 * O operador percorre o fluxo existente, sem motor paralelo de checkout. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const load=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const page=load("../src/pages/UnifiedPdvPreviewPage.jsx");
const shared=load("../src/components/PdvSaleLayout.jsx");
const css=load("../src/clients.css");
const gate=load("../../api/src/modules/pdv/pdv-unificado-checkout-manual.gate.js");

test("o CTA guiado é acionável sem executar pagamentos diretos",()=>{
 for(const marker of [
  "const checkoutStage=", "const canContinue=", "function continueCheckout()",
  'checkoutStage==="SALVAR"', 'checkoutStage==="RESERVAR"',
  'checkoutStage==="RECEBIMENTOS"', "save.mutate()", "reserveMutation.mutate()",
  "paymentSectionRef.current?.scrollIntoView", "onClick={continueCheckout}",
  "label={checkoutActionLabel}", "disabled={!canContinue}"
 ])assert.ok(page.includes(marker),"Etapa protegida ausente: "+marker);
 assert.doesNotMatch(page,/disabled=\{true\} reason=\{manualCheckoutEnabled/);
 assert.match(shared,/label\|\|/);
});
test("simulação mantém gate exato por organização e CNPJ",()=>{
 assert.match(page,/checkoutUnificadoDisponivel/);
 assert.match(page,/checkoutEnabled=\{manualCheckoutEnabled\}/);
 assert.match(page,/fechar-manual/);
 assert.match(page,/registro da venda inteligente está bloqueado na API/);
 assert.match(gate,/POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED/);
 assert.match(gate,/POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS/);
 assert.match(gate,/POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS/);
 assert.match(gate,/empresaManualAutorizada\(empresaId\)/);
});
test("não duplicar no fluxo os resumos técnicos e ação de reservar",()=>{
 assert.match(page,/<details className="pv-unified-advanced">/);
 assert.match(page,/<summary>Detalhes avançados de planejamento e auditoria<\/summary>/);
 assert.match(page,/<details className="panel pv-unified-history">/);
 assert.equal((page.match(/onClick=\{\(\)=>reserveMutation\.mutate\(\)\}/g)||[]).length,0);
 assert.match(css,/\.pv-unified-preview \.pv-unified-advanced>summary:focus-visible/);
 assert.match(page,/PdvPaymentSection/);
});
