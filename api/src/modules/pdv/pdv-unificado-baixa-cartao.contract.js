/**
 * PointVet M.5.9 — preflight PURO de repasse bancário de cartões.
 * Modela valor bruto, tarifas e antecipação a partir de parcelas já declaradas
 * em M.5.5, sem afirmar verificação independente de extrato nem fazer baixa.
 * NENHUM efeito de caixa, saldo, pagamento, conciliação, fiscal ou emissão.
 */
import {createHash} from "node:crypto";
const erro=(codigo)=>{throw Error("M59_"+codigo);};
const MONEY=/^(?:0|[1-9]\d{0,10})(?:\.\d{1,2})?$/;
const REF=/^[A-Za-z0-9][A-Za-z0-9_./:-]{7,119}$/;
const ID=/^[a-zA-Z0-9_-]{3,100}$/;
const CATEGORIES=new Set(["REPASSE_NORMAL","ANTECIPACAO"]);
const fmt=centavos=>(Math.floor(centavos/100)+"."+String(centavos%100).padStart(2,"0"));
function cents(raw,{positive=false}={}){
 if(typeof raw!=="string"||!MONEY.test(raw))erro("VALOR_INVALIDO");
 const [whole,fraction=""]=raw.split(".");
 const value=Number(whole)*100+Number(fraction.padEnd(2,"0"));
 if(!Number.isSafeInteger(value)||(positive?value<=0:value<0))erro("VALOR_INVALIDO");
 return value;
}
function sum(a,b){
 if(!Number.isSafeInteger(a+b))erro("VALOR_EXCESSIVO");
 return a+b;
}
function validDate(raw){
 if(typeof raw!=="string"||!/^(\d{4})-(\d{2})-(\d{2})$/.test(raw))return false;
 const time=Date.parse(raw+"T00:00:00.000Z");
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===raw;
}
/**
 * The request is a manually declared EXPECTATION, not a bank proof.
 * Requires EXACT parcel membership, company scope and amounts.
 */
export function planejarBaixaCartaoM59({resumo,pedido}={}){
 if(!resumo||resumo.fase!=="M5_6_RESUMO_RECEBIVEIS_CI"||
    resumo.leituraSomente!==true||resumo.provaBancariaIndependente!==false||
    !resumo.organizacaoId||!resumo.empresaId||!resumo.comandaId||
    !Array.isArray(resumo.linhas)||!pedido||typeof pedido!=="object"||
    Array.isArray(pedido))
  erro("CONTEXTO_INVALIDO");
 if(!CATEGORIES.has(pedido.tipo))erro("TIPO_INVALIDO");
 if(pedido.confirmouConferenciaExterna!==true)
  erro("CONFIRMACAO_EXTERNA_OBRIGATORIA");
 if(!ID.test(pedido.contaFinanceiraId||"")||
    !REF.test(pedido.referenciaExtrato||"")||!validDate(pedido.dataCredito))
  erro("REFERENCIA_OU_DATA_INVALIDA");
 if(!Array.isArray(pedido.parcelaIds)||!pedido.parcelaIds.length||
    pedido.parcelaIds.length>24)erro("PARCELAS_INVALIDAS");
 const parcelMap=new Map(),linesSeen=new Set();
 for(const row of resumo.linhas){
  if(!row?.linhaId||linesSeen.has(row.linhaId)||
     row.empresaId!==resumo.empresaId||!Array.isArray(row.parcelas)||
     row.situacao==="ESTORNADO")erro("LINHA_INVALIDA");
  linesSeen.add(row.linhaId);
  for(const p of row.parcelas){
   if(!p?.id||parcelMap.has(p.id))erro("PARCELA_DUPLICADA_NA_ORIGEM");
   parcelMap.set(p.id,{...p,linhaId:row.linhaId});
  }
 }
 const ids=[...pedido.parcelaIds].sort();
 if(new Set(ids).size!==ids.length||ids.some(id=>typeof id!=="string"||!id))
  erro("PARCELAS_DUPLICADAS");
 let bruto=0;
 const parcelas=ids.map(id=>{
  const item=parcelMap.get(id);
  if(!item)erro("PARCELA_OUTRA_EMPRESA_OU_INEXISTENTE");
  // A repasse declaration (M5.5) must exist. Pending installments cannot
  // turn into recognized bank balance solely from this simulation.
  if(item.status!=="CONCILIADA"){
   erro(item.status==="ESTORNADA"?"PARCELA_ESTORNADA":"PARCELA_SEM_DECLARACAO");
  }
  bruto=sum(bruto,cents(item.valor,{positive:true}));
  return Object.freeze({parcelaId:id,linhaId:item.linhaId,valorBruto:item.valor});
 });
 const tarifa=cents(pedido.tarifaCartao);
 const antecipacao=cents(pedido.descontoAntecipacao);
 const declarado=cents(pedido.valorLiquidoDeclarado,{positive:true});
 if(pedido.tipo==="REPASSE_NORMAL"&&antecipacao!==0)
  erro("ANTECIPACAO_EM_REPASSE_NORMAL");
 if(pedido.tipo==="ANTECIPACAO"&&antecipacao===0)
  erro("ANTECIPACAO_SEM_CUSTO_EXPLICITO");
 if(tarifa+antecipacao>=bruto||bruto-tarifa-antecipacao!==declarado)
  erro("CONCILIACAO_VALORES_DIVERGENTES");
 const idempotencyData={
  fase:"M5_9_PREVIA_REPASSE_CARTAO",organizacaoId:resumo.organizacaoId,
  empresaId:resumo.empresaId,comandaId:resumo.comandaId,
  tipo:pedido.tipo,contaFinanceiraId:pedido.contaFinanceiraId,
  referenciaExtrato:pedido.referenciaExtrato,dataCredito:pedido.dataCredito,
  parcelaIds:ids,valorBrutoCentavos:bruto,tarifaCartaoCentavos:tarifa,
  descontoAntecipacaoCentavos:antecipacao,valorLiquidoCentavos:declarado
 };
 const fingerprint=createHash("sha256").update(JSON.stringify(idempotencyData)).digest("hex");
 return Object.freeze({
  fase:idempotencyData.fase,fingerprint,organizacaoId:resumo.organizacaoId,
  empresaId:resumo.empresaId,comandaId:resumo.comandaId,
  tipo:pedido.tipo,referenciaExtrato:pedido.referenciaExtrato,
  contaFinanceiraId:pedido.contaFinanceiraId,dataCredito:pedido.dataCredito,
  parcelas:Object.freeze(parcelas),
  valores:Object.freeze({bruto:fmt(bruto),tarifaCartao:fmt(tarifa),
   descontoAntecipacao:fmt(antecipacao),liquidoDeclarado:fmt(declarado)}),
  declaracaoExternaInformada:true,verificacaoBancariaIndependente:false,
  apenasSimulacao:true,baixaRealExecutada:false,registrarTitulo:false,
  aprovarPagamento:false,alterarSaldoBancario:false,gerarCaixa:false,
  registrarConciliacaoFinanceira:false,permitirEstornoAutomatico:false,
  emitirFiscal:false,autorizarProducao:false
 });
}
