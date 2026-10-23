import {test} from "node:test";
import assert from "node:assert/strict";
import {recebimentoManualSchema,conferirRecebimentosManuais} from "../src/modules/pdv/pdv-unificado-recebimento-manual.contract.js";
const snapshot={versaoRascunho:3,operacoes:[
 {empresaId:"loja",cnpj:"99999999999999",total:"180.00",sessaoCaixaId:"caixa-loja"},
 {empresaId:"banho",cnpj:"88888888888888",total:"70.00",sessaoCaixaId:"caixa-banho"}
]};
const data={versao:3,alocacoes:[
 {empresaId:"loja",sessaoCaixaId:"caixa-loja",pagamentos:[
  {forma:"CARTAO_CREDITO",valorCentavos:18000,parcelas:3,confirmadoPeloAtendente:true,referencia:"maquininha qualquer"}
 ]},
 {empresaId:"banho",sessaoCaixaId:"caixa-banho",pagamentos:[
  {forma:"DINHEIRO",valorCentavos:3000,confirmadoPeloAtendente:true},
  {forma:"PIX",valorCentavos:4000,confirmadoPeloAtendente:true}
 ]}
]};
const validate=v=>conferirRecebimentosManuais({dados:v,snapshot,organizacaoId:"org_test",reservaId:"res_test"});
test("manual debit/credit/pix/cash are accounted by company without PSP",()=>{
 const v=validate(data);
 assert.equal(v.prontoParaPersistirEmTransacao,true);
 assert.equal(v.movimentos.length,2);
 assert.equal(v.movimentos.find(m=>m.empresaId==="loja").pagamentos[0].parcelas,3);
 assert.equal(v.movimentos.find(m=>m.empresaId==="banho").totalCentavos,7000);
 assert.equal(v.podeEfetuarCobranca,false);
 assert.equal(v.confirmadoPorPSP,false);
 assert.equal(v.gravouPagamento,false);
});
test("manual receipt must be explicitly confirmed by cashier before accounting",()=>{
 const data2=structuredClone(data);
 data2.alocacoes[1].pagamentos[0].confirmadoPeloAtendente=false;
 const v=validate(data2);
 assert.equal(v.prontoParaPersistirEmTransacao,false);
 assert.equal(v.pendencias[0].codigo,"RECEBIMENTO_NAO_CONFIRMADO");
});
test("manual company allocation preserves original cashier, all companies and exact cents",()=>{
 const wrong=structuredClone(data);wrong.alocacoes[0].sessaoCaixaId="caixa-banho";
 assert.throws(()=>validate(wrong),/CAIXA_DIVERGENTE/);
 const altered=structuredClone(data);altered.alocacoes[0].pagamentos[0].valorCentavos=17999;
 assert.throws(()=>validate(altered),/SOMA_DIVERGENTE/);
 const duplicate=structuredClone(data);duplicate.alocacoes.push(duplicate.alocacoes[0]);
 assert.throws(()=>validate(duplicate),/EMPRESA_DUPLICADA/);
 const omitted=structuredClone(data);omitted.alocacoes.pop();
 assert.deepEqual(validate(omitted).pendencias,[{codigo:"EMPRESA_SEM_REGISTRO",empresaId:"banho"}]);
});
test("installments only for credit; client credit and unaudited forms are rejected",()=>{
 const debt=structuredClone(data);debt.alocacoes[0].pagamentos[0].forma="CREDITO_CLIENTE";
 assert.equal(recebimentoManualSchema.safeParse(debt).success,false);
 const debit=structuredClone(data);debit.alocacoes[0].pagamentos[0].forma="CARTAO_DEBITO";
 assert.equal(recebimentoManualSchema.safeParse(debit).success,false);
 const normalDebit=structuredClone(data);normalDebit.alocacoes[0].pagamentos[0].forma="CARTAO_DEBITO";normalDebit.alocacoes[0].pagamentos[0].parcelas=1;
 assert.equal(validate(normalDebit).prontoParaPersistirEmTransacao,true);
 const tooMany=structuredClone(data);tooMany.alocacoes[0].pagamentos[0].parcelas=25;
 assert.equal(recebimentoManualSchema.safeParse(tooMany).success,false);
});
test("manual replay derives stable fingerprint for exact same operator confirmation",()=>{
 const first=validate(data);
 const copy=structuredClone(data);
 assert.equal(first.fingerprint,validate(copy).fingerprint);
 const changed=structuredClone(data);changed.alocacoes[0].pagamentos[0].referencia="outro comprovante";
 assert.notEqual(first.fingerprint,validate(changed).fingerprint);
 const otherTenant=conferirRecebimentosManuais({dados:data,snapshot,organizacaoId:"outro",reservaId:"res_test"});
 assert.notEqual(first.fingerprint,otherTenant.fingerprint);
});
