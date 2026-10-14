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
 return {valido:true,motivo:null};
}
