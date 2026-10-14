/** PointVet M.3C — fail-closed reversal input, without DB. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {normalizarPedidoEstornoManual,fingerprintEstornoManual,validarReversaoPendente}
 from "../src/modules/pdv/pdv-unificado-estorno-manual.contract.js";
const pedido=()=>normalizarPedidoEstornoManual({motivo:"Reembolso confirmado fora do PDV",confirmouDevolucaoExterna:true});
test("M3C exige confirmação e motivo",()=>{
 assert.equal(pedido().confirmouDevolucaoExterna,true);
 assert.throws(()=>normalizarPedidoEstornoManual({motivo:"curto",confirmouDevolucaoExterna:true}),/M3C_MOTIVO/);
 assert.throws(()=>normalizarPedidoEstornoManual({motivo:"Motivo válido sem confirmação"}),/M3C_CONFIRMACAO/);
});
test("M3C idempotência cobre operador e conteúdo",()=>{
 const a=fingerprintEstornoManual({reservaId:"r",usuarioId:"u",pedido:pedido()});
 assert.equal(a,fingerprintEstornoManual({reservaId:"r",usuarioId:"u",pedido:pedido()}));
 assert.notEqual(a,fingerprintEstornoManual({reservaId:"r",usuarioId:"u2",pedido:pedido()}));
});
test("M3C bloqueia parcelas conciliadas, fiscal, financeiro e pagamentos incompatíveis",()=>{
 assert(validarReversaoPendente({pagamentos:[{status:"APROVADO"},{status:"PENDENTE"}]}).aptoParaReversaoInterna);
 assert.throws(()=>validarReversaoPendente({parcelas:[{status:"CONCILIADA"}]}),/M3C_REPASSE/);
 assert.throws(()=>validarReversaoPendente({parcelas:[{status:"AGUARDANDO_REPASSE",conciliadoEm:new Date()}]}),/M3C_REPASSE/);
 assert.throws(()=>validarReversaoPendente({documentosFiscais:[{}]}),/M3C_FISCAL/);
 assert.throws(()=>validarReversaoPendente({titulosFinanceiros:[{}]}),/M3C_FINANCEIRO/);
 assert.throws(()=>validarReversaoPendente({conciliacoes:[{}]}),/M3C_FINANCEIRO/);
 assert.throws(()=>validarReversaoPendente({pagamentos:[{status:"REEMBOLSADO"}]}),/M3C_PAGAMENTO/);
});
