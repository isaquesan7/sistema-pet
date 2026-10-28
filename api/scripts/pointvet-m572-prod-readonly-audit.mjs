#!/usr/bin/env node
/** M.5.72 — auditoria comercial LOCAL e exclusivamente de leitura.
 * Nunca faz backup/restore, nao chama Prisma migrate, nao ativa feature flags,
 * nao imprime credenciais ou registros; nao executa SQL sem pedido explicito.
 */
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {planProductionReadOnlyAudit,assessProductionReadOnlyAudit,summarizePsqlAuditFailure}
 from "../src/modules/plataforma/pointvet-m572-preflight.contract.mjs";

const block=msg=>{throw Error("POINTVET_M572_AUDIT_BLOCKED: "+msg);};
const flags=new Set(process.argv.slice(2));
if(flags.size!==1||![...flags].every(x=>["--config-only","--inspect-readonly"].includes(x)))
 block("use --config-only ou --inspect-readonly; nunca realiza migrate/deploy");
const plan=planProductionReadOnlyAudit({
 url:process.env.POINTVET_PROD_PREFLIGHT_URL,
 projectId:process.env.POINTVET_PROD_PREFLIGHT_PROJECT_ID,
 serviceId:process.env.POINTVET_PROD_PREFLIGHT_SERVICE_ID
});
if(flags.has("--config-only")){
 console.log("POINTVET_M572_AUDIT_CONFIG_OK: identidade declarada, banco NAO consultado");
 process.exit(0);
}
const sql=readFileSync(new URL("./pointvet-m572-prod-preflight.sql",import.meta.url),"utf8");
const db=plan.db;
const env={...process.env,PGHOST:db.hostname,PGPORT:String(db.port),
 PGUSER:db.username,PGPASSWORD:db.password,PGDATABASE:db.database,
 PGSSLMODE:db.sslmode,PGCONNECT_TIMEOUT:"12",
 PGOPTIONS:"-c default_transaction_read_only=on -c statement_timeout=120000",
 PGAPPNAME:"pointvet-m572-prod-readonly-audit"};
for(const key of ["DATABASE_URL","PGHOSTADDR","PGSERVICE","PGSERVICEFILE",
 "PGPASSFILE","PGREQUIRESSL","PGTARGETSESSIONATTRS"])delete env[key];
const ret=spawnSync("psql",["-X","-w","-q","-A","-t",
 "-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose","-c",sql],{
 env,encoding:"utf8",timeout:150000,maxBuffer:1024*1024,
 stdio:["ignore","pipe","pipe"]
});
if(ret.error||ret.status!==0)
 block("psql falhou; codigo seguro="+summarizePsqlAuditFailure({
  errorCode:ret.error?.code,status:ret.status,signal:ret.signal,stderr:ret.stderr
 })+"; detalhes protegidos; nenhuma migracao/deploy executada");
let raw;
try{raw=JSON.parse(ret.stdout.trim());}
catch{block("resposta de auditoria SQL nao e JSON valido");}
const outcome=assessProductionReadOnlyAudit(raw);
console.log(JSON.stringify(outcome));
if(outcome.blockers.length)process.exitCode=2;
