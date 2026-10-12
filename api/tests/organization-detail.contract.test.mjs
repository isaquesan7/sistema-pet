import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const routes=readFileSync(new URL("../src/modules/saas/saas.routes.js",import.meta.url),"utf8");
const details=readFileSync(new URL("../src/modules/saas/organization-detail.js",import.meta.url),"utf8");
test("organization drill-down restricted to superadmin",()=>{
 assert.match(routes,/router\.get\("\/plataforma\/organizacoes\/:organizacaoId\/detalhes", autenticarUsuario, exigirSuperAdmin, organizationDetail\)/);
});
test("pets counted by tenant ownership through customer",()=>{
 assert.match(details,/prisma\.pet\.count\(\{where:\{cliente:\{organizacaoId:id\}\}\}\)/);
});
test("no sensitive client lists or patient records exposed",()=>{
 assert.match(details,/prisma\.organizacao\.findUnique/);
 assert.ok(!details.includes("prisma.cliente.findMany"));
 assert.ok(!details.includes("prisma.pet.findMany"));
 assert.ok(!details.includes("prisma.usuario.findMany"));
});
