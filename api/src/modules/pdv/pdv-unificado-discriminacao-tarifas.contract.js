/**
 * PointVet M.5.20 — gross/card-fee/early-discount/net disclosure.
 * Pure read-only reconciliation of authoritative M.5.16 stages.
 * Fees are RETENTIONS REPORTED BY THE OPERATOR, not paid expenses,
 * accounting entries, cash flow or tax withholdings.
 */
const err=code=>{throw Error("M520_"+code);};
const MONEY=/^(?:0|[1-9]\d{0,10})(?:\.\d{1,2})?$/;
function parseAmount(value,positive=false){
 if(typeof value!=="string"||!MONEY.test(value))err("VALOR_INVALIDO");
 const [major,dec=""]=value.split(".");
 const cents=Number(major)*100+Number(dec.padEnd(2,"0"));
 if(!Number.isSafeInteger(cents)||cents<0||(positive&&cents===0))
  err("CENTAVOS_INVALIDOS");
 return cents;
}
const format=n=>Math.trunc(n/100)+"."+String(n%100).padStart(2,"0");
const sum=(a,b)=>{
 if(!Number.isSafeInteger(a+b))err("SOMA_FORA_DOS_LIMITES");
 return a+b;
};
export function discriminarTarifasAntecipacoesM520({
 empresaId,comandaId,fluxo
}={}){
 if(typeof empresaId!=="string"||!empresaId||
    typeof comandaId!=="string"||!comandaId||
    fluxo?.fase!=="M5_16_FLUXO_OPERACIONAL_READ_ONLY"||
    fluxo.leituraSomente!==true||fluxo.integracaoBancaria!==false||
    fluxo.checkoutDisponivel!==false||
    !Array.isArray(fluxo.preparacoes)||fluxo.preparacoes.length>50)
  err("CONTEXTO_INVALIDO");
 const ids=new Set();
 let brutoPreparado=0,taxasPreparadas=0,antecipacoesPreparadas=0,liquidoPreparado=0;
 let brutoAtivo=0,taxasAtivas=0,antecipacoesAtivas=0,liquidoAtivo=0;
 let liquidoEntradas=0,liquidoCorrecoes=0;
 const qtd={aguardando:0,ativo:0,corrigido:0};
 for(const item of fluxo.preparacoes){
  if(!item||!item.preparacaoId||ids.has(item.preparacaoId)||
     item.empresaId!==empresaId||item.comandaId!==comandaId||
     item.revisaoFinanceira?.valorLiquidoEsperado!==item.valorLiquido||
     item.revisaoFinanceira?.etapaRevisada!==item.etapa||
     item.revisaoFinanceira?.habilitaCheckout!==false)
   err("PREPARACAO_INCONSISTENTE");
  ids.add(item.preparacaoId);
  const bruto=parseAmount(item.valorBruto,true);
  const taxa=parseAmount(item.tarifaCartao);
  const antecipacao=parseAmount(item.descontoAntecipacao);
  const liquido=parseAmount(item.valorLiquido,true);
  if(bruto!==taxa+antecipacao+liquido||
     !["REPASSE_NORMAL","ANTECIPACAO"].includes(item.tipo)||
     (item.tipo==="REPASSE_NORMAL"&&antecipacao!==0)||
     (item.tipo==="ANTECIPACAO"&&antecipacao===0))
   err("COMPOSICAO_FINANCEIRA_INVALIDA");
  brutoPreparado=sum(brutoPreparado,bruto);
  taxasPreparadas=sum(taxasPreparadas,taxa);
  antecipacoesPreparadas=sum(antecipacoesPreparadas,antecipacao);
  liquidoPreparado=sum(liquidoPreparado,liquido);
  const pending=["AGUARDANDO_SEGUNDA_CONFERENCIA",
    "SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA"].includes(item.etapa);
  const active=item.etapa==="REPASSE_INTERNO_CONFIRMADO_MANUALMENTE";
  const reversed=item.etapa==="CORRECAO_INTERNA_REGISTRADA";
  if(!pending&&!active&&!reversed)err("ETAPA_DESCONHECIDA");
  if(pending&&(item.confirmacaoManualInterna||item.correcaoInterna||
     item.lancamentoId))err("PENDENTE_COM_MOVIMENTO");
  if(active&&(!item.confirmacaoManualInterna||item.correcaoInterna||
     !item.lancamentoId))err("ENTRADA_INCONSISTENTE");
  if(reversed&&(!item.confirmacaoManualInterna||!item.correcaoInterna||
     !item.lancamentoId))err("CORRECAO_INCONSISTENTE");
  if(pending)qtd.aguardando++;
  if(active||reversed){
   liquidoEntradas=sum(liquidoEntradas,liquido);
   if(reversed){liquidoCorrecoes=sum(liquidoCorrecoes,liquido);qtd.corrigido++;}
   else{
    brutoAtivo=sum(brutoAtivo,bruto);
    taxasAtivas=sum(taxasAtivas,taxa);
    antecipacoesAtivas=sum(antecipacoesAtivas,antecipacao);
    liquidoAtivo=sum(liquidoAtivo,liquido);
    qtd.ativo++;
   }
  }
 }
 if(liquidoEntradas-liquidoCorrecoes!==liquidoAtivo||
    brutoPreparado!==taxasPreparadas+antecipacoesPreparadas+liquidoPreparado||
    brutoAtivo!==taxasAtivas+antecipacoesAtivas+liquidoAtivo)
  err("FECHAMENTO_INCONSISTENTE");
 return Object.freeze({
  fase:"M5_20_DISCRIMINACAO_REPASSES_MANUAIS",
  empresaId,comandaId,
  preparacoes:Object.freeze({
   bruto:format(brutoPreparado),tarifasInformadas:format(taxasPreparadas),
   descontosAntecipacaoInformados:format(antecipacoesPreparadas),
   liquidoPrevisto:format(liquidoPreparado)
  }),
  repassesAtivos:Object.freeze({
   brutoCorrespondente:format(brutoAtivo),
   tarifasInformadas:format(taxasAtivas),
   descontosAntecipacaoInformados:format(antecipacoesAtivas),
   liquidoNoSaldoInterno:format(liquidoAtivo)
  }),
  movimentosInternos:Object.freeze({
   entradasLiquidas:format(liquidoEntradas),
   correcoesLiquidas:format(liquidoCorrecoes),
   efeitoLiquido:format(liquidoEntradas-liquidoCorrecoes)
  }),
  quantidade:Object.freeze(qtd),
  tarifasSaoDespesasPagas:false,antecipacoesSaoDespesasPagas:false,
  creditoBancarioVerificadoAutomaticamente:false,
  receitasNovasReconhecidas:false,
  alteraCaixaOuTitulo:false,alteraSaldoInterno:false,
  geraLancamentoContabil:false,autorizaEstornoReal:false,
  autorizaCheckout:false,leituraSomente:true
 });
}
