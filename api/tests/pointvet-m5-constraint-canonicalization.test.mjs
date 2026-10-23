/** CI-only verification that PostgreSQL cosmetic CHECK casts normalize safely. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {normalizarDefinicaoConstraint,canonizarRelatorioSchema}
 from "../scripts/ci-pointvet-canonical-schema.mjs";
const a="CHECK (((classe)::text = ANY ((ARRAY['PRODUTO'::character varying, 'SERVICO'::character varying])::text[])))";
const b="CHECK (((classe)::text = ANY (ARRAY[('PRODUTO'::character varying)::text, ('SERVICO'::character varying)::text])))";
test("M5 pg_dump/pg_restore retyped casts are semantically equal",()=>{
 assert.equal(normalizarDefinicaoConstraint(a),normalizarDefinicaoConstraint(b));
 assert.equal(canonizarRelatorioSchema("CONSTRAINT:flow:check|"+a+"\nSCHEMA:INDEX|3|x\n"),
  canonizarRelatorioSchema("CONSTRAINT:flow:check|"+b+"\nSCHEMA:INDEX|3|x\n"));
});
test("M5 changed labels, column names, operators, rules and other constraints stay different",()=>{
 const differing=[
  b.replace("PRODUTO","PRODUTOS"),
  b.replace("SERVICO","OUTRO"),
  b.replace("classe","outra_coluna"),
  b.replace(" ANY "," ALL ")
 ];
 for(const d of differing)assert.notEqual(
  normalizarDefinicaoConstraint(a),normalizarDefinicaoConstraint(d));
 assert.notEqual(canonizarRelatorioSchema("CONSTRAINT:a|"+a+"\n"),
  canonizarRelatorioSchema("CONSTRAINT:b|"+b+"\n"));
 assert.notEqual(normalizarDefinicaoConstraint("FOREIGN KEY (id) REFERENCES a(id)"),
  normalizarDefinicaoConstraint("FOREIGN KEY (id) REFERENCES b(id)"));
});
