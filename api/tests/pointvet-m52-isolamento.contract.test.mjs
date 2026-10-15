import {test} from "node:test";
import assert from "node:assert/strict";
import {verificarIsolamentoStagingM52} from "../src/modules/plataforma/pointvet-m52-isolamento.contract.js";
const base=()=>({
 fase:"M5_2_STAGING_PREPARACAO",commitSha:"a".repeat(40),
 production:{
  nome:"production",projectId:"railway-project-live",environmentId:"production-env",
  databaseClusterId:"pg-cluster-live",databaseHost:"prod.postgres.internal.example",
  databaseName:"pointvet_live",storageBucket:"pointvet-live-media",
  mailerMode:"resend",fiscalMode:"legacy",paymentMode:"manual",
  webhookMode:"production",
  urls:{api:"https://api.pointvet.com.br",admin:"https://app.pointvet.com.br",
   portal:"https://portal.pointvet.com.br"}
 },
 staging:{
  nome:"staging",projectId:"railway-project-staging",environmentId:"staging-env",
  databaseClusterId:"pg-cluster-staging",databaseHost:"staging.db.example",
  databaseName:"pointvet_staging",storageBucket:"pointvet-staging-synthetic",
  mailerMode:"sink-only",fiscalMode:"simulator-offline",
  paymentMode:"manual-local-only",webhookMode:"disabled",
  externalNotifications:false,customerDataMode:"synthetic-only",
  unifiedPdvEnabled:false,fiscalEmissionEnabled:false,creditCheckoutEnabled:false,
  pspIntegrationEnabled:false,deployEnabled:false,tenantCanaryEnabled:false,
  urls:{api:"https://api.staging-pointvet.example",admin:"https://app.staging-pointvet.example",
   portal:"https://portal.staging-pointvet.example"},
  flags:{unifiedPdv:false,customerCredit:false,fiscalTransmission:false}
 }
});
test("M5.2 complete sanitized manifest is still unverified and cannot deploy",()=>{
 const result=verificarIsolamentoStagingM52(base());
 assert.equal(result.configuracaoDeclaradaIsolada,true);
 assert.deepEqual(result.impedimentos,[]);
 for(const key of ["evidenciaExternaVerificada","stagingCriado","stagingValidadoRealmente",
  "backupRealRestaurado","publicacaoAutorizada","permitirDeploy","permitirBackfill"])
  assert.equal(result[key],false,key);
 assert.equal(result.fingerprintChecklist.length,64);
 assert(!JSON.stringify(result).includes("password"));
});
test("M5.2 rejects shared tenant infrastructure and unsafe production callbacks",()=>{
 const v=base();
 v.staging.projectId=v.production.projectId;
 v.staging.databaseHost=v.production.databaseHost;
 v.staging.databaseClusterId=v.production.databaseClusterId;
 v.staging.storageBucket=v.production.storageBucket;
 v.staging.urls.api=v.production.urls.api;
 v.staging.mailerMode="resend";
 v.staging.webhookMode="production";
 v.staging.customerDataMode="production-raw";
 v.staging.fiscalEmissionEnabled=true;
 v.staging.pspIntegrationEnabled=true;
 const r=verificarIsolamentoStagingM52(v);
 for(const x of ["PROJETO_RAILWAY_COMPARTILHADO","CLUSTER_POSTGRES_COMPARTILHADO",
  "HOST_POSTGRES_COMPARTILHADO","BUCKET_STORAGE_COMPARTILHADO","HOSTS_STAGING_IGUAIS_PRODUCAO",
  "EMAIL_STAGING_NAO_ISOLADO","WEBHOOK_STAGING_ATIVO","DADOS_CLIENTE_NAO_SINTETICOS",
  "EMISSAO_FISCAL_STAGING_ATIVA","INTEGRACAO_MAQUININHA_STAGING"])
  assert(r.impedimentos.includes(x),x);
 assert.equal(r.permitirDeploy,false);
});
test("M5.2 no credentials, database URLs or internal IPs in manifest",()=>{
 for(const [key,value] of [
  ["DATABASE_URL","postgresql://user:pass@host/db"],["jwtAccessSecret","abc"],
  ["authorization","Bearer abc"]
 ]){const v=base();v.staging[key]=value;
  assert.throws(()=>verificarIsolamentoStagingM52(v),/M5_STAGING_METADATA_CONTEM_CREDENCIAIS/);
 }
 const v=base();v.staging.databaseHost="127.0.0.1";
 assert(verificarIsolamentoStagingM52(v).impedimentos.includes("HOST_BANCO_FORA_PADRAO"));
 const o=base();o.staging.urls.portal="http://localhost:5174";
 assert(verificarIsolamentoStagingM52(o).impedimentos.includes("STAGING_HTTPS_INVALIDO_PORTAL"));
});
test("M5.2 denies missing/invalid stage and re-used URL host",()=>{
 const v=base();v.staging.nome="production";v.staging.urls.admin=v.staging.urls.api;
 const r=verificarIsolamentoStagingM52(v);
 assert(r.impedimentos.includes("IDENTIDADE_AMBIENTE_INVALIDA"));
 assert(r.impedimentos.includes("HOSTS_STAGING_NAO_SEGREGADOS"));
 const w=base();w.staging.flags.fiscalTransmission=true;
 assert(verificarIsolamentoStagingM52(w).impedimentos.includes("FLAGS_EXPERIMENTAIS_STAGING_NAO_DESLIGADAS"));
});
