import {test} from "node:test";
import assert from "node:assert/strict";
import {avaliarEvidenciasStagingM54} from "../src/modules/plataforma/pointvet-m54-evidencias.contract.js";
const names=["infraSegregada","tlsApi","tlsAdmin","tlsPortal","dnsDedicado","emailSink","webhooksDesativados","dadosSinteticos","smokeHttpReadOnly","authTenantIsolado","observabilidadeAlertas","backupRealAutorizado","restoreRealEmStaging","rtoRpoMedidos","migrationsRevisadas","rollbackReleaseStaging","rollbackFlagsStaging","revisaoLgpd","aprovacaoHumanaIndependente"];
const base=()=>({fase:"M5_4_HOMOLOGACAO_REAL",commitSha:"a".repeat(40),shaAnterior:"b".repeat(40),
 evidencias:Object.fromEntries(names.map((name,i)=>[name,{status:"VERIFICADO",referencia:"ci-evidence-"+i,revisor:"reviewer"}]))});
test("M5.4 evidencia declarada completa não autoriza efeitos reais",()=>{
 const r=avaliarEvidenciasStagingM54(base());
 assert.equal(r.checklistDeclaradoCompleto,true);
 assert.deepEqual(r.bloqueios,[]);
 for(const k of ["evidenciasConferidasExternamente","ambienteStagingValidado","backupRealRestauradoConfirmado","autorizarProducao","executarDeploy","executarRestore","executarMigration","executarRollback","habilitarCanario"])
  assert.equal(r[k],false,k);
 assert.equal(r.fingerprint.length,64);
});
test("M5.4 ausência de prova, SHA igual e revisão incompleta bloqueiam",()=>{
 const x=base();delete x.evidencias.restoreRealEmStaging;
 x.evidencias.tlsApi.status="PENDENTE";x.shaAnterior=x.commitSha;
 const r=avaliarEvidenciasStagingM54(x);
 assert(r.bloqueios.includes("EVIDENCIA_PENDENTE_restoreRealEmStaging"));
 assert(r.bloqueios.includes("EVIDENCIA_PENDENTE_tlsApi"));
 assert(r.bloqueios.includes("SHA_ANTERIOR_INVALIDO"));
 assert.equal(r.executarDeploy,false);
});
test("M5.4 não permite credenciais nem URL com autenticação",()=>{
 const x=base();x.databaseUrl="postgresql://private";
 assert.throws(()=>avaliarEvidenciasStagingM54(x),/CREDENCIAIS_PROIBIDAS/);
 const y=base();y.evidencias.tlsApi.referencia="https://user:password@host.test";
 assert.throws(()=>avaliarEvidenciasStagingM54(y),/CREDENCIAIS_PROIBIDAS/);
});
test("M5.4 evita prova vaga e é determinístico",()=>{
 const x=base();x.evidencias.emailSink.referencia="ok";
 const r=avaliarEvidenciasStagingM54(x);
 assert(r.bloqueios.includes("EVIDENCIA_PENDENTE_emailSink"));
 assert.equal(avaliarEvidenciasStagingM54(base()).fingerprint,avaliarEvidenciasStagingM54(base()).fingerprint);
});
