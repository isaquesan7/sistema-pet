/** Non-destructive contract checks for protected client and pet hubs. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const pets=read("../src/modules/pets/pets.service.js");
const petRoutes=read("../src/modules/pets/pets.routes.js");
const grooming=read("../src/modules/banho-tosa/banho-tosa.service.js");
const groomingRoutes=read("../src/modules/banho-tosa/banho-tosa.routes.js");
const clients=read("../src/modules/clientes/clientes.service.js");
const clientView=read("../../admin-web/src/pages/ClientDetailPage.jsx");
test("pet deletion scoped and blocked when any protected relation exists",()=>{
 assert.match(pets,/cliente:\{organizacaoId\}/);
 assert.match(pets,/Object\.values\(pet\._count\)\.some/);
 assert.match(pets,/PET_COM_HISTORICO/);
 assert.match(petRoutes,/PROPRIETARIO/);
 assert.match(petRoutes,/ADMINISTRADOR/);
});
test("grooming summary scoped to establishment and pet",()=>{
 assert.match(grooming,/export async function resumoPet/);
 assert.match(grooming,/where:\{petId,empresaId\}/);
 assert.match(groomingRoutes,/exigirPermissao\("banho_tosa.acessar"\), controller.resumoPet/);
});
test("client search filters and direct editing are present",()=>{
 assert.match(clients,/tipoBusca/);
 assert.match(clients,/situacao/);
 assert.match(clientView,/ClientEditDrawer/);
 assert.match(clientView,/petDeleteStage===1/);
 assert.match(clientView,/petDeleteText!==petDelete\?\.nome/);
});
