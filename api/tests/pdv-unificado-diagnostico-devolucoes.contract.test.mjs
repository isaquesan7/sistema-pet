import {test} from "node:test";
import assert from "node:assert/strict";
import {diagnosticarDivergenciasDevolucoesM524 as diagnose}
 from "../src/modules/pdv/pdv-unificado-diagnostico-devolucoes.contract.js";
const hash="a".repeat(64);
const fixture=({stage="REPASSE_INTERNO_CONFIRMADO_MANUALMENTE",refund="20.00",advance=false}={})=>{
 const bruto="60.00",tarifa="1.20",antecipacao=advance?"2.00":"0.00";
 const liquido=advance?"56.80":"58.80";
 const amount=Number(refund)*100;
 const remaining=((6000-amount)/100).toFixed(2);
 const historyRow={preparacaoId:"pre",referenciaExtrato:"EXTRATO-CI-2026",
  estadoRepasseInterno:stage==="REPASSE_INTERNO_CONFIRMADO_MANUALMENTE"?
   "REPASSE_INTERNO_ATIVO":stage==="CORRECAO_INTERNA_REGISTRADA"?
   "REPASSE_INTERNO_COMPENSADO":"SEM_REPASSE_INTERNO",
  brutoOriginal:bruto,totalDevolucoesDeclaradas:refund,
  brutoSemDeclaracaoNoLivro:remaining,
  quantidadeDeclaracoes:amount>0?1:0,
  movimentos:amount>0?[{referenciaExterna:"DEVOLUCAO-CI-01",usuarioId:"reviewer",
   valorBrutoDeclarado:refund,tipo:"DECLARACAO_DE_DEVOLUCAO_EXTERNA_NAO_VERIFICADA"}]:[]};
 return {
  organizacaoId:"org",empresaId:"co",comandaId:"cmd",
  fluxo:{fase:"M5_16_FLUXO_OPERACIONAL_READ_ONLY",leituraSomente:true,
   integracaoBancaria:false,checkoutDisponivel:false,
   preparacoes:[{preparacaoId:"pre",empresaId:"co",comandaId:"cmd",
    referenciaExtrato:"EXTRATO-CI-2026",etapa:stage,valorBruto:bruto,
    tarifaCartao:tarifa,descontoAntecipacao:antecipacao,valorLiquido:liquido,
    tipo:advance?"ANTECIPACAO":"REPASSE_NORMAL",
    provaBancariaAutomatica:false,habilitadoParaEscrita:false,
    revisaoFinanceira:{codigoRevisao:hash,etapaRevisada:stage,
     valorLiquidoEsperado:liquido,habilitaCheckout:false}}]},
  historico:{fase:"M5_23_HISTORICO_DEVOLUCOES_EXTERNA_READ_ONLY",
   organizacaoId:"org",empresaId:"co",comandaId:"cmd",
   leituraSomente:true,bancoVerificadoIndependentemente:false,
   permiteNovoReembolso:false,
   preparacoes:[historyRow],
   totais:{brutoPreparacoes:bruto,devolucoesDeclaradas:refund,
    brutoSemDeclaracaoNoLivro:remaining,
    quantidadeDeclaracoes:amount>0?1:0}}
 };
};
test("M.5.24 diagnostic separates internal declaration from external fiscal proof",()=>{
 const r=diagnose(fixture());
 assert.equal(r.preparacoes[0].devolucoesDeclaradas,"20.00");
 assert.equal(r.preparacoes[0].brutoSemDeclaracaoNoLivro,"40.00");
 assert(r.preparacoes[0].pendencias.includes("RECUPERACAO_TARIFA_NAO_VERIFICADA"));
 assert(r.preparacoes[0].pendencias.includes("TRATAMENTO_FISCAL_POR_EMISSOR_PENDENTE"));
 assert.equal(r.preparacoes[0].provaExternaValidada,false);
 assert.equal(r.habilitaRegistroDeDevolucao,false);
 assert.equal(r.fazMovimentacaoBancaria,false);
 assert.equal(r.codigoDiagnostico.length,64);
 assert.deepEqual(r,diagnose(fixture()));
});
test("M.5.24 early-payout warning and no declaration remain explicitly pending",()=>{
 const a=diagnose(fixture({advance:true}));
 assert(a.preparacoes[0].pendencias.includes("RECUPERACAO_ANTECIPACAO_NAO_VERIFICADA"));
 const b=diagnose(fixture({refund:"0.00",stage:"CORRECAO_INTERNA_REGISTRADA"}));
 assert(b.preparacoes[0].pendencias.includes("TRATAMENTO_FISCAL_POR_EMISSOR_PENDENTE"));
 assert.equal(b.preparacoes[0].quantidadeDeclaracoes,0);
 const c=diagnose(fixture({refund:"0.00",stage:"AGUARDANDO_SEGUNDA_CONFERENCIA"}));
 assert(c.preparacoes[0].pendencias.includes("NENHUMA_DEVOLUCAO_EXTERNA_CONFERIDA"));
});
test("M.5.24 fails closed for stale stage, other company, bad totals and evidence spoof",()=>{
 const changes=[
  x=>{x.empresaId="co-2";},
  x=>{x.historico.preparacoes[0].estadoRepasseInterno="SEM_REPASSE_INTERNO";},
  x=>{x.historico.preparacoes[0].brutoOriginal="60.01";},
  x=>{x.historico.totais.devolucoesDeclaradas="0.00";},
  x=>{x.historico.preparacoes[0].movimentos[0].valorBrutoDeclarado="19.99";},
  x=>{x.historico.preparacoes[0].quantidadeDeclaracoes=3;},
  x=>{x.fluxo.preparacoes[0].tarifaCartao="1.21";},
  x=>{x.fluxo.preparacoes[0].revisaoFinanceira.codigoRevisao="b".repeat(5);},
  x=>{x.fluxo.checkoutDisponivel=true;},
  x=>{x.historico.bancoVerificadoIndependentemente=true;},
  x=>{x.historico.preparacoes.push(x.historico.preparacoes[0]);},
  x=>{x.fluxo.preparacoes[0].comandaId="other";}
 ];
 for(const f of changes){const x=fixture();f(x);
  assert.throws(()=>diagnose(x),/M524_/,JSON.stringify(x));
 }
});
