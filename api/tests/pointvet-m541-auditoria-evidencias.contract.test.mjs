import {test} from "node:test";
import assert from "node:assert/strict";
import {revisarManifestoStagingM541} from "../src/modules/plataforma/pointvet-m541-auditoria-evidencias.contract.js";
const kinds={infraSegregada:"INFRA",tlsApi:"TLS",tlsAdmin:"TLS",tlsPortal:"TLS",dnsDedicado:"DNS",emailSink:"EMAIL",webhooksDesativados:"WEBHOOK",dadosSinteticos:"DADOS",smokeHttpReadOnly:"HTTP",authTenantIsolado:"SEGURANCA",observabilidadeAlertas:"OBSERVABILIDADE",backupRealAutorizado:"BACKUP",restoreRealEmStaging:"RESTORE",rtoRpoMedidos:"RECUPERACAO",migrationsRevisadas:"MIGRACAO",rollbackReleaseStaging:"ROLLBACK",rollbackFlagsStaging:"ROLLBACK",revisaoLgpd:"LGPD",aprovacaoHumanaIndependente:"APROVACAO"};
const fixture=()=>{
 const commitSha="a".repeat(40),shaAnterior="b".repeat(40),evidencias={},proveniencia={};
 let i=0;
 for(const [key,tipo] of Object.entries(kinds)){
  const referencia="evidence-"+String(i++).padStart(3,"0");
  evidencias[key]={status:"VERIFICADO",referencia,revisor:"security-review"};
  proveniencia[key]={tipo,referencia,revisor:"security-review",coletor:"stage-operator",commitSha,sha256:"f".repeat(64)};
 }
 return {fase:"M5_4_HOMOLOGACAO_REAL",commitSha,shaAnterior,evidencias,proveniencia};
};
test("M5.4.1 all metadata consistent still blocks every external action",()=>{
 const a=revisarManifestoStagingM541(fixture());
 assert.equal(a.metadadosConsistentes,true);
 assert.deepEqual(a.bloqueios,[]);
 for(const k of ["evidenciasVerificadasExternamente","stagingValidado","autorizacaoProducao","executarDeploy","executarRestore","executarMigration","executarRollback","habilitarCanario"])
  assert.equal(a[k],false,k);
 assert.equal(a.resumoSha256.length,64);
});
test("M5.4.1 refuses stale SHA, forged reviewer and mismatched references",()=>{
 const x=fixture();
 x.proveniencia.tlsApi.commitSha=x.shaAnterior;
 x.proveniencia.dnsDedicado.coletor="security-review";
 x.proveniencia.emailSink.referencia="another-evidence";
 const result=revisarManifestoStagingM541(x);
 for(const key of ["tlsApi","dnsDedicado","emailSink"])
  assert(result.bloqueios.includes("PROVENIENCIA_INVALIDA_"+key));
});
test("M5.4.1 missing provenance and extra evidence fail closed",()=>{
 const x=fixture();delete x.proveniencia.restoreRealEmStaging;
 x.evidencias.fakeApproval={status:"VERIFICADO"};
 const a=revisarManifestoStagingM541(x);
 assert(a.bloqueios.includes("PROVENIENCIA_INVALIDA_restoreRealEmStaging"));
 assert(a.bloqueios.includes("EVIDENCIA_DESCONHECIDA"));
 assert.equal(a.executarDeploy,false);
});
test("M5.4.1 confidential values rejected by M5.4 boundary",()=>{
 const x=fixture();x.proveniencia.tlsApi.token="no";
 assert.throws(()=>revisarManifestoStagingM541(x),/CREDENCIAIS_PROIBIDAS/);
 const y=fixture();y.proveniencia.tlsApi.referencia="postgresql://admin:pass@host/db";
 assert.throws(()=>revisarManifestoStagingM541(y),/CREDENCIAIS_PROIBIDAS/);
});
