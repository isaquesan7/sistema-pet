import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessMultiCompanyReadOnlyAudit} from "../src/modules/plataforma/pointvet-m572-preflight.contract.mjs";

const baseline={
 readOnly:true,multiCompanyComandas:1,sameTenantComandas:1,crossTenantComandas:0,
 withItems:1,withSales:0,withClinical:1,withBath:0,
 openComandas:0,nonOpenComandas:1,withClinicalBathOnlyCompany:0
};
test("M572 multi-CNPJ de mesma organizacao requer revisao, nunca libera",()=>{
 const result=assessMultiCompanyReadOnlyAudit(baseline);
 assert.equal(result.gate,"POINTVET_M572_MULTICNPJ_REVIEW_REQUIRED");
 assert.equal(result.auditedReadOnly,true);
 assert.equal(result.commercialDeploymentAuthorized,false);
 assert.equal(result.projectIdentityIndependentlyVerified,false);
 assert.equal(result.counts.multiCompanyComandas,1);
 assert.equal(result.counts.sameTenantComandas,1);
 assert.equal(result.counts.crossTenantComandas,0);
 assert.ok(result.blockers.length>0);
});
test("M572 risco clinico/bath sem item/venda nao desaparece da auditoria",()=>{
 const r=assessMultiCompanyReadOnlyAudit({...baseline,withClinicalBathOnlyCompany:1});
 assert.match(r.blockers.join(" " ),/invisivel/);
});
test("M572 rejeita evidencias inconsistentes sem mascarar risco",()=>{
 for(const patch of [
  {readOnly:false,multiCompanyComandas:1,sameTenantComandas:1},
  {multiCompanyComandas:1,sameTenantComandas:0,crossTenantComandas:0},
  {multiCompanyComandas:1,openComandas:1,nonOpenComandas:1},
  {multiCompanyComandas:1,withItems:2},
  {multiCompanyComandas:-1},
  {multiCompanyComandas:"1"}
 ]){
  if(patch.readOnly===false){
   assert.equal(assessMultiCompanyReadOnlyAudit({...baseline,...patch}).auditedReadOnly,false);
  }else{
   assert.throws(()=>assessMultiCompanyReadOnlyAudit({...baseline,...patch}),/BLOCKED/);
  }
 }
});
test("M572 SQL agregado so leitura, ASCII, sem retornar identificadores",()=>{
 const sql=readFileSync(new URL("../scripts/pointvet-m572-multicnpj-readonly.sql",import.meta.url),"utf8");
 assert.ok([...sql].every(ch=>ch.charCodeAt(0)<=127));
 assert.match(sql,/SELECT json_build_object/);
 assert.match(sql,/default_transaction_read_only/);
 assert.match(sql,/count\(\*\)/);
 assert.doesNotMatch(sql,/\b(?:INSERT|DELETE|UPDATE|ALTER|CREATE|DROP|TRUNCATE|CALL)\b/i);
 assert.doesNotMatch(sql,/json_build_object\(\s*'[^']*(?:id|cpf|cnpj|nome|telefone)/i);
 const runner=readFileSync(new URL("../scripts/pointvet-m572-prod-readonly-audit.mjs",import.meta.url),"utf8");
 assert.match(runner,/--inspect-multicnpj/);
 assert.match(runner,/assessMultiCompanyReadOnlyAudit/);
});
