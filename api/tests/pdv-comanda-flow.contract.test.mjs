/** M.5.71: contrato de edição de tutor e atendimento por comanda. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const routes=source("../src/modules/pdv/pdv.routes.js");
const controller=source("../src/modules/pdv/pdv.controller.js");
const service=source("../src/modules/pdv/pdv.service.js");
const page=source("../../../admin-web/src/pages/PdvPage.jsx");
const home=source("../../../admin-web/src/components/PdvOrdersHome.jsx");

test("somente org autorizada pode vincular tutor em comanda legada aberta",()=>{
 assert.match(routes,/router\.patch\("\/comandas\/:id\/cliente", exigirPermissao\("pdv\.acessar"\), controller\.atualizarClienteComanda\)/);
 assert.match(controller,/export async function atualizarClienteComanda/);
 assert.match(controller,/parse\(comandaSchema, req\.body, res\)/);
 assert.match(service,/export async function atualizarClienteComanda/);
 assert.match(service,/where: \{ id, organizacaoId, rascunhoUnificado: false \}/);
 assert.match(service,/\["FECHADA", "CANCELADA"\]\.includes\(comanda\.status\)/);
 assert.match(service,/line\.pet\.clienteId !== clienteId/);
 assert.match(service,/CLIENTE_OBRIGATORIO_SERVICO/);
});

test("ordem inicia no balcão, consulta abertas e fechadas hoje, preserva CNPJ",()=>{
 assert.match(page,/useState\("COMANDAS"\)/);
 assert.match(page,/<PdvOrdersHome commands=\{commands\} sales=\{sales\}/);
 assert.match(page,/createCommandMutation\.mutate\(id\)/);
 assert.match(home,/Em aberto/);
 assert.match(home,/Finalizadas hoje/);
 assert.match(home,/isToday\(s\.createdAt\)/);
 assert.match(home,/onOpenSale\(item\.id\)/);
});

test("pet é obrigatório em serviços, enquanto comanda só de produto pode ser anônima",()=>{
 assert.match(page,/clienteId: \(requestedClientId \?\? commandClientId\) \|\| null/);
 assert.match(page,/selectedCommandItem\?\.tipo==="SERVICO"&&\(!commandClient\|\|!commandPetId\)/);
 assert.match(page,/quantidade: normalizePdvQuantity/);
 assert.match(page,/api\.patch\(`\/pdv\/comandas\/\$\{commandDetailId\}\/cliente`/);
 assert.match(service,/if \(item\.tipo === "SERVICO" && !clienteId\)/);
 assert.match(service,/if \(item\.tipo === "SERVICO" && !pet\)/);
 assert.match(service,/Number\.isInteger\(quantidade\)/);
});
