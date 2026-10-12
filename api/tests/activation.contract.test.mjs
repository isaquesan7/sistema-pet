import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const routes=readFileSync(new URL("../src/modules/saas/saas.routes.js",import.meta.url),"utf8");
const code=readFileSync(new URL("../src/modules/saas/activation.controller.js",import.meta.url),"utf8");
test("activation route checks tenant and manager",()=>{
 assert.match(routes,/router\.get\("\/ativacao",autenticarUsuario,selecionarEmpresaParaAssinatura,exigirGestorOrganizacao,activationProgress\)/);
});
test("tenant scope required for clients, pets and employees",()=>{
 assert.match(code,/prisma\.cliente\.count\(\{where:\{organizacaoId:id\}\}\)/);
 assert.match(code,/prisma\.pet\.count\(\{where:\{cliente:\{organizacaoId:id\}\}\}\)/);
 assert.match(code,/prisma\.funcionario\.count\(\{where:\{organizacaoId:id\}\}\)/);
});
test("catalog scoped to selected company",()=>{
 assert.match(code,/prisma\.itemCatalogo\.count\(\{where:\{empresaId:req\.empresa\.id\}\}\)/);
});
test("onboarding is read-only",()=>{
 assert.ok(!/prisma\.[a-zA-Z]+\.(create|update|delete)\(/.test(code));
});
