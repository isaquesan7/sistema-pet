/** M.5.42: pré-conferência local de recebimentos mistos, sem registro real. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {manualReaisToCents,defaultManualPayment,previewManualAllocation} from "../../admin-web/src/lib/unifiedManualAllocation.js";

const operacoes=[
 {empresaId:"pet",cnpj:"11111111111111",valor:"50.00",nome:"Pet King"},
 {empresaId:"banho",cnpj:"22222222222222",valor:"10.01",nome:"Banho"}
];
const caixas=[
 {empresaId:"pet",sessaoCaixaId:"caixa-pet",caixa:"Caixa A"},
 {empresaId:"banho",sessaoCaixaId:"caixa-banho",caixa:"Caixa B"}
];
const forms={pet:{sessaoCaixaId:"caixa-pet",pagamentos:[
 {id:"p1",forma:"DINHEIRO",valor:"30,00"},
 {id:"p2",forma:"PIX",valor:"20.00"}
]}};

test("M.5.42: pagamentos mistos totalizam centavos exatos por CNPJ, sem cobrança",()=>{
 const conferido=previewManualAllocation(operacoes,caixas,forms);
 assert.equal(conferido.pronto,true);
 assert.deepEqual(conferido.pendencias,[]);
 assert.deepEqual(conferido.alocacoes,[
  {empresaId:"pet",sessaoCaixaId:"caixa-pet",pagamentos:[
   {forma:"DINHEIRO",valorCentavos:3000},{forma:"PIX",valorCentavos:2000}
  ]},
  {empresaId:"banho",sessaoCaixaId:"caixa-banho",pagamentos:[{forma:"PIX",valorCentavos:1001}]}
 ]);
 assert.deepEqual(defaultManualPayment(operacoes[0]),{id:"inicial",forma:"PIX",valor:"50.00"});
});

test("M.5.42: nunca aceitar diferenças de 1 centavo ou tentativa de caixa cruzado",()=>{
 const wrong={pet:{pagamentos:[{forma:"PIX",valor:"49,99"}]}};
 const check=previewManualAllocation(operacoes,caixas,wrong);
 assert.equal(check.pronto,false);
 assert(check.pendencias.some(p=>p.codigo==="SOMA_DIVERGENTE"&&p.diferencaCentavos===-1));
 const otherCash=previewManualAllocation(operacoes,caixas,{pet:{...forms.pet,sessaoCaixaId:"caixa-banho"}});
 assert.equal(otherCash.pronto,false);
 assert(otherCash.pendencias.some(p=>p.empresaId==="pet"&&p.codigo==="CAIXA_INDISPONIVEL"));
 const noCash=previewManualAllocation(operacoes,[],forms);
 assert.equal(noCash.pronto,false);
});

test("M.5.42: entradas em reais com até 2 casas e sem erro de ponto flutuante",()=>{
 assert.deepEqual(manualReaisToCents("0,01"),{centavos:1});
 assert.deepEqual(manualReaisToCents("5"),{centavos:500});
 assert.deepEqual(manualReaisToCents("10,01"),{centavos:1001});
 assert.deepEqual(manualReaisToCents("0.10"),{centavos:10});
 assert.deepEqual(manualReaisToCents("999999999.99"),{centavos:99999999999});
 for(const raw of ["","0,00","-1","0.001","1e3","1.234,56","a","9999999999.99","1,2,3"])
  assert(manualReaisToCents(raw).erro,raw);
});

test("M.5.42: valores inválidos, formas proibidas, pagamentos vazios ou em excesso são pendências locais",()=>{
 for(const row of [{forma:"CREDITO_CLIENTE",valor:"50"},{forma:"PIX",valor:"0"},{forma:"PIX",valor:"50.001"}]){
  const v=previewManualAllocation(operacoes,caixas,{pet:{pagamentos:[row]}});
  assert.equal(v.pronto,false);
  assert(v.pendencias.some(p=>p.codigo==="PAGAMENTO_INVALIDO"));
 }
 for(const pagamentos of [[],Array.from({length:11},()=>({forma:"PIX",valor:"1"}))]){
  const v=previewManualAllocation(operacoes,caixas,{pet:{pagamentos}});
  assert(v.pendencias.some(p=>p.codigo==="QUANTIDADE_PAGAMENTOS_INVALIDA"));
 }
 const duplicado=previewManualAllocation([...operacoes,operacoes[0]],caixas);
 assert(duplicado.pendencias.some(p=>p.codigo==="EMPRESA_DUPLICADA"));
 assert.equal(previewManualAllocation([],caixas).pronto,false);
});

test("M.5.42: UI pré-confere apenas formas e centavos, separado do fechamento protegido",()=>{
 const ui=readFileSync(new URL("../../admin-web/src/pages/UnifiedPdvPreviewPage.jsx",import.meta.url),"utf8");
 const routes=readFileSync(new URL("../src/modules/pdv/pdv-unificado.routes.js",import.meta.url),"utf8");
 assert.match(ui,/previewManualAllocation\(reservation\.operacoes,sessions\.data\|\|\[\],forms\)/);
 assert.match(ui,/Adicionar forma/);
 assert.match(ui,/Remover forma/);
 assert.match(ui,/conferencia-alocacao/);
 assert.match(ui,/disabled=\{dirty\|\|!localCheck\.pronto\|\|sessions\.isLoading/);
 assert.match(routes,/checkoutUnificadoDisponivel:checkoutHabilitado/);
 assert.match(routes,/if\(!checkoutManualHabilitado\(req\.organizacao,req\.empresa\.id\)\)/);
});
