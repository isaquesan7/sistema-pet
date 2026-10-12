/**
 * PointVet 18.2: platform SaaS commercial metrics, read only.
 * Contracted MRR/ARR are not cash receipts. Cash uses paid invoice records only.
 */
import prisma from "../../config/prisma.js";

export async function financialIndicators(req,res,next){
 try{
  const [subscriptions,invoices]=await Promise.all([
   prisma.assinaturaSaaS.findMany({
    select:{status:true,ciclo:true,plano:{select:{precoMensal:true,precoAnual:true}}},
   }),
   prisma.faturaSaaS.findMany({
    select:{status:true,valor:true,pagoEm:true,vencimento:true},
    where:{status:{in:["PAGA","PENDENTE","VENCIDA"]}}
   })
  ]);
  const cents=x=>Math.round(Number(x||0)*100);
  // Convert annual contractual value into monthly equivalent using one annual price.
  // Plans without annual price are displayed as zero rather than invented revenue.
  let mrrCents=0;
  const counts={TRIAL:0,ATIVA:0,INADIMPLENTE:0,SUSPENSA:0,CANCELADA:0};
  for(const s of subscriptions){
   if(Object.hasOwn(counts,s.status))counts[s.status]++;
   if(s.status==="ATIVA"){
    const plan=s.plano;
    mrrCents+=s.ciclo==="ANUAL"?Math.round(cents(plan?.precoAnual)/12):cents(plan?.precoMensal);
   }
  }
  let receivedCents=0,pendingCents=0,overdueCents=0;
  const byMonth=new Map();
  const today=new Date().toISOString().slice(0,10);
  for(const f of invoices){
   const value=cents(f.valor);
   if(f.status==="PAGA"&&f.pagoEm){
    receivedCents+=value;
    const month=new Date(f.pagoEm).toISOString().slice(0,7);
    byMonth.set(month,(byMonth.get(month)||0)+value);
   }else if(f.status==="VENCIDA"||(f.status==="PENDENTE"&&f.vencimento&&new Date(f.vencimento).toISOString().slice(0,10)<today)){
    overdueCents+=value;
   }else if(f.status==="PENDENTE")pendingCents+=value;
  }
  const monthlyReceipts=[...byMonth.entries()].sort(([a],[b])=>a.localeCompare(b)).slice(-12).map(([month,value])=>({month,value:value/100}));
  res.set("Cache-Control","no-store");
  return res.json({success:true,dados:{
   mrrContratado:mrrCents/100,arrContratado:mrrCents*12/100,
   assinaturas:counts,recebidoHistorico:receivedCents/100,
   pendente:pendingCents/100,vencido:overdueCents/100,
   recebimentosMensais:monthlyReceipts,
   nota:"MRR/ARR são projeções contratuais de assinaturas ATIVA; recebimentos consideram somente faturas PAGA com pagoEm. Não equivalem a extrato bancário."
  }});
 }catch(error){next(error);}
}
