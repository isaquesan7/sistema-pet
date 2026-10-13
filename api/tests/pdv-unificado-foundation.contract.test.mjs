import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const schema=get("../prisma/schema.prisma");
const routes=get("../src/modules/pdv/pdv-unificado.routes.js");
const config=get("../src/modules/organizacoes/organizacoes.schema.js");
const settings=get("../../admin-web/src/pages/SettingsPage.jsx");
test("opt-in is organization-scoped and disabled by default",()=>{
 assert.match(schema,/pdvUnificadoHabilitado Boolean @default\(false\)/);
 assert.match(config,/pdvUnificadoHabilitado: z\.boolean\(\)\.optional\(\)/);
 assert.match(settings,/Preferir PDV Unificado Multiempresa/);
});
test("no unified checkout enabled yet; only accessible organizations",()=>{
 assert.match(routes,/checkoutUnificadoDisponivel:false/);
 assert.match(routes,/modoEfetivo:"INDIVIDUAL"/);
 assert.match(routes,/usuarioId:req\.usuario\.id,ativo:true/);
 assert.match(routes,/organizacaoId:req\.organizacao\.id/);
 assert.match(routes,/r\.post\("\/simulacao"/);
 assert.doesNotMatch(routes,/r\.post\("\/(fechar|pagar|vender|finalizar)"/);
});
test("financial foundation remains separate, preserving legacy comanda",()=>{
 assert.match(schema,/model Comanda \{/);
 assert.match(schema,/model ComandaItem \{/);
 assert.match(schema,/model Venda \{/);
});
