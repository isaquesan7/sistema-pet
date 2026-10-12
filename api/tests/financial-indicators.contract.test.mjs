import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const routes=readFileSync(new URL("../src/modules/saas/saas.routes.js",import.meta.url),"utf8");
const financial=readFileSync(new URL("../src/modules/saas/financial-indicators.js",import.meta.url),"utf8");
test("finance is superadmin only",()=>{
 assert.match(routes,/router\.get\("\/plataforma\/indicadores-financeiros", autenticarUsuario, exigirSuperAdmin, financialIndicators\)/);
});
test("revenue contracted only from active subscriptions",()=>{
 assert.match(financial,/s\.status==="ATIVA"/);
 assert.match(financial,/s\.ciclo==="ANUAL"/);
});
test("cash counted only from paid invoices with payment timestamp",()=>{
 assert.match(financial,/f\.status==="PAGA"&&f\.pagoEm/);
 assert.match(financial,/recebidoHistorico/);
});
test("no write operations in financial endpoint",()=>{
 assert.ok(!financial.includes(".update(")&&!financial.includes(".create(")&&!financial.includes(".delete("));
});
