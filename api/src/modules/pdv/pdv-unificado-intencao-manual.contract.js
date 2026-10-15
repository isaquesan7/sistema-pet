/**
 * PointVet M.5.17 — PURE operational manual repasse intention/dry-run.
 * A simulation is not authority to book money or modify any object.
 * Human bank review is an off-platform assertion only. No backend writes.
 */
import {gerarReferenciaRevisaoManualM519} from "./pdv-unificado-revisao-financeira.contract.js";
const fail=x=>{throw Error("M517_"+x);};
const REF=/^[A-Za-z0-9][A-Za-z0-9_./:-]{7,119}$/;
const MONEY=/^(?:0|[1-9]\d{0,10})(?:\.\d{1,2})?$/;
const digits=v=>{
 if(typeof v!=="string"||!MONEY.test(v))fail("VALOR_INVALIDO");
 const [n,d=""]=v.split(".");
 const c=Number(n)*100+Number(d.padEnd(2,"0"));
 if(!Number.isSafeInteger(c)||c<=0)fail("VALOR_INVALIDO");
 return c;
};
const OK={
 SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA:"SIMULAR_CONFIRMACAO",
 REPASSE_INTERNO_CONFIRMADO_MANUALMENTE:"SIMULAR_CORRECAO"
};
export function planejarIntencoesManuaisM517({organizacaoId,empresaId,comandaId,fluxo}={}){
 if(![organizacaoId,empresaId,comandaId].every(x=>typeof x==="string"&&x)||
    !fluxo||fluxo.fase!=="M5_16_FLUXO_OPERACIONAL_READ_ONLY"||
    fluxo.leituraSomente!==true||fluxo.checkoutDisponivel!==false||
    fluxo.integracaoBancaria!==false||!Array.isArray(fluxo.preparacoes))
  fail("CONTEXTO_INVALIDO");
 const ids=new Set();
 const plans=fluxo.preparacoes.map(p=>{
  if(!p||p.empresaId!==empresaId||p.comandaId!==comandaId||
     !p.preparacaoId||ids.has(p.preparacaoId)||
     typeof p.valorLiquido!=="string"||
     typeof p.referenciaExtrato!=="string"||!REF.test(p.referenciaExtrato))
   fail("ESCOPOS_OU_REFERENCIAS_INVALIDOS");
  ids.add(p.preparacaoId);
  if(!["AGUARDANDO_SEGUNDA_CONFERENCIA",
        "SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA",
        "REPASSE_INTERNO_CONFIRMADO_MANUALMENTE",
        "CORRECAO_INTERNA_REGISTRADA"].includes(p.etapa))
   fail("ETAPA_INVALIDA");
  const total=digits(p.valorBruto),
   tarifa=digitsOrZero(p.tarifaCartao),
   antecipacao=digitsOrZero(p.descontoAntecipacao),
   net=digits(p.valorLiquido);
  if(total!==tarifa+antecipacao+net)fail("TOTAIS_DIVERGENTES");
  if(p.etapa==="SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA"&&!p.segundaConferenciaDocumental||
     p.etapa==="REPASSE_INTERNO_CONFIRMADO_MANUALMENTE"&&!p.confirmacaoManualInterna||
     p.etapa==="CORRECAO_INTERNA_REGISTRADA"&&!p.correcaoInterna)
   fail("ESTADO_INCOERENTE");
  // M.5.19: never present a prefilled client command without the exact
  // server-derived financial revision it belongs to.
  const revision=p.revisaoFinanceira;
  if(!revision||typeof revision.codigoRevisao!=="string"||
     !/^[a-f0-9]{64}$/.test(revision.codigoRevisao)||
     revision.contaFinanceiraIdEsperada!==p.contaFinanceiraId||
     revision.valorLiquidoEsperado!==p.valorLiquido||
     revision.lancamentoOriginalIdEsperado!==(p.lancamentoId||null)||
     !/^[a-f0-9]{64}$/.test(revision.fingerprintPreparacaoEsperado||"")||
     (p.segundaConferenciaDocumental!==Boolean(revision.fingerprintParecerEsperado))||
     revision.habilitaConfirmacaoReal!==false||
     revision.habilitaCorrecaoReal!==false)
   fail("REFERENCIA_REVISAO_INVALIDA");
  const expected=gerarReferenciaRevisaoManualM519({
   organizacaoId,empresaId,comandaId,preparacaoId:p.preparacaoId,
   etapa:p.etapa,
   fingerprintPreparacao:revision.fingerprintPreparacaoEsperado,
   fingerprintParecer:revision.fingerprintParecerEsperado,
   contaFinanceiraId:p.contaFinanceiraId,
   valorLiquido:p.valorLiquido,lancamentoOriginalId:p.lancamentoId||null
  });
  if(expected.codigoRevisao!==revision.codigoRevisao)
   fail("REVISAO_DIVERGENTE");
  const action=OK[p.etapa]||null;
  if(action==="SIMULAR_CORRECAO"&&!p.lancamentoId)fail("LANCAMENTO_ORIGINAL_AUSENTE");
  if(p.etapa==="CORRECAO_INTERNA_REGISTRADA"&&!p.lancamentoId)fail("CORRECAO_ORFA");
  return Object.freeze({
   preparacaoId:p.preparacaoId,empresaId,comandaId,
   etapa:p.etapa,operacaoSimulavel:action,
   referenciaExtrato:p.referenciaExtrato,
   valorBruto:p.valorBruto,tarifaCartao:p.tarifaCartao,
   descontoAntecipacao:p.descontoAntecipacao,valorLiquido:p.valorLiquido,
   lancamentoOriginalId:p.lancamentoId||null,
   revisaoFinanceira:revision,
   exigeReferencia:true,exigeConferenciaHumana:true,
   exigeSegundaPessoaParaCorrecao:action==="SIMULAR_CORRECAO",
   comprovacaoAutomaticaBanco:false,liberadoParaGravar:false
  });
 });
 return Object.freeze({
  fase:"M5_17_SIMULACAO_LOCAL",
  organizacaoId,empresaId,comandaId,planos:Object.freeze(plans),
  exigencias:["CONSULTA_EXTERNA_DO_EXTRATO","AUTORIZACAO_FINANCEIRA",
    "CONFERENCIA_INDEPENDENTE_POR_OUTRO_FUNCIONARIO",
    "REVALIDACAO_TRANSACIONAL_NO_SERVIDOR_ANTES_DA_ESCRITA"],
  confirmaDepositoBancarioAutomaticamente:false,
  registroFinanceiroExecutado:false,enviaDadosAoBanco:false,
  permitePostFinanceiro:false,podePublicarCheckout:false,leituraSomente:true
 });
}
function digitsOrZero(raw){
 if(raw==="0.00"||raw==="0"||raw==="0.0")return 0;
 return digits(raw);
}
export function simularIntencaoManualM517({planejamento,preparacaoId,operacao,
 referencia,valorLiquidoInformado,confirmouConsultaExterna,motivo}={}){
 if(planejamento?.fase!=="M5_17_SIMULACAO_LOCAL"||
    planejamento.leituraSomente!==true||
    planejamento.permitePostFinanceiro!==false||
    !Array.isArray(planejamento.planos))
  fail("PLANO_INVALIDO");
 const p=planejamento.planos.find(x=>x.preparacaoId===preparacaoId);
 if(!p||p.operacaoSimulavel!==operacao||
   !["SIMULAR_CONFIRMACAO","SIMULAR_CORRECAO"].includes(operacao))
  fail("OPERACAO_INDISPONIVEL");
 if(confirmouConsultaExterna!==true)fail("CONFIRMACAO_EXTERNA_OBRIGATORIA");
 if(typeof referencia!=="string"||!REF.test(referencia))
  fail("REFERENCIA_INVALIDA");
 if(digits(valorLiquidoInformado)!==digits(p.valorLiquido))
  fail("VALOR_LIQUIDO_DIVERGENTE");
 if(operacao==="SIMULAR_CONFIRMACAO"&&referencia!==p.referenciaExtrato)
  fail("REFERENCIA_REPASSE_DIVERGENTE");
 if(operacao==="SIMULAR_CORRECAO"&&(
  !p.lancamentoOriginalId||referencia===p.referenciaExtrato||
  typeof motivo!=="string"||motivo.trim().length<12||
  motivo.trim().length>500))fail("CORRECAO_JUSTIFICATIVA_INVALIDA");
 return Object.freeze({
  simulacaoValida:true,operacao,preparacaoId,
  empresaId:planejamento.empresaId,comandaId:planejamento.comandaId,
  valorLiquidoConferido:p.valorLiquido,
  referenciaInformada:referencia,
  mensagem:"Conferência simulada localmente, sem salvar. Exige autorização e revalidação do servidor.",
  registrouBanco:false,registrouCaixa:false,
  modificouConciliacaoFinanceira:false,gerouBaixa:false,
  alterouPagamento:false,emitiuFiscal:false,permitePublicarCheckout:false
 });
}
