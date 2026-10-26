#!/usr/bin/env node
/** M.5.71: recuperação exclusivamente em PostgreSQL DR vazio e independente.
 * Fonte staging somente leitura. Sem dados, credenciais ou dumps nos logs/GitHub.
 * Exige aprovação explícita; IDs de projetos devem ser conferidos no Railway
 * pelo operador porque o PostgreSQL não autentica os IDs informados.
 */
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {createReadStream,mkdtempSync,rmSync,statSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {validarPlanoDR} from "../src/modules/plataforma/pointvet-m571-dr-guard.contract.mjs";
const fail=message=>{throw Error("POINTVET_M571_DR_FAILED: "+message)};
const args=new Set(process.argv.slice(2));
if(args.has("--help")||!args.size){
 console.log("Usage: node scripts/pointvet-m571-staging-drill.mjs --preflight-only | --run-isolated-dr");
 console.log("Env: POINTVET_DR_SOURCE_URL, POINTVET_DR_TARGET_URL, POINTVET_DR_SOURCE_PROJECT_ID, POINTVET_DR_TARGET_PROJECT_ID, POINTVET_DR_SOURCE_SERVICE_ID, POINTVET_DR_TARGET_SERVICE_ID, POINTVET_DR_CONFIRMATION");
 process.exit(0);
}
if(args.size!==1||(!args.has("--preflight-only")&&!args.has("--run-isolated-dr")))
 fail("use exactly one mode");
const plan=validarPlanoDR({
 sourceUrl:process.env.POINTVET_DR_SOURCE_URL,
 targetUrl:process.env.POINTVET_DR_TARGET_URL,
 sourceProjectId:process.env.POINTVET_DR_SOURCE_PROJECT_ID,
 targetProjectId:process.env.POINTVET_DR_TARGET_PROJECT_ID,
 sourceServiceId:process.env.POINTVET_DR_SOURCE_SERVICE_ID,
 targetServiceId:process.env.POINTVET_DR_TARGET_SERVICE_ID,
 confirmacao:process.env.POINTVET_DR_CONFIRMATION
});
if(args.has("--preflight-only")){
 console.log("POINTVET_M571_DR_PREFLIGHT_OK: declaracoes validas; restore NAO executado");
 process.exit(0);
}
if(process.env.POINTVET_DR_EXECUTION_APPROVAL!=="YES_FRESH_EMPTY_DR_DATABASE")
 fail("second explicit execution approval missing");
function pgEnv(c,readOnly){
 const env={...process.env,PGHOST:c.hostname,PGPORT:String(c.port),PGUSER:c.username,
  PGPASSWORD:c.password,PGDATABASE:c.database,PGSSLMODE:c.sslmode,PGCONNECT_TIMEOUT:"15"};
 delete env.DATABASE_URL;delete env.PGSERVICE;delete env.PGSERVICEFILE;delete env.PGHOSTADDR;
 if(readOnly)env.PGOPTIONS="-c default_transaction_read_only=on";
 else delete env.PGOPTIONS;
 return env;
}
const source=pgEnv(plan.source,true),target=pgEnv(plan.target,false);
function run(bin,argv,env){
 const r=spawnSync(bin,argv,{env,encoding:"utf8",maxBuffer:16*1024*1024,
  timeout:30*60*1000,stdio:["ignore","pipe","pipe"]});
 if(r.error||r.status!==0)fail(bin+" error (details suppressed to protect database metadata)");
 return (r.stdout||"").trim();
}
const sql=(env,q)=>run("psql",["-X","-A","-t","-q","-v","ON_ERROR_STOP=1","-c",q],env);
const listSql="SELECT '\"'||replace(table_schema,'\"','\"\"')||'\".\"'||"+
 "replace(table_name,'\"','\"\"')||'\"' FROM information_schema.tables "+
 "WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name";
const tables=env=>sql(env,listSql).split("\n").filter(Boolean);
function tableDigest(env,t){
 if(!/^"[^"]+(?:""[^"]+)*"\."[^"]+(?:""[^"]+)*"$/.test(t))fail("unsafe table identifier");
 return sql(env,"SELECT count(*)::text||':'||md5(coalesce(string_agg(md5(to_jsonb(r)::text),"+
  "'' ORDER BY md5(to_jsonb(r)::text)),'')) FROM "+t+" r");
}
function schemaCounts(env){
 return sql(env,"SELECT (SELECT count(*) FROM pg_indexes WHERE schemaname='public')||':'||"+
 "(SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public')||':'||"+
 "(SELECT count(*) FROM pg_sequences WHERE schemaname='public')||':'||"+
 "(SELECT count(*) FROM pg_views WHERE schemaname='public')||':'||"+
 "(SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal)");
}
function reversalsValid(env){
 return sql(env,"WITH original AS ("+
 " SELECT e.id AS estorno,m.\"produtoId\" AS produto,m.\"loteId\" AS lote,sum(m.quantidade) AS peso"+
 " FROM estornos_fechamento_manual_unificado e JOIN reservas_operacoes_unificadas op ON op.\"reservaId\"=e.\"reservaId\""+
 " JOIN movimentacoes_estoque m ON m.\"origemTipo\"='VENDA' AND m.\"origemId\"=op.\"vendaId\" AND m.tipo='VENDA'"+
 " GROUP BY e.id,m.\"produtoId\",m.\"loteId\"), reverted AS ("+
 " SELECT e.id AS estorno,m.\"produtoId\" AS produto,m.\"loteId\" AS lote,sum(m.quantidade) AS peso"+
 " FROM estornos_fechamento_manual_unificado e JOIN movimentacoes_estoque m"+
 " ON m.\"origemTipo\"='ESTORNO_MANUAL_UNIFICADO' AND m.\"origemId\"=e.id AND m.tipo='CANCELAMENTO'"+
 " GROUP BY e.id,m.\"produtoId\",m.\"loteId\"), mismatch AS ("+
 " SELECT 1 FROM original o FULL JOIN reverted r ON o.estorno=r.estorno AND o.produto=r.produto"+
 " AND o.lote IS NOT DISTINCT FROM r.lote WHERE o.peso IS DISTINCT FROM r.peso)"+
 " SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM mismatch) AND NOT EXISTS("+
 " SELECT 1 FROM estornos_fechamento_manual_unificado e"+
 " JOIN reservas_fechamento_unificado r ON r.id=e.\"reservaId\""+
 " JOIN comandas c ON c.id=r.\"comandaId\""+
 " WHERE r.status<>'CANCELADA' OR c.status<>'CANCELADA') AND NOT EXISTS("+
 " SELECT 1 FROM estornos_fechamento_manual_unificado e"+
 " JOIN reservas_operacoes_unificadas op ON op.\"reservaId\"=e.\"reservaId\""+
 " LEFT JOIN vendas v ON v.id=op.\"vendaId\""+
 " WHERE op.status<>'ESTORNADA' OR v.status IS DISTINCT FROM 'ESTORNADA'"+
 " OR EXISTS(SELECT 1 FROM pagamentos p WHERE p.\"vendaId\"=v.id AND p.status<>'ESTORNADO'))"+
 " THEN 'CONSISTENT' ELSE 'DIVERGENT' END");
}
let scratch;
try{
 for(const bin of ["psql","pg_dump","pg_restore"])run(bin,["--version"],source);
 const started=Date.now();
 const check=env=>sql(env,"SELECT current_database()||':'||"+
  "current_setting('default_transaction_read_only')||':'||current_setting('server_version_num')");
 // Real PostgreSQL cluster identity, not a Railway label or host alias.
 // Requires pg_control_system() privileges. If denied, fail closed.
 const clusterSource=sql(source,"SELECT system_identifier::text FROM pg_control_system()");
 const clusterTarget=sql(target,"SELECT system_identifier::text FROM pg_control_system()");
 if(!/^\\d{10,}$/.test(clusterSource)||!/^\\d{10,}$/.test(clusterTarget)||
    clusterSource===clusterTarget)fail("source and DR target are the same or unverified PostgreSQL cluster");
 const [srcDb,srcRead,srcVersion]=check(source).split(":");
 const [dstDb,dstRead,dstVersion]=check(target).split(":");
 if(srcDb!==plan.source.database||dstDb!==plan.target.database||srcRead!=="on"||dstRead!=="off")
  fail("source read-only or database identity check failed");
 if(Math.floor(Number(srcVersion)/10000)!==Math.floor(Number(dstVersion)/10000))
  fail("PostgreSQL major versions differ");
 const empty=sql(target,"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace"+
  " WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')");
 if(empty!=="0")fail("target has public objects; restore refused");
 const sourceTables=tables(source);
 if(sourceTables.length<25||!sourceTables.includes('"public"."_prisma_migrations"'))
  fail("source missing PointVet schema or migration history");
 scratch=mkdtempSync(join(tmpdir(),"pointvet-m571-dr-"));
 const dump=join(scratch,"backup.dump");
 run("pg_dump",["--format=custom","--no-owner","--no-acl","--file",dump],source);
 const bytes=statSync(dump).size;
 if(bytes<10000)fail("dump suspiciously small");
 const sha=createHash("sha256");
 for await(const chunk of createReadStream(dump))sha.update(chunk);
 const checksum=sha.digest("hex");
 if(tables(target).length!==0)fail("target changed before restore");
 // Only this operation writes: into the independently verified EMPTY DR target.
 run("pg_restore",["--format=custom","--no-owner","--no-acl",
  "--exit-on-error","--dbname",plan.target.database,dump],target);
 const targetTables=tables(target);
 if(sourceTables.join("|")!==targetTables.join("|"))fail("restored table inventory differs");
 for(const name of sourceTables)
  if(tableDigest(source,name)!==tableDigest(target,name))
   fail("row count or checksum differs after restore (data suppressed)");
 if(schemaCounts(source)!==schemaCounts(target))
  fail("index/constraint/sequence/view/trigger counts differ");
 const migrations=Number(sql(target,'SELECT count(*) FROM "public"."_prisma_migrations" WHERE finished_at IS NOT NULL'));
 if(migrations<40)fail("Prisma migration history missing");
 if(reversalsValid(target)!=="CONSISTENT")fail("restored reversal/payments/lot invariants diverge");
 console.log(JSON.stringify({
  gate:"POINTVET_M571_DR_RESTORED_ISOLATED",
  sourceProjectDeclared:plan.originProject,targetProjectDeclared:plan.targetProject,
  targetWasEmpty:true,sourceReadOnly:true,tableDigestsEqual:true,
  schemaObjectCountsEqual:true,reversalInvariantsConsistent:true,
  tableCount:sourceTables.length,completedMigrations:migrations,
  dumpBytes:bytes,sha256:checksum,elapsedSeconds:Math.round((Date.now()-started)/1000),
  independentProjectIdentityStillRequiresOperatorEvidence:true,productionAuthorized:false
 }));
}catch(err){
 console.error(err.message?.startsWith("POINTVET_M571_DR_")?err.message:
  "POINTVET_M571_DR_FAILED: error; details suppressed to prevent credential leakage");
 process.exitCode=1;
}finally{if(scratch)rmSync(scratch,{recursive:true,force:true})}
