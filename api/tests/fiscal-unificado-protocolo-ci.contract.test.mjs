/** PointVet M.4D.1: ONLY simulated fiscal lifecycle; no provider. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {proximoEstadoFiscalCi,validarPlanoFiscalCi,ESTADOS_FISCAIS_CI}
 from "../src/modules/fiscal/fiscal-unificado-protocolo-ci.contract.js";

const step=(estado,tipo)=>proximoEstadoFiscalCi({
 estado,tipo,motivo:"Evidência simulada apenas CI sem transmissão"
});
test("M4D: uncertain result may only be resolved by manual simulated consultation",()=>{
 const a=step("PREPARADA_CI","SIMULAR_RESPOSTA_INDETERMINADA");
 assert.equal(a.estadoPosterior,"INDETERMINADA_CI");
 assert.equal(a.exigeConsultaManual,true);
 assert.equal(a.recebeuProtocoloReal,false);
 assert.equal(a.permitiuReenvioAutomatico,false);
 assert.throws(()=>step("INDETERMINADA_CI","SIMULAR_RESPOSTA_ACEITA"),/M4D_TRANSICAO_NAO_PERMITIDA/);
 assert.equal(step("INDETERMINADA_CI","SIMULAR_CONSULTA_ACEITA").estadoPosterior,"ACEITA_SIMULADA_CI");
 assert.equal(step("INDETERMINADA_CI","SIMULAR_CONSULTA_REJEITADA").estadoPosterior,"REJEITADA_CI");
});
test("M4D: cancellation only after simulated acceptance, never claims fiscal authorization",()=>{
 const accepted=step("PREPARADA_CI","SIMULAR_RESPOSTA_ACEITA");
 assert.equal(accepted.estadoPosterior,"ACEITA_SIMULADA_CI");
 assert.equal(accepted.autorizadoOficialmente,false);
 const canceled=step("ACEITA_SIMULADA_CI","SIMULAR_CANCELAMENTO");
 assert.equal(canceled.estadoPosterior,"CANCELADA_SIMULADA_CI");
 assert.equal(canceled.canceladoOficialmente,false);
 for(const s of ["REJEITADA_CI","CANCELADA_SIMULADA_CI","CONTINGENCIA_REVISAO_CI"])
  assert.throws(()=>step(s,"SIMULAR_CANCELAMENTO"),/M4D_TRANSICAO_NAO_PERMITIDA/);
 assert.throws(()=>step("PREPARADA_CI","SIMULAR_CANCELAMENTO"),/M4D_TRANSICAO_NAO_PERMITIDA/);
 assert.equal(step("PREPARADA_CI","SIMULAR_RESPOSTA_REJEITADA").estadoPosterior,"REJEITADA_CI");
});
test("M4D: contingency isolates failure, requires reason and blocks automatic resend",()=>{
 const action=step("PREPARADA_CI","SUSPENDER_POR_CONTINGENCIA");
 assert.equal(action.estadoPosterior,"CONTINGENCIA_REVISAO_CI");
 assert.equal(action.exigeConsultaManual,true);
 assert.equal(action.transmitiuDocumento,false);
 assert.throws(()=>step(action.estadoPosterior,"SIMULAR_RESPOSTA_ACEITA"),
  /M4D_TRANSICAO_NAO_PERMITIDA/);
 assert.throws(()=>proximoEstadoFiscalCi({
  estado:"PREPARADA_CI",tipo:"SUSPENDER_POR_CONTINGENCIA",motivo:"curto"
 }),/M4D_MOTIVO_AUDITAVEL_OBRIGATORIO/);
 assert.deepEqual(Object.keys(ESTADOS_FISCAIS_CI).length,6);
});
const plan={vendaId:"s",organizacaoId:"tenant",emissor:{
 empresaId:"a",ambiente:"HOMOLOGACAO"
},grupos:[{classe:"PRODUTO",tipoDocumentoEscolhido:"NFE",
 emissor:{empresaId:"a"},serieProposta:"1",pendencias:[],
 itens:[{id:"line",valorPlanejado:"1.00"}],total:"1.00"}],
 fingerprint:"fingerprint",emissaoHabilitada:false,gerouDocumento:false,autorizou:false};
test("M4D: issuer, fiscal class, document series and open issues are fail-closed",()=>{
 const good=validarPlanoFiscalCi(plan,{classe:"PRODUTO",tipoDocumento:"NFE"});
 assert.equal(good.podeTransmitir,false);
 assert.equal(good.empresaId,"a");
 for(const p of [
  {...plan,emissor:{...plan.emissor,ambiente:"PRODUCAO"}},
  {...plan,grupos:[{...plan.grupos[0],pendencias:["CLASSIFICACAO_AUSENTE"]}]},
  {...plan,grupos:[{...plan.grupos[0],serieProposta:null}]},
  {...plan,emissaoHabilitada:true}
 ])assert.throws(()=>validarPlanoFiscalCi(p,{
  classe:"PRODUTO",tipoDocumento:"NFE"
 }),/M4D_/);
 assert.throws(()=>validarPlanoFiscalCi(plan,{
  classe:"PRODUTO",tipoDocumento:"NFSE"
 }),/M4D_TIPO_FISCAL_INCOMPATIVEL/);
});
