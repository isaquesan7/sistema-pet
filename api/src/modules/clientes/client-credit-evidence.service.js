/**
 * M.4B.2 — revalidate accounting evidence for every causal prepaid entry.
 * Changes made after original ledger posting invalidate the credit balance.
 * Accounting entries are staff-mediated; NOT direct bank confirmation.
 */
import {valorCreditoCentavos} from "./client-credit-ledger.contract.js";
export async function conferirEvidenciasCreditoAtualizadas(db,rows,{organizacaoId,empresaId,clienteId}){
 const credits=rows.filter(x=>x.tipo==="ENTRADA");
 if(!credits.length)return {valido:true,motivo:null};
 const ids=credits.map(x=>x.conciliacaoId).filter(Boolean);
 if(ids.length!==credits.length||new Set(ids).size!==ids.length)
  return {valido:false,motivo:"COMPROVACAO_CONTABIL_DIVERGENTE"};
 const proofs=await db.conciliacaoFinanceira.findMany({
  where:{id:{in:ids},empresaId,origem:"BAIXA_TITULO",direcao:"ENTRADA"},
  include:{contaFinanceira:true}
 });
 if(proofs.length!==ids.length)return {valido:false,motivo:"COMPROVACAO_CONTABIL_DIVERGENTE"};
 const proofMap=new Map(proofs.map(p=>[p.id,p]));
 const baixas=await db.baixaFinanceira.findMany({
  where:{id:{in:proofs.map(x=>x.origemId)}},include:{titulo:true}
 });
 const baixaMap=new Map(baixas.map(b=>[b.id,b]));
 const duplications=await db.baixaFinanceira.findMany({
  where:{tituloId:{in:[...new Set(baixas.map(x=>x.tituloId))]}},
  select:{tituloId:true,id:true}
 });
 const counts=new Map();
 for(const b of duplications)counts.set(b.tituloId,(counts.get(b.tituloId)||0)+1);
 try{
  for(const mov of credits){
   const proof=proofMap.get(mov.conciliacaoId),baixa=proof&&baixaMap.get(proof.origemId),title=baixa?.titulo;
   const snapshot=mov.evidencia;
   if(!proof||!baixa||!title||!proof.contaFinanceira.ativo||
      proof.contaFinanceira.empresaId!==empresaId||
      proof.contaFinanceiraId!==baixa.contaFinanceiraId||
      proof.contaFinanceiraId!==snapshot?.contaFinanceiraId||
      snapshot?.tipo!=="BAIXA_CONCILIADA_CI"||
      snapshot.conciliacaoId!==proof.id||snapshot.baixaId!==baixa.id||
      snapshot.tituloId!==title.id||snapshot.verificadoPeloBanco!==false||
      mov.referenciaId!==baixa.id||mov.organizacaoId!==organizacaoId||
      mov.empresaId!==empresaId||mov.clienteId!==clienteId||
      title.organizacaoId!==organizacaoId||title.empresaId!==empresaId||
      title.clienteId!==clienteId||title.vendaId||title.pagamentoId||
      title.tipo!=="RECEBER"||title.origem!=="OUTRO"||
      title.status!=="PAGO"||!title.descricao.toUpperCase().startsWith("ADIANTAMENTO CLIENTE")||
      Number(baixa.desconto)!==0||Number(baixa.juros)!==0||
      counts.get(title.id)!==1||
      valorCreditoCentavos(proof.valor)!==valorCreditoCentavos(mov.valor)||
      valorCreditoCentavos(baixa.valor)!==valorCreditoCentavos(mov.valor)||
      valorCreditoCentavos(title.valorOriginal)!==valorCreditoCentavos(mov.valor)||
      valorCreditoCentavos(title.valorPago)!==valorCreditoCentavos(mov.valor)||
      snapshot.valorCentavos!==valorCreditoCentavos(mov.valor))
    return {valido:false,motivo:"COMPROVACAO_CONTABIL_DIVERGENTE"};
  }
 }catch{return {valido:false,motivo:"COMPROVACAO_CONTABIL_DIVERGENTE"};}
 // Outbound refunds must retain distinct live accounting evidence.
 const incomingById=new Map(credits.map(m=>[m.id,m]));
 const refunds=rows.filter(m=>m.tipo==="ESTORNO"&&incomingById.has(m.reverteMovimentoId));
 const seen=new Set();
 for(const m of refunds){
  const e=m.evidencia;
  if(!m.devolucaoConciliacaoId||seen.has(m.devolucaoConciliacaoId)||
     e?.originalId!==m.reverteMovimentoId||
     e?.devolucaoExternaDeclarada!==true||
     e?.devolucaoConciliacaoId!==m.devolucaoConciliacaoId)
   return {valido:false,motivo:"COMPROVACAO_DEVOLUCAO_DIVERGENTE"};
  seen.add(m.devolucaoConciliacaoId);
  try{
   const p=await obterConciliacaoDevolucaoContabil(db,{
    devolucaoConciliacaoId:m.devolucaoConciliacaoId,
    organizacaoId,empresaId,clienteId,
    valorCentavos:valorCreditoCentavos(m.valor)
   });
   if(e.devolucaoBaixaId!==p.devolucaoBaixaId||
      e.devolucaoTituloId!==p.devolucaoTituloId||
      e.contaFinanceiraId!==p.contaFinanceiraId||
      e.valorCentavos!==p.valorCentavos||e.verificadoPeloBanco!==false)
    return {valido:false,motivo:"COMPROVACAO_DEVOLUCAO_DIVERGENTE"};
  }catch{return {valido:false,motivo:"COMPROVACAO_DEVOLUCAO_DIVERGENTE"};}
 }
 return {valido:true,motivo:null};
}


