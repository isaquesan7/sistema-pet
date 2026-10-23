/**
 * PointVet M.5.1 — PostgreSQL 16 constraint fingerprint canonicalization.
 *
 * pg_dump/pg_restore may rewrite equivalent casts in CHECK ... ANY ARRAY:
 *   ((ARRAY['X'::character varying])::text[])
 *   (ARRAY[('X'::character varying)::text])
 * Normalizing ONLY those equivalent cast placements prevents a false restore
 * alarm without hiding a changed literal, constraint name, type or operator.
 *
 * Input is a SQL query output file containing SYNTHETIC metadata only.
 * No database connections, secrets, approval or environment changes.
 */
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
export function normalizarDefinicaoConstraint(definition){
 if(typeof definition!=="string")throw Error("M5_CONSTRAINT_INVALIDA");
 if(!definition.startsWith("CHECK ("))return definition;
 return definition
  .replace(/\('([^']+)'::character varying\)::text/g,
   "'$1'::character varying")
  .replace(/\(\(ARRAY\[([^\]]+)\]\)::text\[\]\)/g,
   "(ARRAY[$1])");
}
export function canonizarRelatorioSchema(text){
 if(typeof text!=="string")throw Error("M5_RELATORIO_INVALIDO");
 const rows=text.split("\n").filter(Boolean).map(line=>{
  const separator=line.indexOf("|");
  if(separator===-1)throw Error("M5_RELATORIO_SEM_SEPARADOR");
  const type=line.slice(0,separator),body=line.slice(separator+1);
  if(type.startsWith("CONSTRAINT:")){
   const normalized=normalizarDefinicaoConstraint(body);
   const hashed=createHash("sha256").update(normalized).digest("hex");
   return type+"|"+hashed;
  }
  return line;
 });
 return rows.join("\n")+"\n";
}
if(process.argv[1]&&process.argv[1].endsWith("ci-pointvet-canonical-schema.mjs")){
 if(process.argv.length!==4)throw Error("Usage: node canonical-schema.mjs input output");
 const [, ,input,output]=process.argv;
 writeFileSync(output,canonizarRelatorioSchema(readFileSync(input,"utf8")),"utf8");
}
