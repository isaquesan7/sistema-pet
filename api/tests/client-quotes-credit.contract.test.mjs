/** PointVet M.4A — static privacy and money invariants. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const service=file("../src/modules/clientes/client-finance.service.js");
const routes=file("../src/modules/clientes/client-finance.routes.js");
const schema=file("../prisma/schema.prisma");
test("M4A: quotes isolated by org company client, with auditable writes",()=>{
 assert.match(service,/organizacaoId:org,empresaId:empresa,clienteId:cliente/);
 assert.match(service,/assertTenant\(tx,org,empresa,input.clienteId,ids\)/);
 assert.match(service,/ORCAMENTO_CRIADO/);
 assert.match(service,/ORCAMENTO_STATUS_ALTERADO/);
 assert.match(service,/isolationLevel:"Serializable"/);
 assert.match(service,/MOEDA_CENTAVOS_INVALIDOS/);
 assert.match(schema,/model OrcamentoCliente/);
});
test("M4A: prepay credit cannot be spent or generated through this router",()=>{
 assert.match(service,/usoNoPdvHabilitado:false/);
 assert.match(service,/lancamentosHabilitados:false/);
 assert.match(routes,/r.get\("\/:clienteId\/credito"/);
 assert.doesNotMatch(routes,/r\.(?:post|put|patch|delete)\("\/:clienteId\/credito"/);
 assert.match(schema,/model CreditoClienteMovimento/);
});
test("M4A: quote mutations require finance management permission",()=>{
 assert.match(routes,/r.post\("\/:clienteId\/orcamentos",exigirPermissao\("financeiro.gerenciar"\)/);
 assert.match(routes,/r.post\("\/:clienteId\/orcamentos\/:id\/status",exigirPermissao\("financeiro.gerenciar"\)/);
});
