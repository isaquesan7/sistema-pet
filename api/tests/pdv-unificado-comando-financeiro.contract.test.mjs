import {test} from "node:test";
import assert from "node:assert/strict";
import {validarComandoFinanceiroManualM518} from "../src/modules/pdv/pdv-unificado-comando-financeiro.contract.js";
const base=()=>{
 const preparacao={id:"prep-A",organizacaoId:"org-A",empresaId:"empresa-A",
  status:"PREPARADA_SEM_BAIXA",contaFinanceiraId:"conta-A",
  fingerprint:"a".repeat(64),referenciaExtrato:"EXTRATO-TESTE-20261015",
  liquidoDeclarado:"58.80"};
 const parecer={preparacaoId:"prep-A",organizacaoId:"org-A",empresaId:"empresa-A",
  fingerprint:"b".repeat(64),status:"CONFERENCIA_DOCUMENTAL_DECLARADA"};
 const lancamentoOriginal={id:"ledger-A",origem:"REPASSE_CARTAO_MANUAL_UNIFICADO",
  origemId:"prep-A",empresaId:"empresa-A",contaFinanceiraId:"conta-A",
  valor:"58.80",direcao:"ENTRADA",usuarioId:"op-A"};
 return {organizacaoId:"org-A",empresaId:"empresa-A",usuarioId:"op-A",
  operacao:"CONFIRMAR_REPASSE",preparacao,parecer,lancamentoOriginal,
  dados:{confirmouCreditoNoExtrato:true,
   referenciaExtrato:"EXTRATO-TESTE-20261015",
   fingerprintPreparacaoEsperado:"a".repeat(64),
   fingerprintParecerEsperado:"b".repeat(64),
   contaFinanceiraIdEsperada:"conta-A",valorLiquidoEsperado:"58.80"}};
};
test("M.5.18 confirmation is bound to DB fingerprint, review, bank account and exact cents",()=>{
 const b=base(),x=validarComandoFinanceiroManualM518(b);
 assert.equal(x.fingerprintComando.length,64);
 assert.deepEqual(x,validarComandoFinanceiroManualM518(b));
 assert.equal(x.verificaBancoAutomaticamente,false);
 for(const mutate of [
  b=>{b.dados.fingerprintPreparacaoEsperado="c".repeat(64);},
  b=>{b.preparacao.fingerprint="c".repeat(64);},
  b=>{b.parecer.fingerprint="c".repeat(64);},
  b=>{b.dados.fingerprintParecerEsperado="d".repeat(64);},
  b=>{b.dados.contaFinanceiraIdEsperada="other";},
  b=>{b.dados.valorLiquidoEsperado="59.00";},
  b=>{b.preparacao.liquidoDeclarado="58.81";},
  b=>{b.dados.referenciaExtrato="altered-ref";},
  b=>{b.empresaId="empresa-B";},
  b=>{b.dados.confirmouCreditoNoExtrato=false;}
 ]){const f=base();mutate(f);assert.throws(()=>validarComandoFinanceiroManualM518(f),/M518_/);}
});
test("M.5.18 corrections require exact original ledger and second operator",()=>{
 const b=base();b.operacao="CORRIGIR_REPASSE";b.usuarioId="second";
 b.dados={...b.dados,confirmouCorrecaoExterna:true,
  referenciaCorrecao:"CORRECAO-TESTE-20261015",
  motivo:"Correção aprovada manualmente por segundo operador",
  lancamentoOriginalIdEsperado:"ledger-A"};
 const valid=validarComandoFinanceiroManualM518(b);
 assert.equal(valid.executaPagamento,false);
 for(const mutate of [
  b=>{b.usuarioId="op-A";},
  b=>{b.dados.lancamentoOriginalIdEsperado="other";},
  b=>{b.lancamentoOriginal.valor="60.00";},
  b=>{b.lancamentoOriginal.empresaId="empresa-B";},
  b=>{b.lancamentoOriginal.contaFinanceiraId="other";},
  b=>{b.dados.referenciaCorrecao=b.preparacao.referenciaExtrato;},
  b=>{b.dados.motivo="too short";},
  b=>{b.dados.confirmouCorrecaoExterna=false;}
 ]){const f=base();f.operacao="CORRIGIR_REPASSE";f.usuarioId="second";
 f.dados={...b.dados};mutate(f);
 assert.throws(()=>validarComandoFinanceiroManualM518(f),/M518_/);}
});
