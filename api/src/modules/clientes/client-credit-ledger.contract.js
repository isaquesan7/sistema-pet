/**
 * M.4B.2 — pure causal prepaid credit accounting. No payment/PSP integration.
 * Historical entries without reconciliation metadata fail closed.
 * A reversal has the OPPOSITE sign of its single referenced movement.
 */
export function valorCreditoCentavos(value){
 const t=String(value);
 if(!/^(0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(t))throw Error("M4B2_VALOR_INVALIDO");
 const [whole,fraction=""]=t.split(".");
 const n=Number(whole)*100+Number(fraction.padEnd(2,"0"));
 if(!Number.isSafeInteger(n)||n<=0)throw Error("M4B2_VALOR_INVALIDO");
 return n;
}
export function checarRazaoCreditoCausal(movimentos=[]){
 const byId=new Map(movimentos.map(m=>[m.id,m]));
 if(byId.size!==movimentos.length)return {saldoCentavos:null,saldoConfiavel:false,motivo:"RAZAO_DUPLICADA"};
 const reversed=new Set();let total=0;
 for(const m of movimentos){
  const valor=valorCreditoCentavos(m.valor);
  if(m.tipo==="ESTORNO"&&!m.reverteMovimentoId)
   return {saldoCentavos:null,saldoConfiavel:false,motivo:"ESTORNO_SEM_VINCULO_ORIGINAL"};
  if(!m.solicitacaoFingerprint||!m.idempotencia||!m.responsavelId)
   return {saldoCentavos:null,saldoConfiavel:false,motivo:"RAZAO_HISTORICO_NAO_HOMOLOGADO"};
  if(m.tipo==="ENTRADA"){
   if(!m.conciliacaoId||m.reverteMovimentoId||m.evidencia?.tipo!=="BAIXA_CONCILIADA_CI")
    return {saldoCentavos:null,saldoConfiavel:false,motivo:"ORIGEM_NAO_COMPROVADA"};
   total+=valor;
  }else if(m.tipo==="UTILIZACAO"){
   // Only CI simulation; must NEVER become a checkout payment from this contract.
   if(m.conciliacaoId||m.reverteMovimentoId||m.evidencia?.tipo!=="DEBITO_SIMULADO_CI")
    return {saldoCentavos:null,saldoConfiavel:false,motivo:"UTILIZACAO_NAO_HOMOLOGADA"};
   total-=valor;
  }else if(m.tipo==="ESTORNO"){
   const original=byId.get(m.reverteMovimentoId);
   if(!original||original.id===m.id||original.tipo==="ESTORNO"||
      original.empresaId!==m.empresaId||original.clienteId!==m.clienteId||
      original.organizacaoId!==m.organizacaoId||valor!==valorCreditoCentavos(original.valor)||
      m.conciliacaoId||m.evidencia?.tipo!=="ESTORNO_CAUSAL_CI"||
      reversed.has(original.id))
    return {saldoCentavos:null,saldoConfiavel:false,motivo:"ESTORNO_CAUSAL_INCONSISTENTE"};
   reversed.add(original.id);
   total+=original.tipo==="ENTRADA"?-valor:valor;
  }else return {saldoCentavos:null,saldoConfiavel:false,motivo:"RAZAO_TIPO_INVALIDO"};
  if(!Number.isSafeInteger(total))
   return {saldoCentavos:null,saldoConfiavel:false,motivo:"RAZAO_PRECISAO_INVALIDA"};
 }
 if(total<0)return {saldoCentavos:null,saldoConfiavel:false,motivo:"RAZAO_SALDO_NEGATIVO"};
 return {saldoCentavos:total,saldoConfiavel:true,motivo:null};
}
