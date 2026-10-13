/** Non-destructive access and credential regression checks. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const routes=source("../src/modules/auth/auth.routes.js");
const ctrl=source("../src/modules/auth/profile.controller.js");
const schema=source("../prisma/schema.prisma");
const profile=source("../../admin-web/src/pages/MyAccountPage.jsx");
const layout=source("../../admin-web/src/layout/AppLayout.jsx");
test("self service endpoints always authenticate and never receive a target user id",()=>{
 for(const endpoint of ["/me/perfil","/me/senha"])assert.ok(routes.includes('"'+endpoint+'"'));
 assert.match(routes,/autenticarUsuario,getMyProfile/);
 assert.match(routes,/autenticarUsuario,accountMutationLimiter,editMyProfile/);
 assert.match(routes,/autenticarUsuario,accountMutationLimiter,changeMyPassword/);
 assert.match(ctrl,/where:\{id:req\.usuario\.id\}/);
});
test("email update requires current password and duplicate protection",()=>{
 assert.match(ctrl,/changingEmail.*bcrypt\.compare/s);
 assert.match(ctrl,/P2002/);
 assert.match(ctrl,/E-mail já está em uso/);
});
test("password update revokes sessions and hashes credentials",()=>{
 assert.match(ctrl,/bcrypt\.hash\(novaSenha,12\)/);
 assert.match(ctrl,/sessaoUsuario\.updateMany/);
 assert.match(ctrl,/revokedAt:new Date\(\)/);
});
test("profile cannot self edit superadmin, permissions or memberships",()=>{
 assert.match(ctrl,/\.strict\(\)/);
 assert.ok(!/data:\s*\{[^}]*superAdmin/s.test(ctrl));
 assert.ok(!/data:\s*\{[^}]*permissoes/s.test(ctrl));
});
test("optional avatar and display name fields exist",()=>{
 assert.match(schema,/nomeExibicao String\?/);
 assert.match(schema,/fotoUrl String\?/);
 assert.match(profile,/Senha atual/);
 assert.match(layout,/Meu Usuário/);
});

test("email changes revoke sessions, and avatar upload checks file signatures",()=>{
 assert.match(ctrl,/if\(changingEmail\)await tx\.sessaoUsuario\.updateMany/);
 assert.match(ctrl,/imageDataSchema/);
 assert.match(ctrl,/body\.subarray\(0,3\)/);
 assert.match(ctrl,/250\*1024/);
});

test("access tokens bind to revocable sessions",()=>{
 const service=source("../src/modules/auth/auth.service.js");
 const middleware=source("../src/middlewares/auth.middleware.js");
 assert.match(service,/sid: sessaoId/);
 assert.match(service,/gerarAccessToken\(usuario, sessao.id\)/);
 assert.match(middleware,/if \(payload.sid\)/);
 assert.match(middleware,/sessao\.revokedAt/);
});
