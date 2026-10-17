/** M.5.36: conversões em gramas inteiros, sem dinheiro ou estoque real. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {addUnifiedCatalogItem,rehydrateUnifiedDraft} from "../../admin-web/src/lib/unifiedDraft.js";
import {isBulkWeightProduct,bulkGrams,bulkTotalCents,bulkFromGrams,bulkFromAmount,bulkScaleCheck} from "../../admin-web/src/lib/unifiedBulk.js";

const ration={id:"ration",empresaId:"pet-king",nome:"Ração Adulto Granel",tipo:"PRODUTO",unidade:"QUILOGRAMA",precoVenda:15,empresa:{nomeFantasia:"Pet King"}};
test("R$15/kg: venda por 333 g ou R$5 gera a mesma quantidade e cinco reais",()=>{
 assert(isBulkWeightProduct(ration));
 const byWeight=bulkFromGrams("333",ration.unidade);
 const byMoney=bulkFromAmount("5,00",ration.precoVenda,ration.unidade);
 assert.deepEqual(byWeight,{quantidade:0.333,gramas:333});
 assert.deepEqual(byMoney,{quantidade:0.333,gramas:333,valorCentavos:500});
 const line={...addUnifiedCatalogItem([],ration,"nova:1")[0],quantidade:byMoney.quantidade};
 assert.equal(bulkGrams(line),333);
 assert.equal(bulkTotalCents(line),500);
});

test("centavos impossíveis, fração de grama, peso zero e excesso são bloqueados",()=>{
 assert.match(bulkFromGrams("333.33","QUILOGRAMA").erro,/inteiros/);
 assert.match(bulkFromGrams("0","QUILOGRAMA").erro,/entre 1 g/);
 assert.match(bulkFromGrams("10000001","QUILOGRAMA").erro,/entre 1 g/);
 assert.match(bulkFromAmount("5.02",15,"QUILOGRAMA").erro,/não corresponde exatamente/);
 assert.match(bulkFromAmount("0.01",1000,"QUILOGRAMA").erro,/pelo menos 1 g/);
 assert.match(bulkFromAmount("5.001",15,"QUILOGRAMA").erro,/duas casas/);
 assert.match(bulkFromAmount("5",0,"QUILOGRAMA").erro,/positivos/);
});

test("estoque em gramas não converte para kg e retomada restaura unidade",()=>{
 const grams={...ration,unidade:"GRAMA",precoVenda:2};
 assert.deepEqual(bulkFromGrams("4","GRAMA"),{quantidade:4,gramas:4});
 assert.deepEqual(bulkFromAmount("8.00",2,"GRAMA"),{quantidade:4,gramas:4,valorCentavos:800});
 const saved=rehydrateUnifiedDraft({itens:[{id:"row-1",empresaId:"pet-king",itemCatalogoId:"ration",status:"ATIVO",quantidade:0.333,
  descricao:"Ração Adulto Granel",valorUnitario:15,empresaNome:"Pet King",unidade:"QUILOGRAMA",tipo:"PRODUTO"}]});
 assert.equal(saved[0].unidade,"QUILOGRAMA");
 assert.equal(bulkGrams(saved[0]),333);
});

test("API autoritativa e checkout isolado não permitem bypass de precisão nem emissão fiscal",()=>{
 const api=readFileSync(new URL("../src/modules/pdv/pdv-unificado.service.js",import.meta.url),"utf8");
 const sandbox=readFileSync(new URL("../src/modules/pdv/pdv-unificado-fechamento-manual-sandbox.service.js",import.meta.url),"utf8");
 const routes=readFileSync(new URL("../src/modules/pdv/pdv-unificado.routes.js",import.meta.url),"utf8");
 assert.match(api,/produto:\{select:\{unidade:true\}\}/);
 assert.match(api,/quantityMilli%1000!==0/);
 assert.match(api,/QUANTIDADE_INVALIDA/);
 assert.match(api,/TOTAL_GRANEL_ZERADO/);
 assert.match(sandbox,/data:\{quantidade:\{decrement:total\}\}/);
 assert.match(sandbox,/exigirBancoIsolado\(\)/);
 assert.match(routes,/checkoutUnificadoDisponivel:checkoutHabilitado/);
 assert.match(routes,/if\(!checkoutManualHabilitado\(req\.organizacao,req\.empresa\.id\)\)/);
});

test("M.5.41: leitura manual exata de 333 g e etiqueta R$ 5,00 conferem com R$ 15/kg",()=>{
 const row={...addUnifiedCatalogItem([],ration,"nova:1")[0],quantidade:0.333};
 assert.deepEqual(bulkScaleCheck(row,""),{status:"PENDENTE",expectedGrams:333,expectedCents:500});
 assert.deepEqual(bulkScaleCheck(row,"333","5,00"),{
  status:"CONFERIDO",expectedGrams:333,expectedCents:500,measuredGrams:333,measuredCents:500,
  gramsDifference:0,labelCents:500,labelDifferenceCents:0
 });
 assert.equal(bulkScaleCheck(row,"333").status,"CONFERIDO");
 assert.equal(row.quantidade,0.333,"conferência não altera peso na comanda");
});

test("M.5.41: diferença de 1 g bloqueia conferência, mesmo quando centavos arredondam igual",()=>{
 const row={...ration,preco:15,quantidade:0.333};
 const more=bulkScaleCheck(row,"334","5,00");
 assert.equal(more.status,"DIVERGENTE");
 assert.equal(more.gramsDifference,1);
 assert.equal(more.measuredCents,501);
 assert.equal(more.labelDifferenceCents,0);
 const less=bulkScaleCheck(row,"332");
 assert.equal(less.status,"DIVERGENTE");
 assert.equal(less.gramsDifference,-1);
 const oneGram={...row,quantidade:0.001,preco:10};
 assert.equal(bulkScaleCheck(oneGram,"2").status,"DIVERGENTE");
 assert.equal(bulkScaleCheck(oneGram,"1","0,01").status,"CONFERIDO");
});

test("M.5.41: valor de etiqueta divergente e leitura inválida não dão falso positivo",()=>{
 const row={...ration,preco:15,quantidade:0.333};
 assert.equal(bulkScaleCheck(row,"333","5,01").labelDifferenceCents,1);
 assert.equal(bulkScaleCheck(row,"333","4,99").status,"DIVERGENTE");
 for(const weight of ["0","333,3","333.33","-1","1e3","10000001","x"])
  assert.equal(bulkScaleCheck(row,weight).status,"INVALIDO",weight);
 for(const label of ["5,001","-5","1e3","x","9999999999999999"])
  assert.equal(bulkScaleCheck(row,"333",label).status,"INVALIDO",label);
 assert.equal(bulkScaleCheck({...row,erroEntradaGranel:"Peso inválido"},"333","5,00").status,"INVALIDO");
 assert.equal(bulkScaleCheck({...row,quantidade:0},"333","5,00").status,"INVALIDO");
 assert.equal(bulkScaleCheck({...row,tipo:"SERVICO"},"333").status,"INAPLICAVEL");
});

test("M.5.41: unidade GRAMA e troca de quantidade atualizam imediatamente a conferência",()=>{
 const row={...ration,unidade:"GRAMA",preco:2,quantidade:4};
 assert.equal(bulkScaleCheck(row,"4","8.00").status,"CONFERIDO");
 const changed={...row,quantidade:5};
 assert.equal(bulkScaleCheck(changed,"4","8.00").status,"DIVERGENTE");
 assert.equal(bulkScaleCheck(changed,"5","10,00").status,"CONFERIDO");
 const ui=readFileSync(new URL("../../admin-web/src/pages/UnifiedPdvPreviewPage.jsx",import.meta.url),"utf8");
 assert.match(ui,/<UnifiedBulkScaleCheck row=\{row\}\s*\/>/);
 assert.match(ui,/bulkScaleCheck\(row,reading,labelAmount\)/);
 assert.match(ui,/Não salva a leitura/);
});
