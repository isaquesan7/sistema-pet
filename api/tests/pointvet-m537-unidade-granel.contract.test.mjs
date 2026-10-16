/** PointVet M.5.37: unit-lock and history checks without a database. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FONTES_UNIDADE_EM_USO,protegerUnidadeEstoque} from "../src/modules/catalogo/catalogo-unidade.service.js";

const base={itemId:"item-kilo",produtoId:"prod-kilo",unidadeAnterior:"QUILOGRAMA",unidadeNova:"GRAMA"};
function fakeTx({unidade="QUILOGRAMA",bloqueios=[]}={}){
 const calls={lock:0,models:[]};
 const tx={
  $queryRaw:async(strings,...values)=>{assert.match(strings.join("?"),/FOR UPDATE/);assert.equal(values[0],base.itemId);calls.lock++;return [{id:base.produtoId}]},
  produto:{findUnique:async()=>({unidade})}
 };
 for(const model of FONTES_UNIDADE_EM_USO)tx[model]={count:async({where})=>{
  assert.deepEqual(where,model.includes("Estoque")||["loteProduto","estoqueSaldo"].includes(model)?{produtoId:base.produtoId}:{itemCatalogoId:base.itemId});
  calls.models.push(model);
  return bloqueios.includes(model)?1:0;
 }};
 return {tx,calls};
}

test("sem histórico permite correção da unidade somente após lock e reconsulta",async()=>{
 const {tx,calls}=fakeTx();
 await protegerUnidadeEstoque(tx,base);
 assert.equal(calls.lock,1);
 assert.deepEqual(calls.models.sort(),[...FONTES_UNIDADE_EM_USO].sort());
});

test("saldo, lotes, movimentos e vínculos comerciais impedem trocar kg por g",async()=>{
 for(const model of FONTES_UNIDADE_EM_USO){
  const {tx}=fakeTx({bloqueios:[model]});
  await assert.rejects(()=>protegerUnidadeEstoque(tx,base),/UNIDADE_ESTOQUE_EM_USO/,model);
 }
});

test("concorrência com unidade já alterada bloqueia; PATCH sem mudança não consulta DB",async()=>{
 const changed=fakeTx({unidade:"LITRO"});
 await assert.rejects(()=>protegerUnidadeEstoque(changed.tx,base),/UNIDADE_ESTOQUE_DESATUALIZADA/);
 assert.equal(changed.calls.lock,1);
 assert.deepEqual(changed.calls.models,[]);
 const same=fakeTx();
 await protegerUnidadeEstoque(same.tx,{...base,unidadeNova:"QUILOGRAMA"});
 assert.equal(same.calls.lock,0);
});

test("PATCH usa transação serializável, retorna 409 e não modifica fiscal",()=>{
 const service=readFileSync(new URL("../src/modules/catalogo/catalogo.service.js",import.meta.url),"utf8");
 const controller=readFileSync(new URL("../src/modules/catalogo/catalogo.controller.js",import.meta.url),"utf8");
 assert.match(service,/if\(alterandoUnidade\)await protegerUnidadeEstoque\(tx/);
 assert.match(service,/isolationLevel:alterandoUnidade\?"Serializable"/);
 assert.match(controller,/UNIDADE_ESTOQUE_EM_USO:\s*\[409/);
 assert.doesNotMatch(service,/documentoFiscal|criarDocumentoAutomaticoVenda|prestadorFiscal/);
});
