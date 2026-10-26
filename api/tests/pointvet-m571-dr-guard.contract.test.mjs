/** M.5.71 DR guard regression: only synthetic URL examples; NEVER connect. */
import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {validarPlanoDR,parseDbConnection,DR_CONFIRM}
 from "../src/modules/plataforma/pointvet-m571-dr-guard.contract.mjs";
const staging="9564acfc-1582-45d8-8ac3-f0bc2d998530";
const prod="aab52927-a8c1-4158-80bf-bd22af504e72";
const synthetic="11a9be9f-7635-4e74-96f9-0c48d77242c9";
const dr="c6428e49-71a9-4aad-b539-f07b3f71f7bf";
const srcSvc="a8e97777-25dc-4fe0-b9b0-00effb9c951d";
const destSvc="f59d9279-e59c-4e12-a7d8-180bd277a970";
const src="postgresql://read:dummy@staging-pg.railway.internal:5432/railway?sslmode=require";
const dst="postgresql://dr:dummy@dr-pg.railway.internal:5432/railway?sslmode=require";
const scope={sourceUrl:src,targetUrl:dst,sourceProjectId:staging,targetProjectId:dr,
 sourceServiceId:srcSvc,targetServiceId:destSvc,confirmacao:DR_CONFIRM};
test("preflight never asserts real identity or successful restore",()=>{
 const r=validarPlanoDR(scope);
 assert.equal(r.possibleToTest,true);
 assert.equal(r.confirmedActualIdentity,false);
 assert.equal(r.restorePerformed,false);
 assert.equal(r.readyForProduction,false);
});
test("refuses production, staging and synthetic CI project as target",()=>{
 for(const project of [prod,staging,synthetic])
  assert.throws(()=>validarPlanoDR({...scope,targetProjectId:project}),/BLOCKED/);
});
test("refuses shared host, missing confirmation and wrong source service",()=>{
 assert.throws(()=>validarPlanoDR({...scope,targetUrl:src}),/BLOCKED/);
 assert.throws(()=>validarPlanoDR({...scope,confirmacao:"yes"}),/BLOCKED/);
 assert.throws(()=>validarPlanoDR({...scope,sourceServiceId:destSvc}),/BLOCKED/);
 assert.throws(()=>validarPlanoDR({...scope,targetServiceId:srcSvc}),/BLOCKED/);
});
test("requires PostgreSQL, TLS and explicit credentials",()=>{
 for(const url of [dst.replace("sslmode=require","sslmode=disable"),
  dst+"&host=/var/run/postgresql",dst.replace("postgresql:","mysql:"),
  "postgresql://dr@dr-pg.railway.internal:5432/railway"])
  assert.throws(()=>parseDbConnection(url),/BLOCKED/);
});
test("CLI preflight NEVER uses psql or writes data",()=>{
 const args=["scripts/pointvet-m571-staging-drill.mjs","--preflight-only"];
 const env={...process.env,POINTVET_DR_SOURCE_URL:src,POINTVET_DR_TARGET_URL:dst,
  POINTVET_DR_SOURCE_PROJECT_ID:staging,POINTVET_DR_TARGET_PROJECT_ID:dr,
  POINTVET_DR_SOURCE_SERVICE_ID:srcSvc,POINTVET_DR_TARGET_SERVICE_ID:destSvc,
  POINTVET_DR_CONFIRMATION:DR_CONFIRM};
 const x=spawnSync(process.execPath,args,{cwd:new URL("../",import.meta.url),env,encoding:"utf8"});
 assert.equal(x.status,0,x.stderr);
 assert.match(x.stdout,/PREFLIGHT_OK/);
 assert.match(x.stdout,/NAO executado/);
 assert.doesNotMatch(x.stdout,/dummy/);
});
