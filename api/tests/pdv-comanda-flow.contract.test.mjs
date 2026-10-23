/** M.5.71 — porta do PDV tradicional por CNPJ e vinculo seguro de tutor.
 * Preserva o planejamento da PR #36 sem reabrir troca de tutor faturado. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const routes=source("../src/modules/pdv/pdv.routes.js");
const controller=source("../src/modules/pdv/pdv.controller.js");
const svc=source("../src/modules/pdv/pdv.service.js");
const page=source("../../../admin-web/src/pages/PdvPage.jsx");
const home=source("../../../admin-web/src/components/PdvOrdersHome.jsx");

test("vincular tutor usa organizacao E empresa da sessao, sem troca apos atribuir",()=>{
 assert.match(routes,/router\.patch\("\/comandas\/:id\/tutor", exigirPermissao\("pdv\.acessar"\), controller\.atribuirTutorComanda\)/);
 assert.match(controller,/empresaId:req\.empresa\.id,id:req\.params\.id,clienteId:dados\.clienteId/);
 assert.match(svc,/export async function atribuirTutorComanda/);
 assert.match(svc,/AND:\[escopoComandaEmpresa\(empresaId\)\]/);
 assert.match(svc,/clienteId:null,status:\{in:\["ABERTA","PARCIALMENTE_FECHADA"\]\}/);
 assert.match(svc,/COMANDA_TUTOR_IMUTAVEL/);
});

test("central inicia pelas comandas e respeita CNPJ da loja",()=>{
 assert.match(page,/useState\("COMANDAS"\)/);
 assert.match(page,/<PdvOrdersHome/);
 assert.match(page,/createCommandMutation\.mutate\(\{clienteId:customerId\|\|null,petId:petId\|\|null\}\)/);
 assert.match(home,/Em aberto/);
 assert.match(home,/Fechadas hoje/);
 assert.match(home,/Orçamentos/);
 assert.match(svc,/escopoComandaEmpresa\(empresaId\)/);
 assert.match(controller,/service\.criarComanda\(\{ organizacaoId: req\.organizacao\.id, empresaId: req\.empresa\.id, dados \}\)/);
});

test("servico exige tutor pet e inteiro, produto admite cliente opcional",()=>{
 assert.match(svc,/if \(item\.tipo === "SERVICO" && !clienteId\)/);
 assert.match(svc,/if \(item\.tipo === "SERVICO" && !pet\)/);
 assert.match(svc,/Number\.isInteger\(quantidade\)/);
 assert.match(page,/quantidade: commandQuantity/);
 assert.match(home,/Consumidor não identificado/);
});
