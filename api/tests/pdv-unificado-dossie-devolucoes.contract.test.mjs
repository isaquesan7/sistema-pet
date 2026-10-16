import {test} from "node:test";
import assert from "node:assert/strict";
import {diagnosticarDivergenciasDevolucoesM524}
 from "../src/modules/pdv/pdv-unificado-diagnostico-devolucoes.contract.js";
import {montarDossieDevolucoesM527}
 from "../src/modules/pdv/pdv-unificado-dossie-devolucoes.contract.js";

const h="a".repeat(64);
function fixture({refunds=["20.00"],company="empresa-1"}={}){
 let saldo=6000;
 const movimentos=refunds.map((s,i)=>{
  const cents=Math.round(Number(s)*100);saldo-=cents;
  return {id:"devolucao-"+i,referenciaExterna:"CI-REFUND-2026-"+i,
   valorBrutoDeclarado:s,saldoBrutoNaoDeclaradoApos:(saldo/100).toFixed(2),
   usuarioId:"declarante-"+i,registradoEm:`2026-10-${String(i+15).padStart(2,"0")}T10:00:00.000Z`,
   tipo:"DECLARACAO_DE_DEVOLUCAO_EXTERNA_NAO_VERIFICADA"};
 });
 const refunded=((6000-saldo)/100).toFixed(2),remaining=(saldo/100).toFixed(2);
 const etapa=refunds.length?"REPASSE_INTERNO_CONFIRMADO_MANUALMENTE":
  "AGUARDANDO_SEGUNDA_CONFERENCIA";
 const historico={fase:"M5_23_HISTORICO_DEVOLUCOES_EXTERNA_READ_ONLY",
  organizacaoId:"org",empresaId:company,comandaId:"cmd",
  leituraSomente:true,bancoVerificadoIndependentemente:false,
  permiteNovoReembolso:false,
  preparacoes:[{preparacaoId:"pre",referenciaExtrato:"CI-EXTRATO",
   estadoRepasseInterno:refunds.length?"REPASSE_INTERNO_ATIVO":"SEM_REPASSE_INTERNO",
   brutoOriginal:"60.00",totalDevolucoesDeclaradas:refunded,
   brutoSemDeclaracaoNoLivro:remaining,quantidadeDeclaracoes:movimentos.length,
   movimentos}],
  totais:{brutoPreparacoes:"60.00",devolucoesDeclaradas:refunded,
   brutoSemDeclaracaoNoLivro:remaining,quantidadeDeclaracoes:movimentos.length}};
 const fluxo={fase:"M5_16_FLUXO_OPERACIONAL_READ_ONLY",
  leituraSomente:true,integracaoBancaria:false,checkoutDisponivel:false,
  preparacoes:[{preparacaoId:"pre",empresaId:company,comandaId:"cmd",
   referenciaExtrato:"CI-EXTRATO",etapa,valorBruto:"60.00",
   tarifaCartao:"1.20",descontoAntecipacao:"0.00",valorLiquido:"58.80",
   tipo:"REPASSE_NORMAL",provaBancariaAutomatica:false,
   habilitadoParaEscrita:false,
   revisaoFinanceira:{codigoRevisao: h,etapaRevisada:etapa,
    valorLiquidoEsperado:"58.80",habilitaCheckout:false}}]};
 const diagnostico=diagnosticarDivergenciasDevolucoesM524({
  organizacaoId:"org",empresaId:company,comandaId:"cmd",fluxo,historico
 });
 return {historico,diagnostico};
}

