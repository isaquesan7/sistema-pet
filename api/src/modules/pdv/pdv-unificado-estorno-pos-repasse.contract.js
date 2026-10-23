/**
 * PointVet M.5.21 — PREVIEW of customer refunds AFTER a manually posted card repasse.
 * A customer's actual reimbursement is NOT M.5.14 internal-ledger correction.
 * No bank, fiscal, ledger, PSP, payment or receivable mutation is performed.
 * Any fee/anticipation recovery below is explicitly hypothetical and UNVERIFIED.
 */
const fail=code=>{throw Error("M521_"+code);};
const SHA=/^[a-f0-9]{64}$/;
const CASH=/^(?:0|[1-9]\d{0,10})\.\d{2}$/;
function cents(v,positive=false){
 if(typeof v!=="string"||!CASH.test(v))fail("VALOR_INVALIDO");
 const [whole,fract]=v.split(".");
 const result=Number(whole)*100+Number(fract);
 if(!Number.isSafeInteger(result)||result<0||(positive&&result===0))
  fail("CENTAVOS_INVALIDOS");
 return result;
}
const fmt=v=>Math.floor(v/100)+"."+String(v%100).padStart(2,"0");
const safe=(a,b)=>{
 const c=a+b;
 if(!Number.isSafeInteger(c))fail("TOTAL_EXCEDE_LIMITE");
 return c;
};
export function planejarDevolucaoAposRepasseM521({
 organizacaoId,empresaId,comandaId,fluxo
}={}){
 if(![organizacaoId,empresaId,comandaId].every(v=>typeof v==="string"&&v)||
    fluxo?.fase!=="M5_16_FLUXO_OPERACIONAL_READ_ONLY"||
    fluxo?.leituraSomente!==true||fluxo?.integracaoBancaria!==false||
    fluxo?.checkoutDisponivel!==false||
    !Array.isArray(fluxo.preparacoes)||fluxo.preparacoes.length>50)
  fail("CONTEXTO_INVALIDO");
 const seen=new Set();
 const preparacoes=fluxo.preparacoes.map(p=>{
  if(!p||typeof p.preparacaoId!=="string"||!p.preparacaoId||
     seen.has(p.preparacaoId)||p.empresaId!==empresaId||
     p.comandaId!==comandaId||
     !SHA.test(p.revisaoFinanceira?.codigoRevisao||"")||
     p.revisaoFinanceira?.valorLiquidoEsperado!==p.valorLiquido||
     p.revisaoFinanceira?.etapaRevisada!==p.etapa||
     p.revisaoFinanceira?.habilitaCheckout!==false)
   fail("PREPARACAO_OU_REVISAO_INVALIDA");
  seen.add(p.preparacaoId);
  const bruto=cents(p.valorBruto,true),tarifa=cents(p.tarifaCartao);
  const antecipacao=cents(p.descontoAntecipacao);
  const liquido=cents(p.valorLiquido,true);
  if(bruto!==safe(safe(tarifa,antecipacao),liquido)||
     !["REPASSE_NORMAL","ANTECIPACAO"].includes(p.tipo)||
     (p.tipo==="REPASSE_NORMAL"&&antecipacao!==0)||
     (p.tipo==="ANTECIPACAO"&&antecipacao===0))
   fail("COMPOSICAO_INCONSISTENTE");
  const active=p.etapa==="REPASSE_INTERNO_CONFIRMADO_MANUALMENTE";
  const corrected=p.etapa==="CORRECAO_INTERNA_REGISTRADA";
  const pending=["AGUARDANDO_SEGUNDA_CONFERENCIA",
   "SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA"].includes(p.etapa);
  if(!active&&!corrected&&!pending||
     active&&(!p.confirmacaoManualInterna||p.correcaoInterna||!p.lancamentoId)||
     corrected&&(!p.confirmacaoManualInterna||!p.correcaoInterna||!p.lancamentoId)||
     pending&&(p.confirmacaoManualInterna||p.correcaoInterna||p.lancamentoId))
   fail("ETAPA_INVALIDA");
  return Object.freeze({
   preparacaoId:p.preparacaoId,empresaId,comandaId,
   codigoRevisao:p.revisaoFinanceira.codigoRevisao,
   valorBruto:fmt(bruto),tarifaInformada:fmt(tarifa),
   descontoAntecipacaoInformado:fmt(antecipacao),valorLiquido:fmt(liquido),
   referenciaExtrato:p.referenciaExtrato,
   status:active?"REPASSE_INTERNO_ATIVO":
     corrected?"CORRECAO_INTERNA_JA_REGISTRADA":"REPASSE_AINDA_NAO_CONFIRMADO",
   podeSimularDevolucao:active,
   // THIS IS NOT A SECOND KIND OF M.5.14 COMPENSATION.
   contralancamentoM514EquivaleAReembolso:false,
   devolucaoAnteriorExternaFoiVerificada:false
  });
 });
 return Object.freeze({
  fase:"M5_21_DEVOLUCAO_APOS_REPASSE_PREVIA",
  organizacaoId,empresaId,comandaId,
  preparacoes:Object.freeze(preparacoes),
  politicaRecuperacaoDeTaxas:"NAO_HOMOLOGADA",
  possuiComprovacaoDeDevolucoesPrevias:false,
  permiteBaixaFinanceira:false,permiteEstornoAutomatico:false,
  alteraConta:false,emiteDocumentoFiscal:false,
  consultaBanco:false,leituraSomente:true
 });
}
export function simularDevolucaoAposRepasseM521({
 plano,preparacaoId,codigoRevisaoVisto,valorBrutoDevolucaoProposto,
 recuperacaoTarifaHipotetica="0.00",
 recuperacaoAntecipacaoHipotetica="0.00",
 confirmouValoresSaoHipoteses=false
}={}){
 if(plano?.fase!=="M5_21_DEVOLUCAO_APOS_REPASSE_PREVIA"||
    plano.leituraSomente!==true||plano.permiteEstornoAutomatico!==false||
    !Array.isArray(plano.preparacoes)||!SHA.test(codigoRevisaoVisto||""))
  fail("PLANO_INVALIDO");
 const rows=plano.preparacoes.filter(p=>p.preparacaoId===preparacaoId);
 if(rows.length!==1||!rows[0].podeSimularDevolucao||
    rows[0].status!=="REPASSE_INTERNO_ATIVO")
  fail("REPASSE_NAO_ELEGIVEL");
 const item=rows[0];
 if(item.empresaId!==plano.empresaId||item.comandaId!==plano.comandaId||
    item.codigoRevisao!==codigoRevisaoVisto)
  fail("REVISAO_OU_ESCOPO_DESATUALIZADO");
 if(confirmouValoresSaoHipoteses!==true)
  fail("DECLARACAO_PREMISSAS_OBRIGATORIA");
 const bruto=cents(item.valorBruto,true);
 const devolucao=cents(valorBrutoDevolucaoProposto,true);
 const tarifa=cents(item.tarifaInformada);
 const antecipacao=cents(item.descontoAntecipacaoInformado);
 const recuperacaoTarifa=cents(recuperacaoTarifaHipotetica);
 const recuperacaoAntecipacao=cents(recuperacaoAntecipacaoHipotetica);
 const recuperacoes=safe(recuperacaoTarifa,recuperacaoAntecipacao);
 if(devolucao>bruto||recuperacaoTarifa>tarifa||
    recuperacaoAntecipacao>antecipacao||recuperacoes>devolucao)
  fail("VALORES_ACIMA_DO_LIMITE");
 return Object.freeze({
  fase:"M5_21_DEVOLUCAO_SIMULADA_NAO_EXECUTADA",
  empresaId:item.empresaId,comandaId:item.comandaId,
  preparacaoId,codigoRevisaoVisto,
  modalidade:devolucao===bruto?"INTEGRAL_HIPOTETICA":"PARCIAL_HIPOTETICA",
  valorBrutoAssociado:item.valorBruto,valorLiquidoOriginal:item.valorLiquido,
  saidaAoClienteHipotetica:fmt(devolucao),
  tarifaOriginalInformada:item.tarifaInformada,
  antecipacaoOriginalInformada:item.descontoAntecipacaoInformado,
  retornoHipoteticoDeTarifa:fmt(recuperacaoTarifa),
  retornoHipoteticoDeAntecipacao:fmt(recuperacaoAntecipacao),
  exposicaoHipoteticaSeRecuperacoesOcorrerem:fmt(devolucao-recuperacoes),
  // The banking institution may charge extra reversal fees or return none.
  custoExternoAdicionalNaoEstimado:true,
  comprovanteDeDevolucaoExternaValidado:false,
  recuperacoesEfetivamenteRecebidas:false,
  contemplaDevolucoesAnteriores:false,
  precisaPoliticaContabilFiscal:true,
  exigeNovaConferenciaAntesDeQualquerEscrita:true,
  alterouPagamento:false,alterouVenda:false,alterouSaldoInterno:false,
  executouReembolso:false,registrouDespesa:false,
  emitiuNotaDeEstorno:false,gerouConciliacao:false,
  integracaoBancaria:false,autorizaCheckout:false
 });
}
