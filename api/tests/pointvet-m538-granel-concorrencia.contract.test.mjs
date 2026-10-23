/** PointVet M.5.38 — locks before the FIRST product history row. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {travarUnidadesProdutos,validarQuantidadeNaUnidade} from "../src/modules/catalogo/catalogo-unidade.service.js";

test("quantidades de estoque rejeitam fração de grama e aceitam 333 g", () => {
  for (const value of [0.333, 333.333, -1, 0, Number.NaN]) {
    assert.throws(() => validarQuantidadeNaUnidade("GRAMA", value), /QUANTIDADE_INVALIDA/);
  }
  assert.doesNotThrow(() => validarQuantidadeNaUnidade("GRAMA", 333));
  assert.doesNotThrow(() => validarQuantidadeNaUnidade("QUILOGRAMA", 0.333));
  assert.throws(() => validarQuantidadeNaUnidade("QUILOGRAMA", 0.33333), /QUANTIDADE_INVALIDA/);
  assert.doesNotThrow(() => validarQuantidadeNaUnidade("GRAMA", 0, {permitirZero: true}));
});

test("locks de leitura por produto são únicos, ordenados e parametrizados", async () => {
  const locked = [];
  const tx = {$queryRaw: async (strings, ...values) => {
    assert.match(strings.join("?"), /^SELECT "id" FROM "produtos" WHERE "itemId"=\? FOR SHARE$/);
    locked.push(values[0]);
    return [{id: `produto-${values[0]}`}];
  }};
  await travarUnidadesProdutos(tx, ["z", "b", "z", null, "a", "b"]);
  assert.deepEqual(locked, ["a", "b", "z"]);
  await travarUnidadesProdutos(tx, []);
  assert.equal(locked.length, 3);
});

test("criadores de histórico bloqueiam antes de ler unidade/saldo", () => {
  const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  const unified = source("../src/modules/pdv/pdv-unificado.service.js");
  const stock = source("../src/modules/estoque/estoque.service.js");
  const legacy = source("../src/modules/pdv/pdv.service.js");
  const clinic = source("../src/modules/consultorio/consultorio.service.js");
  const packs = source("../src/modules/pacotes/pacotes.service.js");
  const quote = source("../src/modules/clientes/client-quote-pdv-conversion-sandbox.service.js");
  assert.match(unified, /salvarRascunho[\s\S]*?await travarUnidadesProdutos\(tx,args\.itens\.map\(x=>x\.itemCatalogoId\)\);\s*const previa=await simularComanda/);
  assert.match(stock, /produtoDaEmpresa[\s\S]*?await travarUnidadesProdutos\(tx, \[itemCatalogoId\]\);\s*const item = await tx\.itemCatalogo\.findFirst/);
  assert.match(stock, /criarEntrada[\s\S]*?await travarUnidadesProdutos\(tx, dados\.itens\.map/);
  assert.match(stock, /criarInventario[\s\S]*?await travarUnidadesProdutos\(tx, ids\.map/);
  assert.match(legacy, /prepararItens[\s\S]*?await travarUnidadesProdutos\(tx, ids\);\s*const catalogo = await tx\.itemCatalogo\.findMany/);
  assert.match(clinic, /validarItem[\s\S]*?await travarUnidadesProdutos\(tx, \[itemCatalogoId\]\);\s*const item = await tx\.itemCatalogo\.findFirst/);
  assert.match(packs, /criarModelo[\s\S]*?await travarUnidadesProdutos\(tx, dados\.itens\.map/);
  assert.match(packs, /atualizarModelo[\s\S]*?await travarUnidadesProdutos\(tx, dados\.itens\.map/);
  assert.match(quote, /await travarUnidadesProdutos\(tx,parsed\.vinculos\.map\(x=>x\.itemCatalogoId\)\);\s*const current=await previsualizarOrcamentoNoPdvUnificado/);
});
