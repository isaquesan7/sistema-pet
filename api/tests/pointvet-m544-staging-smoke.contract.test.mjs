import {test} from "node:test";
import assert from "node:assert/strict";
import {validarAlvosStagingM544,executarSmokeStagingM544} from "../src/modules/plataforma/pointvet-m544-staging-smoke.contract.js";
const input=()=>({commitSha:"a".repeat(40),api:"https://api.staging-pointvet.example.org",
 admin:"https://admin.staging-pointvet.example.org",portal:"https://portal.staging-pointvet.example.org"});
const goodResolve=async()=>[{address:"8.8.8.8",family:4}];
function fakeFetch(calls){
 return async (url,init)=>{
  calls.push({url,init});
  const path=new URL(url).pathname;
  const status=path==="/api/health"||path==="/api/health/database"||path==="/"?200:
   path==="/api/pdv-unificado/disponibilidade"||path==="/api/portal/me"?401:404;
  const body=status===200?{success:true,status:"online",database:{status:"connected"}}:{success:false};
  return {status,headers:{get:(key)=>key==="content-type"?"application/json":null},
    text:async()=>JSON.stringify(body)};
 };
}
test("M5.4.4 read only probes are opt-in and contain no credentials/POST",async()=>{
 const calls=[];const res=await executarSmokeStagingM544(input(),{
  confirmacao:"STAGING_READONLY_APPROVED",resolve:goodResolve,fetchImpl:fakeFetch(calls)
 });
 assert.equal(res.status,"SMOKE_LEITURA_APROVADO");
 assert.deepEqual(res.checks.map(x=>x.status),[200,200,401,401,404,200,200]);
 assert(calls.every(x=>["GET","HEAD"].includes(x.init.method)));
 assert(calls.every(x=>x.init.redirect==="manual"&&x.init.credentials==="omit"));
 assert(calls.every(x=>!x.init.headers.authorization&&!x.init.headers.cookie));
 for(const key of ["autorizarProducao","executarDeploy","executarMigration","executarRestore","habilitarCanario"])
  assert.equal(res[key],false,key);
 assert(!JSON.stringify(res).includes("8.8.8.8"));
});
test("M5.4.4 refuses targets without dedicated staging identity or invalid TLS URL",()=>{
 for(const api of ["https://api.pointvet.com.br","https://api.staging.pointvet.com.br",
  "http://api.staging-other.com","https://localhost","https://127.0.0.1",
  "https://api.staging-other.com:8443","https://user:pass@api.staging-other.com",
  "https://api.staging-other.com/path","https://api.staging-other.com/?token=x",
  "https://api.staging-other.example"]){
  assert.throws(()=>validarAlvosStagingM544({...input(),api}),/M544_ORIGEM_PROIBIDA_API/);
 }
 assert.throws(()=>validarAlvosStagingM544({...input(),admin:input().api}),/M544_HOSTS_NAO_SEGREGADOS/);
 assert.throws(()=>validarAlvosStagingM544({...input(),commitSha:"abc"}),/M544_SHA_INVALIDO/);
});
test("M5.4.4 refuses invocation without explicit approval, bad DNS or disabled TLS",async()=>{
 const calls=[];const fetchImpl=fakeFetch(calls);
 await assert.rejects(()=>executarSmokeStagingM544(input(),{fetchImpl,resolve:goodResolve}),/M544_APROVACAO_EXPLICITA_AUSENTE/);
 await assert.rejects(()=>executarSmokeStagingM544(input(),{fetchImpl,resolve:goodResolve,
  confirmacao:"STAGING_READONLY_APPROVED",tlsRejectUnauthorized:"0"}),/M544_TLS_DESABILITADO/);
 await assert.rejects(()=>executarSmokeStagingM544(input(),{fetchImpl,
  resolve:async()=>[{address:"127.0.0.1"}],confirmacao:"STAGING_READONLY_APPROVED"}),/M544_DNS_NAO_PUBLICO/);
 assert.equal(calls.length,0);
});
test("M5.4.4 fails closed for unexpected HTTP statuses, body or redirects",async()=>{
 const fallback=fakeFetch([]);
 for(const mutation of ["bad-status","bad-json","redirect"]){
  const fetchImpl=async(url,init)=>{
   if(new URL(url).pathname==="/api/health"){
    if(mutation==="bad-status")return {status:503,headers:{get:()=>null},text:async()=>""};
    if(mutation==="bad-json")return {status:200,headers:{get:()=>"application/json"},text:async()=>"<html>"};
    return {status:302,headers:{get:()=>null},text:async()=>""};
   }
   return fallback(url,init);
  };
  await assert.rejects(()=>executarSmokeStagingM544(input(),{
   confirmacao:"STAGING_READONLY_APPROVED",resolve:goodResolve,fetchImpl
  }),/M544_HTTP_/);
 }
});
