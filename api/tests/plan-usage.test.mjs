import {test} from "node:test";import assert from "node:assert/strict";import {calculatePlanUsage} from "../src/modules/saas/plan-usage.js";
const metrics={empresas:8,usuarios:9,clientes:100,pets:2,funcionarios:0};
const plan={limiteEmpresas:10,limiteUsuarios:10,limiteClientes:100,limitePets:null,limiteFuncionarios:0};
test("80, 90 and 100% alerts and absent limits",()=>{const a=calculatePlanUsage(metrics,plan);assert.deepEqual(a.map(x=>x.level),["WARNING","HIGH","LIMIT","UNLIMITED","UNDEFINED"]);});
test("no false threshold rounding",()=>{const a=calculatePlanUsage({clientes:799}, {limiteClientes:1000});assert.equal(a.find(x=>x.key==="clientes").level,"NORMAL");});
test("over-limit usage remains visible",()=>{const a=calculatePlanUsage({pets:11},{limitePets:10});assert.equal(a.find(x=>x.key==="pets").percent,110);});
