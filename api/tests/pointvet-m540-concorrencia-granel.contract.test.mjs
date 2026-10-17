/** PointVet M.5.40 — reprocessamento seguro de transações serializáveis. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {executarComRetrySerializableM540}
 from "../src/modules/pdv/pdv-unificado-fechamento-manual.contract.js";

test("somente P2034 retenta após rollback integral, com no máximo três tentativas",async()=>{
 let tentativas=0;
 const retorno=await executarComRetrySerializableM540(async()=>{
  tentativas++;
  if(tentativas<3)throw Object.assign(Error("serializable"),{code:"P2034"});
  return {confirmado:true};
 });
 assert.deepEqual(retorno,{confirmado:true});
 assert.equal(tentativas,3);
 await assert.rejects(()=>executarComRetrySerializableM540(async()=>{
  throw Object.assign(Error("conflito permanente"),{code:"P2034"});
 }),/conflito permanente/);
});

test("P2010 só retenta SQLSTATE exato de serialização/deadlock de consulta raw",async()=>{
 for(const code of ["40001","40P01"]){
  let chamadas=0;
  assert.equal(await executarComRetrySerializableM540(async()=>{
   chamadas++;
   if(chamadas===1)throw Object.assign(Error("raw query aborted"),{
    code:"P2010",meta:{code}
   });
   return "confirmada";
  }),"confirmada");
  assert.equal(chamadas,2);
 }
 for(const meta of [{code:"23505"},{code:"22001"},null]){
  let chamadas=0;
  await assert.rejects(()=>executarComRetrySerializableM540(async()=>{
   chamadas++;
   throw Object.assign(Error("sql failure"),{code:"P2010",meta});
  }),/sql failure/);
  assert.equal(chamadas,1);
 }
});

test("estoque insuficiente, falha de permissão e erro desconhecido NÃO são retentados",async()=>{
 for(const error of [
  Error("M3_ESTOQUE_INSUFICIENTE"),
  Error("M3_CAIXA_INVALIDO"),
  Object.assign(Error("database offline"),{code:"P1001"})
 ]){
  let chamadas=0;
  await assert.rejects(()=>executarComRetrySerializableM540(async()=>{
   chamadas++;
   throw error;
  }),e=>e===error);
  assert.equal(chamadas,1);
 }
 for(const tentativas of [0,4,1.5]){
  await assert.rejects(()=>executarComRetrySerializableM540(async()=>{},
   {tentativas}),/M3_RETRY_INVALIDO/);
 }
});

test("a baixa concorrente revalida saldo e lote na MESMA transação com condição",()=>{
 const source=readFileSync(new URL("../src/modules/pdv/pdv-unificado-fechamento-manual-sandbox.service.js",
  import.meta.url),"utf8");
 assert.match(source,/executarComRetrySerializableM540\(\(\)=>prisma\.\$transaction/);
 assert.match(source,/SELECT "id" FROM "estoque_saldos" WHERE "produtoId"=.*FOR UPDATE/);
 assert.match(source,/produtoId:produto\.id,quantidade:\{gte:total\}/);
 assert.match(source,/id:lote\.id,quantidadeAtual:\{gte:retirar\/1000\}/);
 assert.match(source,/isolationLevel:"Serializable"/);
});
