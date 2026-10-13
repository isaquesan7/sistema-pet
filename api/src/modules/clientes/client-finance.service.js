/** Client commercial quotes — no cash, fiscal or credit postings. */
import {z} from "zod";
import prisma from "../../config/prisma.js";
const money=z.number().finite().min(0).max(100000000);
export const createSchema=z.object({
 clienteId:z.string().min(1),validade:z.iso.date().nullable().optional(),
 observacoes:z.string().max(4000).nullable().optional(),
 desconto:money.default(0),
 itens:z.array(z.object({petId:z.string().nullable().optional(),descricao:z.string().trim().min(2).max(240),quantidade:z.number().positive().max(100000),valorUnitario:money})).min(1).max(100)
}).strict();
const cents=v=>Math.round(v*100);
const serialized=q=>({...q,subtotal:Number(q.subtotal),desconto:Number(q.desconto),total:Number(q.total),itens:q.itens?.map(i=>({...i,quantidade:Number(i.quantidade),valorUnitario:Number(i.valorUnitario),total:Number(i.total)}))});
async function assertTenant(tx,org,empresa,cliente,petIds=[]){
 const c=await tx.cliente.findFirst({where:{id:cliente,organizacaoId:org},select:{id:true}});
 const e=await tx.empresa.findFirst({where:{id:empresa,organizacaoId:org},select:{id:true}});
 if(!c||!e)throw Error("CADASTRO_INVALIDO");
 if(petIds.length){const count=await tx.pet.count({where:{id:{in:petIds},clienteId:cliente,cliente:{organizacaoId:org}}});if(count!==petIds.length)throw Error("PET_INVALIDO");}
}
export async function listQuotes(org,empresa,cliente){
 await assertTenant(prisma,org,empresa,cliente);
 const data=await prisma.orcamentoCliente.findMany({where:{organizacaoId:org,empresaId:empresa,clienteId:cliente},include:{itens:true},orderBy:{createdAt:"desc"},take:100});
 return data.map(serialized);
}
export async function createQuote(org,empresa,input){
 const ids=[...new Set(input.itens.map(i=>i.petId).filter(Boolean))];
 return prisma.$transaction(async tx=>{
  await assertTenant(tx,org,empresa,input.clienteId,ids);
  const rows=input.itens.map(i=>{const totalCents=Math.round(i.quantidade*cents(i.valorUnitario));return{petId:i.petId||null,descricao:i.descricao,quantidade:i.quantidade,valorUnitario:(cents(i.valorUnitario)/100).toFixed(2),total:(totalCents/100).toFixed(2),totalCents};});
  const subtotal=rows.reduce((s,i)=>s+i.totalCents,0),discount=cents(input.desconto);
  if(discount>subtotal)throw Error("DESCONTO_INVALIDO");
  const created=await tx.orcamentoCliente.create({data:{
   organizacaoId:org,empresaId:empresa,clienteId:input.clienteId,
   validade:input.validade?new Date(input.validade+"T12:00:00.000Z"):null,
   observacoes:input.observacoes||null,subtotal:(subtotal/100).toFixed(2),
   desconto:(discount/100).toFixed(2),total:((subtotal-discount)/100).toFixed(2),
   itens:{create:rows.map(({totalCents,...row})=>row)}
  },include:{itens:true}});
  return serialized(created);
 });
}
export async function setQuoteStatus(org,empresa,cliente,id,status){
 return prisma.$transaction(async tx=>{
  const quote=await tx.orcamentoCliente.findFirst({where:{id,organizacaoId:org,empresaId:empresa,clienteId:cliente}});
  if(!quote)throw Error("ORCAMENTO_NAO_ENCONTRADO");
  if(!["RASCUNHO","ENVIADO"].includes(quote.status))throw Error("ORCAMENTO_FECHADO");
  if(quote.validade&&quote.validade.getTime()<new Date(new Date().toISOString().slice(0,10)+"T00:00:00Z").getTime()&&status==="APROVADO")throw Error("ORCAMENTO_EXPIRADO");
  const update=await tx.orcamentoCliente.updateMany({where:{id,organizacaoId:org,empresaId:empresa,clienteId:cliente,status:quote.status},data:{status,aprovadoEm:status==="APROVADO"?new Date():null}});
  if(update.count!==1)throw Error("ORCAMENTO_FECHADO");
  return serialized(await tx.orcamentoCliente.findUnique({where:{id},include:{itens:true}}));
 });
}
/** Credit is read-only until explicit payment confirmation and PDV integration exist. */
export async function creditLedger(org,empresa,cliente){
 await assertTenant(prisma,org,empresa,cliente);
 const rows=await prisma.creditoClienteMovimento.findMany({where:{organizacaoId:org,empresaId:empresa,clienteId:cliente},orderBy:[{createdAt:"desc"},{id:"desc"}],take:200});
 const all=await prisma.creditoClienteMovimento.findMany({where:{organizacaoId:org,empresaId:empresa,clienteId:cliente},select:{tipo:true,valor:true}});
 const saldo=all.reduce((acc,m)=>acc+(m.tipo==="ENTRADA"?1:-1)*Number(m.valor),0);
 return {saldo:Math.round(saldo*100)/100,movimentos:rows.map(x=>({...x,valor:Number(x.valor)})),lancamentosHabilitados:false};
}
