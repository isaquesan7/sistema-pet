/** M.5.44: conferência efêmera do recebimento, vinculada ao snapshot da API. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {previewManualReceipt} from "../../admin-web/src/lib/unifiedManualAllocation.js";
import {recebimentoManualSchema,conferirRecebimentosManuais} from "../src/modules/pdv/pdv-unificado-recebimento-manual.contract.js";

const preparo={id:"prep-ci",reservaId:"res-ci",status:"PREPARADA",versao:4,
 operacoes:[
  {empresaId:"loja",cnpj:"11111111111111",total:"5.00",sessaoCaixaId:"caixa-loja",pagamentos:[
   {forma:"DINHEIRO",valorCentavos:300},{forma:"PIX",valorCentavos:200}
  ]},
  {empresaId:"banho",cnpj:"22222222222222",total:"12.00",sessaoCaixaId:"caixa-banho",pagamentos:[
   {forma:"CARTAO_CREDITO",valorCentavos:1200}
  ]}
 ]};
const manual={
 loja:{0:{confirmadoPeloAtendente:true,referencia:"Conferido no caixa"},
  1:{confirmadoPeloAtendente:true,referencia:"Pix conferido externamente"}},
 banho:{0:{confirmadoPeloAtendente:true,parcelas:"3",referencia:"Referência digitada"}}
};

test("M.5.44: prévia corresponde ao contrato M.2 sem registrar nem cobrar",()=>{
 const check=previewManualReceipt(preparo,4,manual);
 assert.equal(check.pronto,true);
 assert.equal(check.somentePrevia,true);
 assert.deepEqual(check.dados.alocacoes[0].pagamentos.map(p=>p.valorCentavos),[300,200]);
 assert.equal(check.dados.alocacoes[1].pagamentos[0].parcelas,3);
 assert.equal(recebimentoManualSchema.safeParse(check.dados).success,true);
 const snapshot={versaoRascunho:4,operacoes:preparo.operacoes};
 const server=conferirRecebimentosManuais({dados:check.dados,snapshot,
  organizacaoId:"org-ci",reservaId:"res-ci"});
 assert.equal(server.prontoParaPersistirEmTransacao,true);
 assert.equal(server.movimentos.find(x=>x.empresaId==="loja").totalCentavos,500);
 assert.equal(server.podeEfetuarCobranca,false);
 assert.equal(server.gravouPagamento,false);
});

test("M.5.44: confirmação ausente bloqueia sem esconder campo false do contrato",()=>{
 const check=previewManualReceipt(preparo,4,{});
 assert.equal(check.pronto,false);
 assert.equal(check.pendencias.filter(p=>p.codigo==="RECEBIMENTO_NAO_CONFIRMADO").length,3);
 assert(check.dados.alocacoes.every(a=>a.pagamentos.every(p=>p.confirmadoPeloAtendente===false)));
 const server=conferirRecebimentosManuais({dados:check.dados,
  snapshot:{versaoRascunho:4,operacoes:preparo.operacoes},organizacaoId:"org-ci",reservaId:"res-ci"});
 assert.equal(server.prontoParaPersistirEmTransacao,false);
});

test("M.5.44: nunca permitir alteração de centavos, formas e caixa vindos do snapshot",()=>{
 const injection=structuredClone(manual);
 injection.loja[0].valorCentavos=99999;
 injection.loja[0].forma="CREDITO_CLIENTE";
 injection.loja[0].sessaoCaixaId="caixa-banho";
 const check=previewManualReceipt(preparo,4,injection);
 assert.equal(check.pronto,true);
 assert.equal(check.dados.alocacoes[0].sessaoCaixaId,"caixa-loja");
 assert.deepEqual(check.dados.alocacoes[0].pagamentos[0],{
  forma:"DINHEIRO",valorCentavos:300,confirmadoPeloAtendente:true,parcelas:1,
  referencia:"Conferido no caixa"
 });
 assert.equal(preparo.operacoes[0].pagamentos[0].valorCentavos,300);
});

test("M.5.44: versão expirada, preparo invalidado ou soma adulterada nunca liberam a prévia",()=>{
 assert.equal(previewManualReceipt(preparo,5,manual).pronto,false);
 assert.equal(previewManualReceipt({...preparo,status:"INVALIDADA"},4,manual).pronto,false);
 const wrong=structuredClone(preparo);
 wrong.operacoes[0].pagamentos[1].valorCentavos=199;
 assert(previewManualReceipt(wrong,4,manual).pendencias.some(p=>p.codigo==="SOMA_DIVERGENTE"));
 const repeated=structuredClone(preparo);
 repeated.operacoes.push(repeated.operacoes[0]);
 assert(previewManualReceipt(repeated,4,manual).pendencias.some(p=>p.codigo==="OPERACAO_INVALIDA"));
});

test("M.5.44: só crédito parcela; referência opcional e limites respeitados",()=>{
 const invalid=structuredClone(manual);
 invalid.banho[0].parcelas="25";
 assert(previewManualReceipt(preparo,4,invalid).pendencias.some(p=>p.codigo==="PARCELAS_INVALIDAS"));
 invalid.banho[0].parcelas="1e1";
 assert(previewManualReceipt(preparo,4,invalid).pendencias.some(p=>p.codigo==="PARCELAS_INVALIDAS"));
 invalid.banho[0].parcelas="3";
 invalid.loja[0].parcelas="2";
 assert(previewManualReceipt(preparo,4,invalid).pendencias.some(p=>p.codigo==="PARCELAS_INVALIDAS"));
 invalid.loja[0].parcelas="1";
 invalid.loja[0].referencia="X".repeat(121);
 assert(previewManualReceipt(preparo,4,invalid).pendencias.some(p=>p.codigo==="REFERENCIA_INVALIDA"));
 invalid.loja[0].referencia="";
 assert.equal(previewManualReceipt(preparo,4,invalid).pronto,true);
});

test("M.5.44: prévia local reaproveitada no fechamento autorizado e transacional",()=>{
 const ui=readFileSync(new URL("../../admin-web/src/pages/UnifiedPdvPreviewPage.jsx",import.meta.url),"utf8");
 const prepService=readFileSync(new URL("../src/modules/pdv/pdv-unificado-preparacao.service.js",import.meta.url),"utf8");
 const routes=readFileSync(new URL("../src/modules/pdv/pdv-unificado.routes.js",import.meta.url),"utf8");
 assert.match(prepService,/pagamentos:pagamentos\.map\(\(\{forma,valorCentavos\}\)/);
 assert.match(ui,/previewManualReceipt\(preparacao,versao,conferencias\)/);
 assert.match(ui,/preparation\.data\?\.status==="PREPARADA"/);
 assert.match(ui,/Verificar declaração \(sem registrar\)/);
 assert.match(ui,/confirmadoPeloAtendente:e\.target\.checked/);
 assert.match(routes,/checkoutUnificadoDisponivel:checkoutHabilitado/);
 assert.match(routes,/r\.post\("\/rascunhos\/:id\/fechar-manual"/);
 assert.match(routes,/if\(!checkoutManualHabilitado\(req\.organizacao,req\.empresa\.id\)\)/);
 assert.match(ui,/fechar\.mutate\(\)/);
});
