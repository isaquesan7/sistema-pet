import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {gerarReferenciaRevisaoManualM519} from "../src/modules/pdv/pdv-unificado-revisao-financeira.contract.js";
import {projetarHistoricoDevolucoesM523 as project} from "../src/modules/pdv/pdv-unificado-devolucoes-historico.contract.js";
const sha=o=>createHash("sha256").update(JSON.stringify(o)).digest("hex");
function fixture(){
 const p={id:"pre",organizacaoId:"org",empresaId:"co",comandaId:"cmd",
  status:"PREPARADA_SEM_BAIXA",fingerprint:"a".repeat(64),
  contaFinanceiraId:"bank",referenciaExtrato:"EXTRATO-CI-0001",
  bruto:"60.00",liquidoDeclarado:"58.80",
  parecerDocumental:{preparacaoId:"pre",organizacaoId:"org",empresaId:"co",
   status:"CONFERENCIA_DOCUMENTAL_DECLARADA",fingerprint:"b".repeat(64)}};
 const entry={id:"entry",empresaId:"co",origem:"REPASSE_CARTAO_MANUAL_UNIFICADO",
  origemId:"pre",direcao:"ENTRADA",contaFinanceiraId:"bank",
  valor:"58.80",usuarioId:"first"};
 const version=gerarReferenciaRevisaoManualM519({
  organizacaoId:"org",empresaId:"co",comandaId:"cmd",
  preparacaoId:"pre",etapa:"REPASSE_INTERNO_CONFIRMADO_MANUALMENTE",
  fingerprintPreparacao:p.fingerprint,
  fingerprintParecer:p.parecerDocumental.fingerprint,
  contaFinanceiraId:"bank",valorLiquido:"58.80",lancamentoOriginalId:"entry"
 }).codigoRevisao;
 return {organizacaoId:"org",empresaId:"co",comandaId:"cmd",
  preparacoes:[p],devolucoes:[],entradas:[entry],correcoes:[],auditorias:[],
  version};
}
function append(f,{id,amount,before,after,createdAt="2026-10-15T12:00:00.000Z"}){
 const motivo="Registro externo confirmado manualmente, sem vínculo com o banco";
 const referenciaExterna="REF-DEVOLUCAO-"+id;
 const record={versao:"M522_V1",organizacaoId:"org",empresaId:"co",
  usuarioId:"second",comandaId:"cmd",preparacaoId:"pre",
  conciliacaoOrigemId:"entry",referenciaExterna,motivo,
  valorBruto:amount,saldoRestanteBrutoEsperado:before,
  codigoRevisao:f.version};
 const fingerprint=sha(record);
 const refund={id,organizacaoId:"org",empresaId:"co",comandaId:"cmd",
  preparacaoId:"pre",conciliacaoOrigemId:"entry",usuarioId:"second",
  referenciaExterna,valorBruto:amount,motivo,
  confirmacaoHumanaExterna:true,codigoRevisao:f.version,
  fingerprint,createdAt,
  snapshot:{status:"DECLARACAO_HUMANA_NAO_VERIFICADA_PELO_BANCO",
   saldoAntes:before,saldoDepois:after,motivo,
   naoHaComprovacaoAutomatica:true,naoAlteraCaixaFinanceiroFiscal:true}};
 const audit={entidade:"DEVOLUCAO_CLIENTE_MANUAL",
  entidadeId:id,acao:"DEVOLUCAO_EXTERNA_DECLARADA_CI",
  organizacaoId:"org",empresaId:"co",usuarioId:"second",
  dadosNovos:{fingerprint,preparacaoId:"pre",conciliacaoOrigemId:"entry",
   referenciaExterna,valorBruto:amount,saldoRestante:after,
   comprovacaoAutomaticaBanco:false,semMutacaoFinanceiraFiscal:true}};
 f.devolucoes.push(refund);f.auditorias.push(audit);
}
test("M.5.23 empty and two causal declarations 20+40 show BRUTO not declared, not banking balance",()=>{
 const f=fixture(),empty=project(f);
 assert.equal(empty.preparacoes[0].brutoSemDeclaracaoNoLivro,"60.00");
 assert.equal(empty.totais.quantidadeDeclaracoes,0);
 append(f,{id:"z",amount:"20.00",before:"60.00",after:"40.00"});
 append(f,{id:"a",amount:"40.00",before:"40.00",after:"0.00"});
 const x=project(f);
 assert.equal(x.preparacoes[0].movimentos[0].id,"z",
  "same-timestamp declarations must preserve causal order, not id order");
 assert.equal(x.totais.devolucoesDeclaradas,"60.00");
 assert.equal(x.totais.brutoSemDeclaracaoNoLivro,"0.00");
 assert.equal(x.preparacoes[0].quantidadeDeclaracoes,2);
 for(const field of ["historicoExternoComprovadoCompleto","bancoVerificadoIndependentemente",
  "saldoBancarioDisponivel","permiteNovoReembolso","permiteNovoRegistro",
  "geraMovimentoFinanceiro","geraEstornoFiscal","liberaCheckout"])
  assert.equal(x[field],false,field);
});
test("M.5.23 refuses adulterated audit, snapshots, origin and company",()=>{
 const mutations=[
  f=>{f.devolucoes[0].empresaId="other";},
  f=>{f.devolucoes[0].valorBruto="21.00";},
  f=>{f.devolucoes[0].fingerprint="c".repeat(64);},
  f=>{f.devolucoes[0].codigoRevisao="c".repeat(64);},
  f=>{f.devolucoes[0].snapshot.saldoAntes="59.00";},
  f=>{f.devolucoes[0].snapshot.saldoDepois="39.00";},
  f=>{f.devolucoes[0].confirmacaoHumanaExterna=false;},
  f=>{f.devolucoes[0].conciliacaoOrigemId="wrong";},
  f=>{f.auditorias[0].dadosNovos.fingerprint="c".repeat(64);},
  f=>{f.auditorias=[];},
  f=>{f.entradas[0].contaFinanceiraId="other";},
  f=>{f.correcoes=[{id:"cor",empresaId:"co",origem:"ESTORNO_REPASSE_CARTAO_MANUAL_UNIFICADO",
   origemId:"entry",direcao:"SAIDA"}];}
 ];
 for(const change of mutations){
  const f=fixture();append(f,{id:"1",amount:"20.00",before:"60.00",after:"40.00"});
  change(f);assert.throws(()=>project(f),/M523_|M522_/);
 }
});
test("M.5.23 rejects duplicate references, over-refund and wrong causal chain",()=>{
 for(const alter of [
  f=>{f.devolucoes[1].referenciaExterna=f.devolucoes[0].referenciaExterna;},
  f=>{f.devolucoes[1].snapshot.saldoDepois="-1.00";},
  f=>{f.devolucoes[1].snapshot.saldoAntes="60.00";},
  f=>{f.devolucoes[1].snapshot.saldoDepois="1.00";}
 ]){
  const f=fixture();
  append(f,{id:"1",amount:"20.00",before:"60.00",after:"40.00"});
  append(f,{id:"2",amount:"40.00",before:"40.00",after:"0.00"});
  alter(f);assert.throws(()=>project(f),/M523_|M522_/);
 }
});
test("M.5.23 keeps no declarations visible for pre-baixa without repasse",()=>{
 const f=fixture();f.entradas=[];
 const x=project(f);
 assert.equal(x.preparacoes[0].estadoRepasseInterno,"SEM_REPASSE_INTERNO");
 assert.equal(x.preparacoes[0].permiteNovoRegistro,false);
 assert.equal(x.totais.brutoSemDeclaracaoNoLivro,"60.00");
});
