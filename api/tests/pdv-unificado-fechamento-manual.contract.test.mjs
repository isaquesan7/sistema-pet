/** M.3A — contratos contábeis fail-closed, sem PostgreSQL nem efeitos. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {centavosExatos,distribuirParcelasCentavos,planejarEfetivacaoManualUnificada}
 from "../src/modules/pdv/pdv-unificado-fechamento-manual.contract.js";
function fixture(){
 const operacoes=[
  {id:"op1",reservaId:"res1",empresaId:"loja",chaveIdempotencia:"key1",status:"VENDA_RASCUNHO",vendaId:"ven1",valorTotal:"180.00"},
  {id:"op2",reservaId:"res1",empresaId:"estetica",chaveIdempotencia:"key2",status:"VENDA_RASCUNHO",vendaId:"ven2",valorTotal:"140.00"}
 ];
 return {
  reserva:{id:"res1",status:"RESERVADA",comandaId:"com1",versaoRascunho:1},
  snapshot:{comandaId:"com1",versaoRascunho:1,total:"320.00",operacoes:[
   {empresaId:"loja",cnpj:"111",chaveIdempotencia:"key1",sessaoCaixaId:"cx1",total:"180.00",itens:[{comandaItemId:"ci1"}]},
   {empresaId:"estetica",cnpj:"222",chaveIdempotencia:"key2",sessaoCaixaId:"cx2",total:"140.00",itens:[{comandaItemId:"ci2"}]}
  ]},
  registro:{id:"reg1",reservaId:"res1",fingerprint:"original",status:"REGISTRADO",linhas:[
   {id:"l1",operacaoId:"op1",indice:0,forma:"CARTAO_CREDITO",valor:"180.00",parcelas:3,sessaoCaixaId:"cx1",confirmadoEm:new Date(),pagamentoId:null},
   {id:"l2",operacaoId:"op2",indice:0,forma:"DINHEIRO",valor:"140.00",parcelas:1,sessaoCaixaId:"cx2",confirmadoEm:new Date(),pagamentoId:null}
  ]},
  operacoes,
  vendas:[{id:"ven1",comandaId:"com1",empresaId:"loja",status:"ABERTA",valorTotal:"180.00"},
          {id:"ven2",comandaId:"com1",empresaId:"estetica",status:"ABERTA",valorTotal:"140.00"}]
 };
}
const plan=x=>planejarEfetivacaoManualUnificada(x);
test("centavos rejeitam floats e truncamento",()=>{
 assert.equal(centavosExatos("23.50"),2350);
 for(const v of [-1,"1.234","NaN","1e3","0","2,00",null])assert.throws(()=>centavosExatos(v),/M3_VALOR_INVALIDO/);
});
test("parcelas distribuem resto sem arredondamento e nunca presumem repasse",()=>{
 const p=distribuirParcelasCentavos(1001,3);
 assert.deepEqual(p.map(x=>x.valorCentavos),[334,334,333]);
 assert(p.every(x=>x.status==="AGUARDANDO_REPASSE"&&x.vencimentoEm===null));
 assert.throws(()=>distribuirParcelasCentavos(2,3),/M3_PARCELAMENTO_INVALIDO/);
});
test("M.3A planeja por empresa sem saldo bancario e sem caixa duplicado",()=>{
 const x=fixture(),p=plan(x);
 assert.equal(p.operacoes.length,2);
 assert.equal(p.operacoes[1].pagamentos[0].statusPagamento,"PENDENTE");
 assert.equal(p.operacoes[1].pagamentos[0].parcelasAReceber.length,3);
 assert.equal(p.operacoes[0].pagamentos[0].movimentoCaixaSomenteAuditoria,"VENDA");
 assert.equal(p.operacoes[0].pagamentos[0].saldoBancarioDisponivel,false);
 assert.equal(p.podeEfetivarAgora,false);
 assert.equal(p.pagamentoPersistido,false);
 assert.equal(p.fingerprint,plan(x).fingerprint);
});
test("M.3A recusa reserva cancelada e venda finalizada antes de transacionar",()=>{
 let x=fixture();x.reserva.status="CANCELADA";assert.throws(()=>plan(x),/M3_PREPARACAO_INVALIDA/);
 x=fixture();x.vendas[0].status="FINALIZADA";assert.throws(()=>plan(x),/M3_VENDA_OU_VALOR_DIVERGENTE/);
});
test("M.3A bloqueia caixa trocado, valor alterado, duplicate e pagamento existente",()=>{
 for(const mutation of [
  x=>x.registro.linhas[1].sessaoCaixaId="cx1",
  x=>x.registro.linhas[0].valor="179.00",
  x=>x.registro.linhas.push({...x.registro.linhas[0]}),
  x=>x.registro.linhas[0].pagamentoId="pagoAntigo"
 ]){
  const x=fixture();mutation(x);assert.throws(()=>plan(x),/M3_/);
 }
});
test("M.3A rejeita PSP/credito cliente e parcelamento fora do credito",()=>{
 let x=fixture();x.registro.linhas[0].forma="CREDITO_CLIENTE";assert.throws(()=>plan(x),/M3_LINHA_INVALIDA/);
 x=fixture();x.registro.linhas[1].parcelas=2;assert.throws(()=>plan(x),/M3_LINHA_INVALIDA/);
});
test("M.3A requer chave de operacao da preparacao e total exacto",()=>{
 let x=fixture();x.operacoes[0].chaveIdempotencia="troca";assert.throws(()=>plan(x),/M3_VENDA_OU_VALOR_DIVERGENTE/);
 x=fixture();x.snapshot.total="350.00";assert.throws(()=>plan(x),/M3_TOTAL_DIVERGENTE/);
});
test("M.3A impede incluir linha de outra operacao/empresa",()=>{
 const x=fixture();x.registro.linhas[0].operacaoId="inventada";
 assert.throws(()=>plan(x),/M3_PAGAMENTO_INCOMPLETO/);
});
