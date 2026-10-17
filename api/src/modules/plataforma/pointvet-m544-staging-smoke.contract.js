/**
 * PointVet M.5.4.4 — read-only staging HTTPS smoke. NO deploy, DNS mutation,
 * migration, backup, finance, fiscal, email or tenant write operations.
 * Nothing is probed until a caller explicitly invokes executarSmokeStagingM544.
 */
import {lookup as dnsLookup} from "node:dns/promises";

const SHA=/^[a-f0-9]{40}$/;
const BLOCKED_SUFFIX=/(?:^|\.)(?:pointvet\.com\.br|petking\.com\.br)$/i;
const RESERVED_SUFFIX=/(?:^|\.)(?:example|invalid|localhost|test|local)$/i;
const HOST=/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/;
function fail(code){throw Error(code);}
function validateOrigin(raw,label){
 if(typeof raw!=="string"||raw.length>300)fail("M544_ORIGEM_INVALIDA_"+label);
 let url;
 try{url=new URL(raw);}catch{fail("M544_ORIGEM_INVALIDA_"+label);}
 const host=url.hostname.toLowerCase();
 if(url.protocol!=="https:"||url.username||url.password||url.port||
    url.pathname!=="/"||url.search||url.hash||
    host.length>253||!HOST.test(host)||host.includes("..")||
    !/(?:^|[.-])staging(?:[.-]|$)/.test(host)||
    BLOCKED_SUFFIX.test(host)||RESERVED_SUFFIX.test(host)||!host.includes("."))
   fail("M544_ORIGEM_PROIBIDA_"+label);
 return {host,origin:url.origin};
}
export function validarAlvosStagingM544({commitSha,api,admin,portal}={}){
 if(!SHA.test(commitSha||""))fail("M544_SHA_INVALIDO");
 const targets={api:validateOrigin(api,"API"),admin:validateOrigin(admin,"ADMIN"),portal:validateOrigin(portal,"PORTAL")};
 if(new Set(Object.values(targets).map(t=>t.host)).size!==3)
  fail("M544_HOSTS_NAO_SEGREGADOS");
 return Object.freeze({commitSha,api:targets.api.origin,admin:targets.admin.origin,
  portal:targets.portal.origin});
}
function publicIPv4(address){
 const parts=address.split(".");
 if(parts.length!==4||parts.some(n=>!/^(0|[1-9]\d{0,2})$/.test(n)||Number(n)>255))return false;
 const [a,b,c,d]=parts.map(Number);
 if(!a||a===10||a===127||a>=224||a===169&&b===254||
   a===172&&b>=16&&b<=31||a===192&&b===168||
   a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||
   a===192&&(b===0&&c===2||b===0&&c===0||b===88&&c===99)||
   a===203&&b===0&&c===113||a===255||a===0)
  return false;
 return d>=0;
}
async function checkDns(origin,resolve){
 const host=new URL(origin).hostname;
 const records=await resolve(host,{family:4,all:true});
 if(!Array.isArray(records)||!records.length||records.some(r=>!publicIPv4(r.address)))
  fail("M544_DNS_NAO_PUBLICO");
}
async function probe(fetchImpl,base,path,expected,method="GET"){
 const response=await fetchImpl(base+path,{
  method,redirect:"manual",credentials:"omit",cache:"no-store",
  signal:AbortSignal.timeout(8000),
  headers:{accept:method==="HEAD"?"text/html":"application/json"}
 });
 if(response.status!==expected)fail("M544_HTTP_STATUS_DIVERGENTE");
 if(response.status>=300&&response.status<400)fail("M544_REDIRECIONAMENTO_PROIBIDO");
 if(method==="HEAD")return Object.freeze({path,status:response.status});
 const mime=response.headers?.get?.("content-type")||"";
 if(!/application\/json/i.test(mime))fail("M544_HTTP_NAO_JSON");
 const length=Number(response.headers?.get?.("content-length")||0);
 if(length>16384)fail("M544_HTTP_CORPO_EXCESSIVO");
 const raw=await response.text();
 if(raw.length>16384)fail("M544_HTTP_CORPO_EXCESSIVO");
 let data;
 try{data=JSON.parse(raw);}catch{fail("M544_HTTP_JSON_INVALIDO");}
 if(data?.success!==(expected===200))fail("M544_HTTP_CONTRATO_INVALIDO");
 if(path==="/api/health"&&data?.status!=="online")fail("M544_API_OFFLINE");
 if(path==="/api/health/database"&&data?.database?.status!=="connected")fail("M544_BANCO_INDISPONIVEL");
 return Object.freeze({path,status:response.status});
}
/**
 * Actual network probes only when explicitly invoked by CLI or a trusted caller.
 * Outputs no body, personal data, credentials or environment variables.
 */
export async function executarSmokeStagingM544(input,{
 fetchImpl=fetch,resolve=dnsLookup,
 confirmacao=null,tlsRejectUnauthorized=process.env.NODE_TLS_REJECT_UNAUTHORIZED
}={}){
 if(confirmacao!=="STAGING_READONLY_APPROVED")fail("M544_APROVACAO_EXPLICITA_AUSENTE");
 if(tlsRejectUnauthorized==="0")fail("M544_TLS_DESABILITADO");
 const targets=validarAlvosStagingM544(input);
 for(const origin of [targets.api,targets.admin,targets.portal])
  await checkDns(origin,resolve);
 const checks=[
  await probe(fetchImpl,targets.api,"/api/health",200),
  await probe(fetchImpl,targets.api,"/api/health/database",200),
  await probe(fetchImpl,targets.api,"/api/pdv-unificado/disponibilidade",401),
  await probe(fetchImpl,targets.api,"/api/portal/me",401),
  await probe(fetchImpl,targets.api,"/api/pointvet-m544-unknown-route",404),
  await probe(fetchImpl,targets.admin,"/",200,"HEAD"),
  await probe(fetchImpl,targets.portal,"/",200,"HEAD")
 ];
 return Object.freeze({fase:"M5_4_4_SMOKE_STAGING_HTTPS",commitSha:targets.commitSha,
  status:"SMOKE_LEITURA_APROVADO",validacaoDeCertificado:"PADRAO_HTTPS_NODE",
  checks:Object.freeze(checks),verificacaoDeRollback:false,
  backupRealRestaurado:false,autorizarProducao:false,executarDeploy:false,
  executarMigration:false,executarRestore:false,habilitarCanario:false});
}
