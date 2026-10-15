/**
 * PointVet M.5.2 — sanitized STAGING ISOLATION preflight (PURE).
 *
 * Caller supplies metadata, NEVER credentials or database URLs. A green CI
 * scenario is NOT evidence that a Railway environment actually exists.
 *
 * This has NO I/O, no provisioning, no network, no connection to backups,
 * no migration/deploy, no notification, no fiscal document and no payment.
 */
import {createHash} from "node:crypto";

const halt=code=>{throw Error(code);};
const plain=o=>o!==null&&typeof o==="object"&&!Array.isArray(o);
const nonempty=x=>typeof x==="string"&&x.trim().length>=3&&x.trim().length<=180;
const SHA=/^[a-f0-9]{40}$/;
const VALID_SERVICE=/^[a-z][a-z0-9-]{2,100}$/;
const SENSITIVE=/(?:password|senha|token|secret|authorization|privatekey|databaseurl|connectionstring|dsn|accesskey|certificate|cookie)/i;
const SAFE_NETWORK_HOST=/^(?!localhost$)(?!127\.)(?!0\.)(?!10\.)(?!192\.168\.)(?!169\.254\.)(?!172\.(?:1[6-9]|2[0-9]|3[01])\.)[a-z0-9][a-z0-9.-]{3,250}$/;
const BLOCKED_DOMAIN=/(?:^|\.)(?:pointvet\.com\.br|petking\.com\.br)$/;
const normalize=x=>typeof x==="string"?x.trim().toLowerCase():"";
const fingerprint=o=>createHash("sha256").update(JSON.stringify(o)).digest("hex");
function checkPublicHttps(value,issues,code){
 if(typeof value!=="string"){issues.push(code);return null;}
 try{
  const u=new URL(value);
  if(u.protocol!=="https:"||!u.hostname||u.username||u.password||
     u.port||u.search||u.hash||u.pathname!=="/"||
     !SAFE_NETWORK_HOST.test(u.hostname)||BLOCKED_DOMAIN.test(u.hostname)){
   issues.push(code);return null;
  }
  return u.hostname.toLowerCase();
 }catch{issues.push(code);return null;}
}
function checkedMetadata(input){
 if(!plain(input))halt("M5_STAGING_MANIFEST_INVALIDO");
 const secretPaths=[];
 function visit(o,prefix,depth){
  if(depth>5)halt("M5_STAGING_OBJETO_EXCESSIVO");
  if(!plain(o))return;
  for(const [k,v] of Object.entries(o)){
   if(SENSITIVE.test(k))secretPaths.push(prefix+k);
   if(typeof v==="string"&&(/:\/\/[^/@\s]+:[^/@\s]+@/.test(v)||
       /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(v)))
    secretPaths.push(prefix+k);
   if(plain(v))visit(v,prefix+k+".",depth+1);
  }
 }
 visit(input,"",0);
 if(secretPaths.length)halt("M5_STAGING_METADATA_CONTEM_CREDENCIAIS");
}
const immutable=(x)=>Object.freeze(x);
export function verificarIsolamentoStagingM52(input){
 checkedMetadata(input);
 const issues=[];
 const staging=input.staging,production=input.production;
 if(!plain(staging)||!plain(production))halt("M5_STAGING_AMBIENTES_OBRIGATORIOS");
 if(input.fase!=="M5_2_STAGING_PREPARACAO")issues.push("FASE_INCORRETA");
 if(input.commitSha&&!SHA.test(input.commitSha))issues.push("SHA_INVALIDO");
 if(staging.nome!=="staging"||production.nome!=="production")issues.push("IDENTIDADE_AMBIENTE_INVALIDA");
 for(const env of [staging,production]){
  if(!nonempty(env.projectId)||!nonempty(env.environmentId)||
     !nonempty(env.databaseClusterId)||!nonempty(env.databaseHost)||
     !nonempty(env.databaseName)||!nonempty(env.storageBucket)||
     !nonempty(env.mailerMode)||!nonempty(env.fiscalMode)||
     !nonempty(env.paymentMode)||!nonempty(env.webhookMode))
   issues.push("METADADOS_DE_AMBIENTE_INCOMPLETOS");
  if(!SAFE_NETWORK_HOST.test(normalize(env.databaseHost)))
   issues.push("HOST_BANCO_FORA_PADRAO");
 }
 const pairs=[
  ["projectId","PROJETO_RAILWAY_COMPARTILHADO"],
  ["environmentId","AMBIENTE_RAILWAY_COMPARTILHADO"],
  ["databaseClusterId","CLUSTER_POSTGRES_COMPARTILHADO"],
  ["databaseHost","HOST_POSTGRES_COMPARTILHADO"],
  ["databaseName","NOME_BANCO_COMPARTILHADO"],
  ["storageBucket","BUCKET_STORAGE_COMPARTILHADO"]
 ];
 for(const [field,issue] of pairs){
  if(normalize(staging[field])&&normalize(staging[field])===normalize(production[field]))
   issues.push(issue);
 }
 if(staging.mailerMode!=="sink-only")issues.push("EMAIL_STAGING_NAO_ISOLADO");
 if(staging.fiscalMode!=="simulator-offline")issues.push("FISCAL_STAGING_EXTERNO");
 if(staging.paymentMode!=="manual-local-only")issues.push("PAGAMENTO_STAGING_EXTERNO");
 if(staging.webhookMode!=="disabled")issues.push("WEBHOOK_STAGING_ATIVO");
 if(staging.externalNotifications!==false)issues.push("NOTIFICACOES_EXTERNAS_STAGING");
 if(staging.customerDataMode!=="synthetic-only")issues.push("DADOS_CLIENTE_NAO_SINTETICOS");
 if(staging.unifiedPdvEnabled!==false)issues.push("PDV_UNIFICADO_STAGING_ATIVO_SEM_REVISAO");
 if(staging.fiscalEmissionEnabled!==false)issues.push("EMISSAO_FISCAL_STAGING_ATIVA");
 if(staging.creditCheckoutEnabled!==false)issues.push("CREDITO_NO_CHECKOUT_STAGING");
 if(staging.pspIntegrationEnabled!==false)issues.push("INTEGRACAO_MAQUININHA_STAGING");
 if(staging.deployEnabled!==false)issues.push("DEPLOY_AUTOMATICO_STAGING_ATIVO");
 if(staging.tenantCanaryEnabled!==false)issues.push("CANARIO_ATIVO_SEM_APROVACAO");
 if(!plain(staging.urls)||!plain(production.urls))issues.push("URLS_INCOMPLETAS");
 const stDomains=new Set(),prDomains=new Set();
 for(const type of ["api","admin","portal"]){
  const s=checkPublicHttps(staging.urls?.[type],issues,"STAGING_HTTPS_INVALIDO_"+type.toUpperCase());
  const p=typeof production.urls?.[type]==="string"?production.urls[type]:null;
  let ph;
  try{if(p){const u=new URL(p);if(u.protocol==="https:")ph=u.hostname.toLowerCase()}}catch{}
  if(!ph)issues.push("URL_PRODUCAO_REFERENCIA_AUSENTE_"+type.toUpperCase());
  if(s)stDomains.add(s);
  if(ph)prDomains.add(ph);
 }
 if(stDomains.size!==3)issues.push("HOSTS_STAGING_NAO_SEGREGADOS");
 if([...stDomains].some(x=>prDomains.has(x)))issues.push("HOSTS_STAGING_IGUAIS_PRODUCAO");
 if(plain(staging.flags)&&Object.values(staging.flags).some(v=>v!==false))
  issues.push("FLAGS_EXPERIMENTAIS_STAGING_NAO_DESLIGADAS");
 if(!plain(staging.flags))issues.push("FLAGS_NAO_INFORMADAS");
 const envSummary=(v)=>({
  nome:v.nome,projectId:v.projectId||null,environmentId:v.environmentId||null,
  databaseClusterId:v.databaseClusterId||null,databaseHost:v.databaseHost||null,
  databaseName:v.databaseName||null,storageBucket:v.storageBucket||null
 });
 const blockers=[...new Set(issues)].sort();
 return immutable({
  fase:"M5_2_STAGING_PREPARACAO",
  commitSha:input.commitSha||null,
  staging:envSummary(staging),production:envSummary(production),
  descricaoEvidencias:"Metadados declarados sem conexao a Railway/PostgreSQL/SMTP",
  evidenciaExternaVerificada:false,
  configuracaoDeclaradaIsolada:blockers.length===0,
  impedimentos:blockers,
  fingerprintChecklist:fingerprint({commitSha:input.commitSha||null,
   staging:envSummary(staging),production:envSummary(production),blockers}),
  stagingCriado:false,stagingValidadoRealmente:false,
  backupRealRestaurado:false,publicacaoAutorizada:false,
  permitirDeploy:false,permitirBackfill:false,
  habilitarPDVUnificado:false,emitirNotaFiscalReal:false
 });
}
