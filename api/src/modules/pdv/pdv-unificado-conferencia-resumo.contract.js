/**
 * PointVet M.5.15 — conciliação MANUAL, apenas apresentação.
 * Valores na UI expressam somente o efeito no saldo INTERNO do PointVet,
 * nunca saldo confirmado por banco, nova receita nem autorização de checkout.
 * Fail-closed: recusa movimento órfão, correção parcial, repetição e mistura CNPJ.
 */
const fail=(reason)=>{throw Error("M515_"+reason);};
const MONEY=/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;
function cents(raw){
 if(typeof raw!=="string"||!MONEY.test(raw))fail("VALOR_INVALIDO");
 const [int,dec=""]=raw.split(".");
 const value=Number(int)*100+Number(dec.padEnd(2,"0"));
 if(!Number.isSafeInteger(value)||value<=0)fail("VALOR_INVALIDO");
 return value;
}
const fixed=value=>Math.floor(value/100)+"."+String(value%100).padStart(2,"0");
const safeSum=(a,b)=>{
 if(!Number.isSafeInteger(a+b))fail("SOMA_FORA_DOS_LIMITES");
 return a+b;
};
export function resumirMovimentosManuaisM515({empresaId,comandaId,movimentos}={}){
 if(typeof empresaId!=="string"||!empresaId||
    typeof comandaId!=="string"||!comandaId||
    !Array.isArray(movimentos)||movimentos.length>100)
  fail("CONTEXTO_INVALIDO");
 const originalById=new Map(),corrigido=new Set(),ids=new Set();
 let entradas=0,correcoes=0;
 for(const row of movimentos){
  if(!row||typeof row.id!=="string"||!row.id||ids.has(row.id)||
     row.empresaId!==empresaId||row.comandaId!==comandaId)
   fail("MOVIMENTO_OU_ESCOPO_INVALIDO");
  ids.add(row.id);
  if(row.tipo==="REPASSE_CONFIRMADO_MANUALMENTE"){
   if(row.direcao!=="ENTRADA"||!row.preparacaoId||!row.contaFinanceiraId||
      typeof row.possuiCorrecao!=="boolean")
    fail("ENTRADA_INVALIDA");
   const valor=cents(row.valor);
   originalById.set(row.id,{valor,preparacaoId:row.preparacaoId,
    contaFinanceiraId:row.contaFinanceiraId,possuiCorrecao:row.possuiCorrecao});
   entradas=safeSum(entradas,valor);
  }else if(row.tipo!=="CORRECAO_MANUAL")fail("TIPO_DESCONHECIDO");
 }
 for(const row of movimentos){
  if(row.tipo!=="CORRECAO_MANUAL")continue;
  if(row.direcao!=="SAIDA"||!row.origemLancamentoId||
     !row.contaFinanceiraId||row.possuiCorrecao!==false)
   fail("CORRECAO_INVALIDA");
  const origin=originalById.get(row.origemLancamentoId);
  if(!origin||corrigido.has(row.origemLancamentoId)||
     origin.preparacaoId!==row.preparacaoId||
     origin.contaFinanceiraId!==row.contaFinanceiraId||
     !origin.possuiCorrecao||
     cents(row.valor)!==origin.valor)
   fail("CORRECAO_DIVERGENTE");
  corrigido.add(row.origemLancamentoId);
  correcoes=safeSum(correcoes,origin.valor);
 }
 for(const [id,origin] of originalById){
  if(origin.possuiCorrecao!==corrigido.has(id))
   fail("SINALIZACAO_INCONSISTENTE");
 }
 if(correcoes>entradas)fail("SALDO_INCONSISTENTE");
 return Object.freeze({
  fase:"M5_15_CONFERENCIA_MANUAL_READ_ONLY",
  empresaId,comandaId,quantidadeEntradas:originalById.size,
  quantidadeCorrecoes:corrigido.size,entradaLiquidaDeclarada:fixed(entradas),
  correcoesLiquidas:fixed(correcoes),
  efeitoLiquidoNoSaldoInterno:fixed(entradas-correcoes),
  // These figures DO NOT represent the customer's gross purchase
  // or the organization's total bank/financial balance.
  ehSaldoBancarioReal:false,ehReceitaNova:false,
  confirmacaoAutomaticaBanco:false,
  atualizarConta:false,executarCheckout:false,
  podeConfirmarPelaInterface:false,podeCorrigirPelaInterface:false,
  leituraSomente:true
 });
}
