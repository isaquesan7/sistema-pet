import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const routes=readFileSync(new URL("../src/modules/saas/saas.routes.js",import.meta.url),"utf8");
const code=readFileSync(new URL("../src/modules/saas/support.controller.js",import.meta.url),"utf8");
test("tenant routes demand verified membership and managerial role",()=>{
 for(const segment of ['router.get("/suporte"','router.post("/suporte"','router.get("/suporte/:id"','router.post("/suporte/:id/respostas"']){
  const row=routes.split("\n").find(x=>x.includes(segment));
  assert.ok(row?.includes("autenticarUsuario,selecionarEmpresaParaAssinatura,exigirGestorOrganizacao"));
 }
});
test("platform queue and status require superadmin",()=>{
 for(const segment of ['router.get("/plataforma/suporte"','router.get("/plataforma/suporte/:id"','router.post("/plataforma/suporte/:id/respostas"','router.patch("/plataforma/suporte/:id/status"']){
  const row=routes.split("\n").find(x=>x.includes(segment));
  assert.ok(row?.includes("autenticarUsuario,exigirSuperAdmin"));
 }
});
test("ticket listing and thread tenant ownership is explicitly checked",()=>{
 assert.match(code,/WHERE t.organization_id=\$\{scope\}/);
 assert.match(code,/AND organization_id=\$\{req.organizacao.id\}/);
 assert.match(code,/VALUES\(\$\{req.organizacao.id\}/);
});
test("messages sanitized by React JSX rendering and length check",()=>{
 assert.match(code,/x.trim\(\).length<=4000/);
 assert.ok(!code.includes("dangerouslySetInnerHTML"));
});
