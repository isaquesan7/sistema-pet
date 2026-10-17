/**
 * PointVet M.3A — plano PURO para fechamento manual multiempresa.
 * Sem I/O, sem pagamento, estoque, caixa, fiscal, integração PSP ou liberação HTTP.
 * Uma declaração de cartão aprovada fora do sistema gera intenção de
 * RECEBÍVEL PENDENTE, jamais uma conciliação ou saldo bancário presumido.
 */
import {createHash} from "node:crypto";
const FORMAS=new Set(["DINHEIRO","PIX","CARTAO_DEBITO","CARTAO_CREDITO","TRANSFERENCIA"]);
/** M.5.40: repetição limitada APENAS para abortos de transação do PostgreSQL. */
export async function executarComRetrySerializableM540(executar,{tentativas=3}={}){
 if(typeof executar!=="function"||!Number.isInteger(tentativas)||tentativas<1||tentativas>3)
  throw Error("M3_RETRY_INVALIDO");
 for(let tentativa=1;tentativa<=tentativas;tentativa++){
  try{return await executar();}
  catch(erro){
   // P2034: conflito/deadlock na transação Prisma. Consultas SQL de lock
   // ($queryRaw) podem expor o mesmo aborto como P2010 + SQLSTATE 40001/40P01.
   // Never retry stock shortages, validation, authorizations or unknown failures.
   const rawSqlState=erro?.meta?.code??erro?.meta?.driverAdapterError?.cause?.originalCode;
   // Prisma 7/driver pg pode omitir SQLSTATE em meta, mas conserva
   // "Raw query failed. Code: `40001`." na mensagem emitida pelo driver.
   const rawSerializavel=erro?.code==="P2010"&&(
    ["40001","40P01"].includes(rawSqlState)||
    /Raw query failed\. Code: `(40001|40P01)`\./.test(String(erro.message)));
   const transacaoAbortada=erro?.code==="P2034"||rawSerializavel;
   if(!transacaoAbortada||tentativa===tentativas)throw erro;
  }
 }
}
export function centavosExatos(valor){
 const s=String(valor);
 if(!/^(?:0|[1-9]\d{0,10})(?:\.\d{1,2})?$/.test(s))throw Error("M3_VALOR_INVALIDO");
 const [inteiro,fracao=""]=s.split(".");
 const v=Number(inteiro)*100+Number(fracao.padEnd(2,"0"));
 if(!Number.isSafeInteger(v)||v<=0)throw Error("M3_VALOR_INVALIDO");
 return v;
}
export function distribuirParcelasCentavos(total,quantidade){
 if(!Number.isSafeInteger(total)||total<=0||!Number.isInteger(quantidade)||
   quantidade<1||quantidade>24||total<quantidade)throw Error("M3_PARCELAMENTO_INVALIDO");
 const base=Math.floor(total/quantidade),resto=total%quantidade;
 return Array.from({length:quantidade},(_,i)=>({
  numero:i+1,totalParcelas:quantidade,valorCentavos:base+(i<resto?1:0),
  status:"AGUARDANDO_REPASSE",vencimentoEm:null,conciliadoEm:null
 }));
}
/** Returns a deterministic plan for a future SERIALIZABLE transaction. */
export function planejarEfetivacaoManualUnificada({reserva,snapshot,registro,operacoes,vendas}){
 if(!reserva||reserva.status!=="RESERVADA"||!registro||registro.status!=="REGISTRADO"||
    registro.reservaId!==reserva.id||!snapshot||
    snapshot.comandaId!==reserva.comandaId||
    snapshot.versaoRascunho!==reserva.versao||
    !Array.isArray(snapshot.operacoes)||!snapshot.operacoes.length||
    !Array.isArray(operacoes)||!Array.isArray(vendas)||!Array.isArray(registro.linhas))
  throw Error("M3_PREPARACAO_INVALIDA");
 const byEmpresa=new Map(),byVenda=new Map(vendas.map(v=>[v.id,v]));
 for(const op of operacoes){
  if(byEmpresa.has(op.empresaId)||op.reservaId!==reserva.id||
     op.status!=="VENDA_RASCUNHO"||!op.vendaId)throw Error("M3_OPERACAO_INVALIDA");
  byEmpresa.set(op.empresaId,op);
 }
 if(byEmpresa.size!==snapshot.operacoes.length||vendas.length!==byEmpresa.size)
  throw Error("M3_OPERACAO_INVALIDA");
 const used=new Set(),saida=[];
 for(const snap of [...snapshot.operacoes].sort((a,b)=>a.empresaId.localeCompare(b.empresaId))){
  const operacao=byEmpresa.get(snap.empresaId),venda=operacao&&byVenda.get(operacao.vendaId);
  if(!operacao||operacao.chaveIdempotencia!==snap.chaveIdempotencia||
     !venda||venda.comandaId!==snapshot.comandaId||venda.empresaId!==snap.empresaId||
     venda.status!=="ABERTA"||centavosExatos(venda.valorTotal)!==centavosExatos(snap.total)||
     centavosExatos(operacao.valorTotal)!==centavosExatos(snap.total)||
     !snap.sessaoCaixaId||!Array.isArray(snap.itens)||!snap.itens.length)
   throw Error("M3_VENDA_OU_VALOR_DIVERGENTE");
  const linhas=registro.linhas.filter(l=>l.operacaoId===operacao.id).sort((a,b)=>a.indice-b.indice);
  if(!linhas.length)throw Error("M3_PAGAMENTO_INCOMPLETO");
  let soma=0;
  const pagamentos=linhas.map((l,index)=>{
   if(l.indice!==index||used.has(l.id)||l.pagamentoId||
      l.sessaoCaixaId!==snap.sessaoCaixaId||!FORMAS.has(l.forma)||
      !l.confirmadoEm||!Number.isInteger(l.parcelas)||l.parcelas<1||l.parcelas>24||
      (l.forma!=="CARTAO_CREDITO"&&l.parcelas!==1))
    throw Error("M3_LINHA_INVALIDA");
   used.add(l.id);
   const valorCentavos=centavosExatos(l.valor);soma+=valorCentavos;
   const parcelas=l.forma==="CARTAO_CREDITO"?distribuirParcelasCentavos(valorCentavos,l.parcelas):[];
   return {linhaId:l.id,empresaId:snap.empresaId,vendaId:venda.id,forma:l.forma,
    sessaoCaixaId:l.sessaoCaixaId,valorCentavos,numeroParcelas:l.parcelas,
    statusPagamento:parcelas.length?"PENDENTE":"APROVADO",
    saldoBancarioDisponivel:false,parcelasAReceber:parcelas,
    // Fechar caixa legado já soma Pagamento(DINHEIRO, APROVADO).
    // Uma movimentação RECEBIMENTO ou SUPRIMENTO duplicaria o valor esperado.
    movimentoCaixaSomenteAuditoria:l.forma==="DINHEIRO"?"VENDA":null};
  });
  if(soma!==centavosExatos(snap.total))throw Error("M3_PAGAMENTO_DIVERGENTE");
  saida.push({empresaId:snap.empresaId,cnpj:snap.cnpj,operacaoId:operacao.id,
   vendaId:venda.id,valorCentavos:soma,pagamentos,itens:snap.itens});
 }
 if(used.size!==registro.linhas.length)throw Error("M3_LINHA_ORFA_OU_DUPLICADA");
 if(saida.reduce((s,o)=>s+o.valorCentavos,0)!==centavosExatos(snapshot.total))
  throw Error("M3_TOTAL_DIVERGENTE");
 const dados={reservaId:reserva.id,registroId:registro.id,registroFingerprint:registro.fingerprint,
  operacoes:saida};
 const fingerprint=createHash("sha256").update(JSON.stringify(dados)).digest("hex");
 return {fingerprint,...dados,podeEfetivarAgora:false,
  motivo:"M3A_CONTRATO_ESTRUTURAL_SEM_ORQUESTRACAO",
  fiscalGerado:false,estoqueMovimentado:false,pagamentoPersistido:false};
}
