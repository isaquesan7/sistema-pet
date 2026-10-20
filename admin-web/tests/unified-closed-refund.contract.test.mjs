/** M.5.54: retomada de venda unificada já fechada para estorno integral. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page=readFileSync(new URL("../src/pages/UnifiedPdvPreviewPage.jsx",import.meta.url),"utf8");

test("uma comanda concluída pode ser reaberta para estorno sem recriar cobrança",()=>{
 assert.match(page,/pdv-unificado\/rascunhos-concluidos/);
 assert.match(page,/Vendas unificadas concluídas — estorno integral/);
 assert.match(page,/enabled:manualReversalEnabled&&hasPermission\("pdv\.cancelar_venda"\)/);
 assert.match(page,/draft\?\.status!=="FECHADA"/);
 // A reabertura trava a edicao imediatamente, mas a conferencia so pode
 // montar depois de carregar a reserva; evita crash React em rede lenta.
 assert.match(page,/isReserved&&reservation\.data\?\.status==="RESERVADA"&&<UnifiedAllocationConference/);
 // Nao oferecer cancelamento de reserva ja CANCELADA apos estorno.
 assert.match(page,/isReserved&&reservation\.data\.status==="RESERVADA"&&!reservation\.data\.operacoes\.some/);
 assert.match(page,/if\(completed\)return <section/);
 assert.match(page,/operacoesFechadas=\{reservation\.operacoes\}/);
 assert.match(page,/queryKey:\["unified-completed"\]/);
});

test("M.5.56: estorno de contingência não apresenta controle de novas vendas",()=>{
 assert.match(page,/eligibility\.data\?\.estornoUnificadoDisponivel/);
 assert.match(page,/manualReversalEnabled&&hasPermission\("pdv\.cancelar_venda"\)/);
 assert.match(page,/checkoutEnabled&&<>/);
 assert.match(page,/vendaRegistrada&&reversalEnabled&&hasPermission\("pdv\.cancelar_venda"\)/);
 assert.match(page,/Contingência: novas vendas continuam bloqueadas/);
});

test("histórico integral estornado é somente leitura e independe do checkout manual",()=>{
 assert.match(page,/queryKey:scopedKey\("unified-reversals"\),enabled:enabled&&hasPermission\("pdv\.cancelar_venda"\)/);
 assert.match(page,/api\.get\("\/pdv-unificado\/rascunhos-estornados"\)/);
 assert.match(page,/Histórico de estornos integrais/);
 assert.match(page,/\(reversalHistory\.data\|\|\[\]\)\.map\(registro=><div/);
 assert.match(page,/queryKey:\["unified-reversals"\]/);
});