/**
 * M.4B.3 — Verify an existing staff-accounted outgoing credit refund.
 * Does not transmit/refund money or independently verify a bank statement.
 */
export async function obterConciliacaoDevolucaoContabil(db,{
 devolucaoConciliacaoId,organizacaoId,empresaId,clienteId,valorCentavos
}){
 if(!devolucaoConciliacaoId)throw Error("M4B3_DEVOLUCAO_SEM_CONCILIACAO");
 const proof=await db.conciliacaoFinanceira.findFirst({where:{
  id:devolucaoConciliacaoId,empresaId,origem:"BAIXA_TITULO",direcao:"SAIDA"
 },include:{contaFinanceira:true}});
 if(!proof||!proof.contaFinanceira?.ativo||proof.contaFinanceira.empresaId!==empresaId)
  throw Error("M4B3_DEVOLUCAO_SEM_CONCILIACAO");
 const baixa=await db.baixaFinanceira.findUnique({
  where:{id:proof.origemId},include:{titulo:true}
 });
 const titulo=baixa?.titulo;
 if(!baixa||!titulo||baixa.contaFinanceiraId!==proof.contaFinanceiraId||
    titulo.organizacaoId!==organizacaoId||titulo.empresaId!==empresaId||
    titulo.clienteId!==clienteId||titulo.fornecedorId||titulo.vendaId||
    titulo.pagamentoId||titulo.tipo!=="PAGAR"||titulo.origem!=="OUTRO"||
    titulo.status!=="PAGO"||
    !titulo.descricao.toUpperCase().startsWith("DEVOLUCAO ADIANTAMENTO CLIENTE"))
  throw Error("M4B3_TITULO_DEVOLUCAO_INVALIDO");
 const count=await db.baixaFinanceira.count({where:{tituloId:titulo.id}});
 try{
  const amount=valorCreditoCentavos(baixa.valor);
  if(count!==1||amount!==valorCentavos||
     valorCreditoCentavos(proof.valor)!==amount||
     valorCreditoCentavos(titulo.valorOriginal)!==amount||
     valorCreditoCentavos(titulo.valorPago)!==amount||
     Number(baixa.desconto)!==0||Number(baixa.juros)!==0)
   throw Error("M4B3_VALOR_DEVOLUCAO_DIVERGENTE");
 }catch{throw Error("M4B3_VALOR_DEVOLUCAO_DIVERGENTE");}
 return {
  devolucaoConciliacaoId:proof.id,devolucaoBaixaId:baixa.id,
  devolucaoTituloId:titulo.id,contaFinanceiraId:proof.contaFinanceiraId,
  valorCentavos,verificadoPeloBanco:false
 };
}