test("M.5.27 assembles actionable but non-executable independent-review checklist",()=>{
 const result=montarDossieDevolucoesM527(fixture());
 assert.equal(result.fase,"M5_27_DOSSIE_REVISAO_INDEPENDENTE_READ_ONLY");
 assert.equal(result.totais.valorDeclaradoSemProva,"20.00");
 assert.equal(result.totais.brutoSemDeclaracao,"40.00");
 assert.equal(result.totais.quantidadeDeclaracoes,1);
 assert.equal(result.preparacoes[0].declaracoes[0].referenciaInformada,
  "CI-REFUND-2026-0");
 assert.equal(result.preparacoes[0].declaracoes[0].declaranteUsuarioId,
  "declarante-0");
 assert(result.preparacoes[0].declaracoes[0].checklistPendente.includes(
  "DESIGNAR_SEGUNDO_CONFERENTE_DIFERENTE_DO_DECLARANTE"));
 assert.equal(result.permiteConcluirRevisao,false);
 assert.equal(result.permiteNovoReembolso,false);
 assert.equal(result.permiteLancamentoFinanceiro,false);
 assert.equal(result.permiteOperacaoFiscal,false);
 assert.equal(result.habilitaCheckout,false);
 assert.equal(result.provasBancariasValidas,false);
 assert.match(result.codigoDossie,/^[a-f0-9]{64}$/);
 assert.deepEqual(result,montarDossieDevolucoesM527(fixture()));
});

test("M.5.27 changes dossier version for new declarations and never assumes completeness",()=>{
 const old=montarDossieDevolucoesM527(fixture());
 const full=montarDossieDevolucoesM527(fixture({refunds:["20.00","40.00"]}));
 assert.notEqual(full.codigoDossie,old.codigoDossie);
 assert.equal(full.totais.valorDeclaradoSemProva,"60.00");
 assert.equal(full.totais.brutoSemDeclaracao,"0.00");
 assert.equal(full.totais.quantidadeDeclaracoes,2);
 assert.equal(full.provasBancariasValidas,false);
 assert.equal(full.permiteNovoReembolso,false);
 const empty=montarDossieDevolucoesM527(fixture({refunds:[]}));
 assert.equal(empty.totais.quantidadeDeclaracoes,0);
 assert.equal(empty.totais.brutoSemDeclaracao,"60.00");
 assert.equal(empty.permiteConcluirRevisao,false);
});

test("M.5.27 refuses tampering, cross-CNPJ, duplicate proof references and fake approvals",()=>{
 const cases=[
  x=>{x.historico.empresaId="empresa-2";},
  x=>{x.diagnostico.empresaId="empresa-2";},
  x=>{x.diagnostico.codigoDiagnostico="a".repeat(64);},
  x=>{x.diagnostico.habilitaCheckout=true;},
  x=>{x.diagnostico.preparacoes[0].devolucoesDeclaradas="20.01";},
  x=>{x.diagnostico.preparacoes[0].provaExternaValidada=true;},
  x=>{x.diagnostico.preparacoes[0].pendencias=[];},
  x=>{x.historico.bancoVerificadoIndependentemente=true;},
  x=>{x.historico.preparacoes[0].movimentos[0].usuarioId="";},
  x=>{x.historico.preparacoes[0].movimentos[0].valorBrutoDeclarado="19.99";},
  x=>{x.historico.preparacoes[0].movimentos[0].saldoBrutoNaoDeclaradoApos="39.99";},
  x=>{x.historico.preparacoes[0].movimentos[0].registradoEm="bad-time";},
  x=>{x.historico.preparacoes[0].movimentos[0].tipo="PROVA_BANCARIA";},
  x=>{x.historico.totais.devolucoesDeclaradas="0.00";},
  x=>{x.historico.preparacoes[0].quantidadeDeclaracoes=2;},
  x=>{x.historico.preparacoes[0].movimentos.push(
   {...x.historico.preparacoes[0].movimentos[0]});},
  x=>{x.diagnostico.preparacoes.push(x.diagnostico.preparacoes[0]);}
 ];
 for(const mutate of cases){
  const x=structuredClone(fixture());mutate(x);
  assert.throws(()=>montarDossieDevolucoesM527(x),/M527_/);
 }
 assert.notEqual(montarDossieDevolucoesM527(fixture()).codigoDossie,
  montarDossieDevolucoesM527(fixture({company:"empresa-2"})).codigoDossie);
});
