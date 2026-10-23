/**
 * PointVet M.5.3 — actual Express app read-only smoke with disposable PostgreSQL.
 *
 * HTTP listener ONLY 127.0.0.1:ephemeral, NEVER a public staging endpoint.
 * Only GET requests; never a bearer token, synthetic customer login,
 * real email, fiscal provider, payment gateway, checkout or state-changing API.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";

const expectedDb="postgresql://pointvet_ci:pointvet_ci_only@localhost:5432/pointvet_unified_ci";
function sandbox(){
 if(process.env.GITHUB_ACTIONS!=="true"||
    process.env.NODE_ENV!=="test"||
    process.env.POINTVET_UNIFIED_SALES_SANDBOX!=="1"||
    process.env.DATABASE_URL!==expectedDb)
  throw Error("M53_CI_SMOKE_AMBIENTE_NAO_ISOLADO");
}
async function counts(){
 const [org,vendas,documentos,pagamentos,estoque,fluxos,eventos]=await Promise.all([
  prisma.organizacao.count(),prisma.venda.count(),
  prisma.documentoFiscal.count(),prisma.pagamento.count(),
  prisma.movimentacaoEstoque.count(),prisma.fluxoFiscalUnificadoCi.count(),
  prisma.eventoFluxoFiscalUnificadoCi.count()
 ]);
 return {org,vendas,documentos,pagamentos,estoque,fluxos,eventos};
}
test("M.5.3 real Express health/database/auth boundary smoke is readonly in disposable CI",async t=>{
 sandbox();
 const named=await prisma.$queryRawUnsafe("SELECT current_database() AS name, current_user AS user");
 assert.equal(named[0].name,"pointvet_unified_ci");
 assert.equal(named[0].user,"pointvet_ci");
 const before=await counts();
 const server=await new Promise((resolve,reject)=>{
  const s=app.listen(0,"127.0.0.1",()=>resolve(s));
  s.once("error",reject);
 });
 t.after(()=>new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve())));
 const address=server.address();
 assert.equal(address.address,"127.0.0.1");
 assert(address.port>0);
 const root="http://127.0.0.1:"+address.port;
 async function request(path,expectStatus){
  const response=await fetch(root+path,{
   method:"GET",redirect:"manual",signal:AbortSignal.timeout(7000),
   headers:{accept:"application/json"}
  });
  assert.equal(response.status,expectStatus,path);
  assert.match(response.headers.get("content-type")||"",/application\/json/,path);
  assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  const body=await response.json();
  return body;
 }
 const health=await request("/api/health",200);
 assert.equal(health.success,true);
 assert.equal(health.status,"online");
 assert.match(health.service,/PointVet|PetRise/i);
 const db=await request("/api/health/database",200);
 assert.equal(db.success,true);
 assert.equal(db.database.status,"connected");
 assert.equal(db.database.provider,"PostgreSQL");
 assert(Number.isSafeInteger(db.database.permissoes));
 assert(Number.isSafeInteger(db.database.especies));
 const pdv=await request("/api/pdv-unificado/disponibilidade",401);
 assert.equal(pdv.success,false);
 const portal=await request("/api/portal/me",401);
 assert.equal(portal.success,false);
 const missing=await request("/api/pointvet-m53-unknown-route",404);
 assert.equal(missing.success,false);
 const after=await counts();
 assert.deepEqual(after,before,"Smoke GET requests must preserve economic and fiscal records");
});
