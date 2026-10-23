import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const schema=get("../prisma/schema.prisma");
const routes=get("../src/modules/pdv/pdv-unificado.routes.js");
const config=get("../src/modules/organizacoes/organizacoes.schema.js");
const settings=get("../../admin-web/src/pages/SettingsPage.jsx");
test("opt-in is organization-scoped and disabled by default",()=>{
 assert.match(schema,/pdvUnificadoHabilitado Boolean @default\(false\)/);
 assert.match(config,/pdvUnificadoHabilitado: z\.boolean\(\)\.optional\(\)/);
 assert.match(settings,/PDV Unificado Inteligente/);
 assert.match(settings,/pdvUnificadoHabilitado:enabled/);
 assert.match(settings,/fechamento multiempresa depende de autorização independente/);
});
test("unified manual checkout requires independent organization and CNPJ opt-ins",()=>{
 const checkout=get("../src/modules/pdv/pdv-unificado-checkout-manual.gate.js");
 assert.match(routes,/checkoutUnificadoDisponivel:checkoutHabilitado/);
 assert.match(routes,/checkoutManualHabilitado\(req\.organizacao,req\.empresa\.id\)/);
 assert.match(checkout,/POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED/);
 assert.match(checkout,/POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS/);
 assert.match(checkout,/POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS/);
 assert.match(checkout,/pdvUnificadoHabilitado/);
 assert.match(routes,/usuarioId:req\.usuario\.id,ativo:true/);
 assert.match(routes,/organizacaoId:req\.organizacao\.id/);
 assert.match(routes,/r\.post\("\/simulacao"/);
 assert.doesNotMatch(routes,/r\.post\("\/(fechar|pagar|vender|finalizar)"/);
});
test("financial foundation remains separate, preserving legacy comanda",()=>{
 assert.match(schema,/model Comanda \{/);
 assert.match(schema,/model ComandaItem \{/);
 assert.match(schema,/model Venda \{/);
});

test("unified draft persistence never reaches payments, stock or fiscal",()=>{
 const svc=get("../src/modules/pdv/pdv-unificado.service.js");
 const legacy=get("../src/modules/pdv/pdv.service.js");
 assert.match(svc,/export async function salvarRascunho/);
 assert.match(svc,/isolationLevel:"Serializable"/);
 assert.match(svc,/versaoRascunho:versao/);
 assert.match(svc,/comandaItem.createMany/);
 assert.doesNotMatch(svc,/tx\.venda\.create|tx\.pagamento\.create|criarDocumentoAutomaticoVenda|baixarEstoque/);
 assert.match(legacy,/COMANDA_RASCUNHO_UNIFICADO/);
 assert.match(schema,/rascunhoUnificado Boolean @default\(false\)/);
});

test("legacy detail view cannot expose multi-company drafts and cross-company role must be active",()=>{
 const legacy=get("../src/modules/pdv/pdv.service.js");
 const unified=get("../src/modules/pdv/pdv-unificado.service.js");
 assert.match(legacy,/where: \{ id, organizacaoId, rascunhoUnificado: false \}/);
 assert.match(unified,/v\.cargo\?\.ativo/);
});

test("pre-closing review cannot issue payments, sales or invoices",()=>{
 const service=get("../src/modules/pdv/pdv-unificado.service.js");
 const routes=get("../src/modules/pdv/pdv-unificado.routes.js");
 assert.match(service,/export async function conferirPreFechamento/);
 assert.match(routes,/\/rascunhos\/:id\/pre-fechamento/);
 assert.match(service,/checkoutHabilitado:false,pagamentosHabilitados:false,emissaoFiscalHabilitada:false/);
});

test("financial allocation conference and recovery are strictly read-only",()=>{
 const svc=get("../src/modules/pdv/pdv-unificado-preparacao.service.js");
 assert.match(svc,/export async function conferirAlocacaoFechamento/);
 assert.match(svc,/export async function diagnosticarRecuperacaoFechamento/);
 assert.match(svc,/creditoClienteDisponivel:false/);
 assert.match(svc,/execucaoDisponivel:false/);
 assert.doesNotMatch(svc,/\.venda\.create\(|\.pagamento\.create\(|\.documentoFiscal\.create\(|\.movimentacaoEstoque\.create\(/);
 assert.match(routes,/\/rascunhos\/:id\/conferencia-alocacao/);
 assert.match(routes,/\/rascunhos\/:id\/diagnostico-recuperacao/);
 assert.doesNotMatch(routes,/\/rascunhos\/:id\/executar/);
});
