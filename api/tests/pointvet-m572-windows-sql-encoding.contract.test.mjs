import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {summarizePsqlAuditFailure} from "../src/modules/plataforma/pointvet-m572-preflight.contract.mjs";

test("M572 SQL enviado via psql -c precisa ser ASCII no Windows",()=>{
 const sql=readFileSync(new URL("../scripts/pointvet-m572-prod-preflight.sql",import.meta.url),"utf8");
 assert.equal([...sql].every(char=>char.charCodeAt(0)<=127),true,
  "Caracter nao ASCII no SQL pode produzir SQLSTATE 22021 (code page Windows)");
 const runner=readFileSync(new URL("../scripts/pointvet-m572-prod-readonly-audit.mjs",import.meta.url),"utf8");
 assert.match(runner,/charCodeAt\(0\)>127/);
});
test("M572 reporta SQLSTATE 22021 sem incluir texto do erro",()=>{
 const message="ERROR:  22021: invalid byte sequence for encoding UTF8";
 assert.equal(summarizePsqlAuditFailure({status:3,stderr:message}),
  "SQLSTATE_22021_CODIFICACAO_INVALIDA");
});
