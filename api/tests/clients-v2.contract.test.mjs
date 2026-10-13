import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const routes=read("../src/modules/clientes/clientes.routes.js");
const service=read("../src/modules/clientes/clientes.service.js");
const ctrl=read("../src/modules/clientes/clientes.controller.js");
const clients=read("../../admin-web/src/pages/ClientsPage.jsx");
const details=read("../../admin-web/src/pages/ClientDetailPage.jsx");
test("deletion requires authorization and is tenant scoped",()=>{
 assert.match(routes,/router.delete\("\/:id",exigirPermissao\("clientes.editar"\),excluir\)/);
 assert.match(service,/where:\{id,organizacaoId\}/);
 assert.match(service,/CLIENTE_COM_VINCULOS/);
 assert.match(ctrl,/status\(409\)/);
});
test("double confirmation blocks deletion before exact name typed",()=>{
 assert.match(clients,/deleteStep===1/);
 assert.match(clients,/deletePhrase!==deletion\?\.nome/);
 assert.match(clients,/deleteMutation\.mutate/);
});
test("read-only related records remain scoped and financial data gated",()=>{
 assert.match(service,/empresa:\{organizacaoId\}/);
 assert.match(ctrl,/req\.permissoes\?\.includes\("financeiro.visualizar"\)/);
 assert.match(details,/pets\/catalogos\/especies/);
 assert.match(details,/client-related/);
});
