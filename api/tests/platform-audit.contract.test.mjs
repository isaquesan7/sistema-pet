/**
 * Contract tests: superadmin route protection and allowed audit actions.
 * These do not authenticate a real account or modify Railway data.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const routes=readFileSync(new URL("../src/modules/saas/saas.routes.js",import.meta.url),"utf8");
const middleware=readFileSync(new URL("../src/modules/saas/platform-audit.js",import.meta.url),"utf8");
const actions=[
  ["post","/plataforma/planos"],
  ["patch","/plataforma/planos/:id"],
  ["patch","/plataforma/organizacoes/:organizacaoId/assinatura"],
  ["post","/plataforma/faturas"],
  ["post","/plataforma/faturas/:id/pagar"],
  ["post","/plataforma/faturas/:id/cancelar"]
];
test("platform audit read route protected by auth and superadmin",()=>{
 assert.match(routes,/router\.get\("\/plataforma\/auditoria", autenticarUsuario, exigirSuperAdmin, auditPlatformList\)/);
});
test("every audited mutation authenticates and authorizes before logging",()=>{
 for(const [method,path] of actions){
  const expected='router.'+method+'("'+path+'", autenticarUsuario, exigirSuperAdmin, auditPlatformMutation,';
  assert.ok(routes.includes(expected),expected);
  assert.ok(middleware.includes(method.toUpperCase()+" "+path),path);
 }
});
test("audit excludes untrusted request payload and secrets",()=>{
 assert.ok(!middleware.includes("req.body"));
 assert.ok(!middleware.includes("req.headers.authorization"));
 assert.ok(middleware.includes('res.once("finish"'));
});
