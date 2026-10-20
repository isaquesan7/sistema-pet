/**
 * PointVet M.5.59 — populate a strictly isolated Railway PostgreSQL with
 * existing multi-CNPJ / fiscal / credit / 333 g integration-test fixtures.
 * Never runs in either Pet King environment and does not contact providers.
 */
import {spawnSync} from 'node:child_process';
import pg from 'pg';

const PROJECT='11a9be9f-7635-4e74-96f9-0c48d77242c9';
const DB='pointvet_unified_ci';
function blocked(reason){throw Error(`POINTVET_M559_SEED_BLOCKED: ${reason}`);}

if(process.env.RAILWAY_PROJECT_ID!==PROJECT||
   process.env.POINTVET_M559_SCOPE!=='full-schema-synthetic-only'||
   process.env.NODE_ENV!=='test'||
   process.env.POINTVET_UNIFIED_SALES_SANDBOX!=='1')
  blocked('isolated project and sandbox flags required');
let database;
try{database=new URL(process.env.DATABASE_URL);}catch{blocked('invalid DATABASE_URL');}
if(database.protocol!=='postgresql:'||database.pathname!==`/${DB}`||
   !database.hostname.endsWith('.railway.internal'))
  blocked('only the disposable internal Railway CI database is allowed');

const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try{
 const {rows}=await client.query('SELECT current_database() AS name');
 if(rows[0]?.name!==DB)blocked('actual database identity differs');
 const existing=await client.query(`SELECT to_regclass('public.pointvet_m559_drill_control') AS table_name`);
 if(existing.rows[0]?.table_name)blocked('marker already exists: refusing replay');
}finally{await client.end();}

function run(label,command,args,timeout=600_000){
 console.log(`POINTVET_M559_STEP_START: ${label}`);
 const result=spawnSync(command,args,{stdio:'inherit',env:process.env,timeout});
 if(result.error||result.status!==0)
  blocked(`${label} failed: ${result.error?.code??result.status}`);
 console.log(`POINTVET_M559_STEP_SUCCESS: ${label}`);
}

run('migrate-deploy','npm',['run','db:deploy']);
run('migrate-status','npm',['run','db:status']);
const suites=[
 'tests/pdv-unificado-integration.test.mjs',
 'tests/client-credit-ledger.integration.test.mjs',
 'tests/pdv-unificado-fiscal.integration.test.mjs',
 'tests/pdv-unificado-fiscal-migracao.integration.test.mjs',
];
for(const path of suites)run(path,'node',['--import','tsx','--test',path],900_000);

const verification=new pg.Client({connectionString:process.env.DATABASE_URL});
await verification.connect();
try{
 const {rows:[counts]}=await verification.query(`
 SELECT (SELECT count(*)::int FROM empresas) AS companies,
        (SELECT count(*)::int FROM vendas) AS sales,
        (SELECT count(*)::int FROM estornos_fechamento_manual_unificado) AS refunds,
        (SELECT count(*)::int FROM fluxos_fiscais_unificados_ci) AS fiscal_flows,
        (SELECT count(*)::int FROM eventos_fluxo_fiscal_unificado_ci) AS fiscal_events,
        (SELECT count(*)::int FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS migrations,
        (SELECT count(*)::int FROM movimentacoes_estoque
         WHERE quantidade=0.333 AND tipo IN ('VENDA','CANCELAMENTO')) AS grams333;
 `);
 if(counts.companies<2||counts.sales<2||counts.refunds<1||
    counts.fiscal_flows<2||counts.fiscal_events<5||
    counts.migrations<1||counts.grams333<2)
   blocked('real-schema synthetic business fixtures insufficient');
 await verification.query(`CREATE TABLE pointvet_m559_drill_control (
   marker text PRIMARY KEY CHECK (marker='M559_READY'),
   created_at timestamptz NOT NULL DEFAULT now()
 )`);
 await verification.query("INSERT INTO pointvet_m559_drill_control(marker) VALUES('M559_READY')");
 console.log(`POINTVET_M559_SEED_SUCCESS: companies=${counts.companies} sales=${counts.sales} refunds=${counts.refunds} fiscal_flows=${counts.fiscal_flows} fiscal_events=${counts.fiscal_events} migrations=${counts.migrations} movements_333g=${counts.grams333}`);
}finally{await verification.end();}

// Keep this short-lived worker observable while the restore runner executes.
setInterval(()=>{},300_000);
