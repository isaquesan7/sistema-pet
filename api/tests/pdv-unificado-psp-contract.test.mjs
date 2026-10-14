/** Safe pure contract tests: no DB, PSP or financial writes. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {
 STATUS_CONSULTA_PSP,correlacionarConsultaPsp,validarCapacidadesPsp
} from "../src/modules/pdv/pdv-unificado-consulta-psp.contract.js";

const expected=Object.freeze({
 provedor:"SIMULADOR_CI",empresaId:"company_1",cnpj:"99999999999999",
 recebedorRef:"ci_mock_account_1",chaveIdempotencia:"sha256:unchanged",
 valorCentavos:18750,moeda:"BRL"
});
const returned=Object.freeze({...expected,referenciaTransacao:"ci_mock_transaction_123",
 status:"PENDENTE"});

test("PSP correlation is fail-closed for every observed state",()=>{
 for(const status of STATUS_CONSULTA_PSP){
  const r=correlacionarConsultaPsp({esperado:expected,resposta:{...returned,status}});
  assert.equal(r.statusObservado,status);
  assert.equal(r.podeReenviar,false);
  assert.equal(r.podeFinalizarVenda,false);
  assert.equal(r.liquidacaoConfirmada,false);
  assert.equal(r.resultadoVerificadoPorPsp,false);
  assert.equal(r.proximaAcao,"AGUARDAR_CONCILIACAO_PSP_OFICIAL");
 }
});

test("PSP correlation rejects mismatched issuer, receiver, ID, amount, currency and provider",()=>{
 const failures=[
  [{cnpj:"88888888888888"},"PSP_RECEBEDOR_DIVERGENTE"],
  [{empresaId:"company_2"},"PSP_RECEBEDOR_DIVERGENTE"],
  [{recebedorRef:"ci_mock_account_2"},"PSP_RECEBEDOR_DIVERGENTE"],
  [{chaveIdempotencia:"sha256:different"},"PSP_CHAVE_DIVERGENTE"],
  [{valorCentavos:18751},"PSP_VALOR_DIVERGENTE"],
  [{moeda:"USD"},"PSP_CONSULTA_RESPOSTA_INVALIDA"],
  [{provedor:"UNAUTHORIZED_PSP"},"PSP_PROVEDOR_DIVERGENTE"],
  [{status:"SUCCESS_UNVERIFIED"},"PSP_CONSULTA_RESPOSTA_INVALIDA"],
  [{referenciaTransacao:""},"PSP_CONSULTA_RESPOSTA_INVALIDA"],
  [{valorCentavos:0},"PSP_CONSULTA_RESPOSTA_INVALIDA"]
 ];
 for(const [patch,error] of failures)assert.throws(
  ()=>correlacionarConsultaPsp({esperado:expected,resposta:{...returned,...patch}}),
  new RegExp(error)
 );
});

test("Invalid expected instructions cannot turn missing provider information into a payout",()=>{
 assert.throws(()=>correlacionarConsultaPsp({esperado:{...expected,cnpj:"other"},
  resposta:returned}),/PSP_CONSULTA_REQUISICAO_INVALIDA/);
 assert.throws(()=>correlacionarConsultaPsp({esperado:{...expected,valorCentavos:-1},
  resposta:returned}),/PSP_CONSULTA_REQUISICAO_INVALIDA/);
 assert.throws(()=>correlacionarConsultaPsp({esperado:expected,
  resposta:{...returned,status:"LIQUIDADA",valorCentavos:NaN}}),/PSP_CONSULTA_RESPOSTA_INVALIDA/);
});

test("PSP capabilities gate remains closed even with fully featured hypothetical provider",()=>{
 const allTrue={provedor:"HYPOTHETICAL",
  consultaIdempotente:true,assinaturaVerificavel:true,recebedoresSeparados:true,
  estornoPorRecebedor:true,consultaAntesDeRetry:true};
 const candidate=validarCapacidadesPsp(allTrue);
 assert.equal(candidate.contratoParaTesteCompleto,true);
 assert.equal(candidate.checkoutHabilitado,false);
 assert.equal(candidate.prontoParaHomologacaoFinanceira,false);
 const incomplete=validarCapacidadesPsp({provedor:"HYPOTHETICAL",
  consultaIdempotente:true,assinaturaVerificavel:true});
 assert.deepEqual(incomplete.faltantes,[
  "recebedoresSeparados","estornoPorRecebedor","consultaAntesDeRetry"
 ]);
 assert.throws(()=>validarCapacidadesPsp({}),/PSP_PROVEDOR_NAO_DEFINIDO/);
});
