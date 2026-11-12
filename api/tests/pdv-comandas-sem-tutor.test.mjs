/** Regras estruturais essenciais de comanda por organização sem tutor. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const schema=read("../prisma/schema.prisma");
const migration=read("../prisma/migrations/20261023180000_comandas_sem_cliente/migration.sql");
const svc=read("../src/modules/pdv/pdv.service.js");
const unif=read("../src/modules/pdv/pdv-unificado.service.js");
test("migração retroativa mantém cliente e isola toda comanda por organização",()=>{
 assert.match(schema,/model Comanda \{[\s\S]*?organizacaoId String\s+empresaOrigemId String\?\s+clienteId String\?/);
 assert.match(schema,/cliente Cliente\? @relation/);
 assert.match(migration,/UPDATE "comandas" AS c[\s\S]*?FROM "clientes" AS cl/);
 assert.match(migration,/RAISE EXCEPTION/);
 assert.match(migration,/ALTER COLUMN "clienteId" DROP NOT NULL/);
 assert.match(migration,/FOREIGN KEY \("organizacaoId"\)/);
 assert.match(svc,/where: \{ id, organizacaoId, rascunhoUnificado: false, AND: \[escopoComandaEmpresa\(empresaId\)\] \}/);
 assert.doesNotMatch(svc,/where: \{ id, cliente: \{ organizacaoId \}/);
});
test("toda criação de comanda preserva a organização e cliente opcional",()=>{
 assert.match(svc,/data: \{ organizacaoId, clienteId: dados.clienteId \|\| null/);
 assert.match(unif,/organizacaoId:args.organizacaoId,empresaOrigemId:args.empresaId,clienteId:args.clienteId\|\|null/);
 assert.match(read("../src/modules/consultorio/consultorio.service.js"),/organizacaoId: tutor.organizacaoId/);
 assert.match(read("../src/modules/banho-tosa/banho-tosa.service.js"),/organizacaoId:tutor.organizacaoId/);
});
test("serviço precisa quantidade inteira, tutor e pet validados no servidor",()=>{
 assert.match(svc,/!Number.isInteger\(quantidade\) \|\| quantidade < 1/);
 assert.match(svc,/CLIENTE_OBRIGATORIO_SERVICO/);
 assert.match(svc,/PET_OBRIGATORIO_SERVICO/);
 assert.match(unif,/!Number.isInteger\(input.quantidade\)/);
 assert.match(unif,/item.tipo==="SERVICO"&&!clienteId/);
 assert.match(unif,/item.tipo==="SERVICO"&&!input.petId/);
});
