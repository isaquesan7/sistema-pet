/** PostgreSQL smoke test: schema migrated on disposable CI database.
 * Does not touch production or external financial services.
 */
import pg from "pg";
import assert from "node:assert/strict";
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
try{
 await db.query("BEGIN");
 const cfg=await db.query(`SELECT column_name,column_default,is_nullable FROM information_schema.columns WHERE table_name='configuracoes_organizacao' AND column_name='pdvUnificadoHabilitado'`);
 assert.equal(cfg.rowCount,1,"Organization opt-in column must exist");
 assert.equal(cfg.rows[0].is_nullable,"NO");
 assert.match(cfg.rows[0].column_default,/false/i);
 const comanda=await db.query(`SELECT column_name,column_default,is_nullable FROM information_schema.columns WHERE table_name='comandas' AND column_name IN ('rascunhoUnificado','versaoRascunho')`);
 assert.equal(comanda.rowCount,2,"Draft isolation and revision columns required");
 const opt=comanda.rows.find(r=>r.column_name==="rascunhoUnificado");
 const ver=comanda.rows.find(r=>r.column_name==="versaoRascunho");
 assert.match(opt.column_default,/false/i);
 assert.match(ver.column_default,/1/);
 const org="test-unified-org";
 await db.query('INSERT INTO "organizacoes" ("id","slug","nome","ativo","createdAt","updatedAt") VALUES ($1,$2,$3,TRUE,NOW(),NOW())',[org,org,"Teste CI"]);
 const config=await db.query('INSERT INTO "configuracoes_organizacao" ("id","organizacaoId","createdAt","updatedAt") VALUES ($1,$2,NOW(),NOW()) RETURNING "pdvUnificadoHabilitado"',["test-config",org]);
 assert.equal(config.rows[0].pdvUnificadoHabilitado,false);
 const cli=await db.query('INSERT INTO "clientes" ("id","organizacaoId","nome","createdAt","updatedAt") VALUES ($1,$2,$3,NOW(),NOW()) RETURNING id',["test-tutor",org,"Tutor CI"]);
 assert.equal(cli.rows[0].id,"test-tutor");
 const first=await db.query('INSERT INTO "comandas" ("id","clienteId","createdAt","updatedAt") VALUES ($1,$2,NOW(),NOW()) RETURNING "rascunhoUnificado","versaoRascunho"',['test-old-comanda','test-tutor']);
 assert.equal(first.rows[0].rascunhoUnificado,false);
 assert.equal(first.rows[0].versaoRascunho,1);
 const second=await db.query('INSERT INTO "comandas" ("id","clienteId","rascunhoUnificado","createdAt","updatedAt") VALUES ($1,$2,TRUE,NOW(),NOW()) RETURNING "rascunhoUnificado","versaoRascunho"',['test-new-comanda','test-tutor']);
 assert.equal(second.rows[0].rascunhoUnificado,true);
 assert.equal(second.rows[0].versaoRascunho,1);
 const updated=await db.query('UPDATE "comandas" SET "versaoRascunho"="versaoRascunho"+1 WHERE id=$1 AND "versaoRascunho"=$2 RETURNING "versaoRascunho"',['test-new-comanda',1]);
 assert.equal(updated.rows[0].versaoRascunho,2);
 const stale=await db.query('UPDATE "comandas" SET "versaoRascunho"="versaoRascunho"+1 WHERE id=$1 AND "versaoRascunho"=$2 RETURNING id',['test-new-comanda',1]);
 assert.equal(stale.rowCount,0);
 console.log("PostgreSQL smoke passed: default-off opt-in, legacy draft separation, version conflict");
}finally{
 await db.query("ROLLBACK");
 await db.end();
}
