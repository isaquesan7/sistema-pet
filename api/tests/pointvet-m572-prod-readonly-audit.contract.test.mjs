/** PointVet M.5.72 — testes puros, sem conexao Railway nem qualquer SQL. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {planProductionReadOnlyAudit,assessProductionReadOnlyAudit,
 POINTVET_PROD_PROJECT_ID,POINTVET_PROD_SERVICE_ID}
 from "../src/modules/plataforma/pointvet-m572-preflight.contract.mjs";

const url="postgresql://test:dummy@127.0.0.1:55434/railway?sslmode=require";
const scope={url,projectId:POINTVET_PROD_PROJECT_ID,serviceId:POINTVET_PROD_SERVICE_ID};
const ok={readOnly:true,totalComandas:8,orphanComandas:0,crossTenantItems:0,
 crossTenantSales:0,crossTenantClinical:0,crossTenantBath:0,multiCompanyComandas:0,
 openComandasWithoutCompanyReference:0,unfinishedMigrations:0,
 completedMigrations:21,alreadyHasComandaOrganizacao:false,
 alreadyHasComandaEmpresaOrigem:false};

test("somente tunel local dedicado ao PostgreSQL comercial e identificadores exatos",()=>{
 const r=planProductionReadOnlyAudit(scope);
 assert.equal(r.readOnlyRequired,true);
 assert.equal(r.identityVerified,false);
 assert.equal(r.deployAuthorized,false);
 for(const patch of [
  {projectId:"9564acfc-1582-45d8-8ac3-f0bc2d998530"},
  {serviceId:"ec52cdec-bc48-47d5-8e6c-1d2fda2a9f1d"},
  {url:url.replace("55434","55433")},
  {url:url.replace("127.0.0.1","postgres.railway.internal")},
  {url:url.replace("sslmode=require","sslmode=disable")}
 ])assert.throws(()=>planProductionReadOnlyAudit({...scope,...patch}),/BLOCKED/);
});
test("dados inteiros, read-only e sem riscos nao significam autorizacao comercial",()=>{
 const r=assessProductionReadOnlyAudit(ok);
 assert.equal(r.gate,"POINTVET_M572_PROD_PREFLIGHT_DATA_CONSISTENT");
 assert.equal(r.auditedReadOnly,true);
 assert.equal(r.commercialDeploymentAuthorized,false);
 assert.equal(r.projectIdentityIndependentlyVerified,false);
});
test("orfao, CNPJ misto, tenant cruzado, migração falha ou schema parcial bloqueiam",()=>{
 for(const patch of [
  {readOnly:false},{orphanComandas:1},{crossTenantItems:1},
  {crossTenantSales:1},{crossTenantClinical:1},{crossTenantBath:1},
  {multiCompanyComandas:1},{openComandasWithoutCompanyReference:1},
  {unfinishedMigrations:1},{alreadyHasComandaOrganizacao:true},
  {alreadyHasComandaEmpresaOrigem:true}
 ])assert.equal(assessProductionReadOnlyAudit({...ok,...patch}).gate,
  "POINTVET_M572_PROD_PREFLIGHT_BLOCKED");
 assert.throws(()=>assessProductionReadOnlyAudit({...ok,totalComandas:-1}),/BLOCKED/);
});
test("SQL consultivo nao inclui instrucoes mutantes",()=>{
 const sql=readFileSync(new URL("../scripts/pointvet-m572-prod-preflight.sql",import.meta.url),"utf8");
 assert.match(sql,/SELECT json_build_object/i);
 assert.match(sql,/default_transaction_read_only/);
 assert.doesNotMatch(sql,/\b(?:INSERT|DELETE|UPDATE|ALTER|CREATE|DROP|TRUNCATE|CALL)\b/i);
});
test("config-only nao acessa qualquer banco e nao pede senha",()=>{
 const env={...process.env,POINTVET_PROD_PREFLIGHT_URL:url,
  POINTVET_PROD_PREFLIGHT_PROJECT_ID:POINTVET_PROD_PROJECT_ID,
  POINTVET_PROD_PREFLIGHT_SERVICE_ID:POINTVET_PROD_SERVICE_ID};
 const proc=spawnSync(process.execPath,
  ["scripts/pointvet-m572-prod-readonly-audit.mjs","--config-only"],{
   cwd:new URL("../",import.meta.url),env,encoding:"utf8",timeout:10000});
 assert.equal(proc.status,0,proc.stderr);
 assert.match(proc.stdout,/CONFIG_OK/);
 assert.doesNotMatch(proc.stdout,/dummy/);
});
