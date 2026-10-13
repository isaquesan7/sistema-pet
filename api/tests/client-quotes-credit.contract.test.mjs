/** Regression contracts: tenant boundaries and financial non-interference. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const service=read("../src/modules/clientes/client-finance.service.js");
const routes=read("../src/modules/clientes/client-finance.routes.js");
const schema=read("../prisma/schema.prisma");
test("commercial quotes scoped to company, organization and tutor",()=>{
 assert.match(service,/where:\{organizacaoId:org,empresaId:empresa,clienteId:cliente\}/);
 assert.match(service,/assertTenant\(tx,org,empresa,input\.clienteId,ids\)/);
 assert.match(service,/discount>subtotal/);
 assert.match(service,/updateMany\(\{where:\{id,organizacaoId:org,empresaId:empresa,clienteId:cliente,status:quote.status\}/);
});
test("prepaid credit currently read-only and segregated from receivables",()=>{
 assert.match(service,/lancamentosHabilitados:false/);
 assert.match(routes,/r\.get\("\/:clienteId\/credito"/);
 assert.doesNotMatch(routes,/r\.(post|patch|delete)\("\/:clienteId\/credito"/);
 assert.match(schema,/model CreditoClienteMovimento/);
 assert.match(schema,/model OrcamentoCliente/);
});
test("new write operations require finance permission",()=>{
 assert.match(routes,/r\.post\("\/:clienteId\/orcamentos",exigirPermissao\("financeiro.gerenciar"\)/);
 assert.match(routes,/r\.post\("\/:clienteId\/orcamentos\/:id\/status",exigirPermissao\("financeiro.gerenciar"\)/);
});
