/** Client commercial quotes — no cash, fiscal or credit postings. */
import {z} from "zod";
import prisma from "../../config/prisma.js";
const money=z.number().finite().min(0).max(100000000).refine(v=>Math.abs(v*100-Math.round(v*100))<1e-6&&Number.isSafeInteger(Math.round(v*100)),{message:"MOEDA_CENTAVOS_INVALIDOS"});
const quantity=z.number().positive().max(100000).refine(v=>Math.abs(v*1000-Math.round(v*1000))<1e-6,{message:"QUANTIDADE_MILESIMOS_INVALIDA"});
export const createSchema=z.object({
 clienteId:z.string().min(1),validade:z.iso.date().nullable().optional(),
 observacoes:z.string().max(4000).nullable().optional(),
 desconto:money.default(0),
 itens:z.array(z.object({petId:z.string().nullable().optional(),descricao:z.string().trim().min(2).max(240),quantidade:quantity,valorUnitario:money})).min(1).max(100)
}).strict();
const cents=v=>Math.round(v*100);
const serialized=q=>({...q,subtotal:Number(q.subtotal),desconto:Number(q.desconto),total:Number(q.total),itens:q.itens?.map(i=>({...i,quantidade:Number(i.quantidade),valorUnitario:Number(i.valorUnitario),total:Number(i.total)}))});
async function assertTenant(tx,org,empresa,cliente,petIds=[]){
 const c=await tx.cliente.findFirst({where:{id:cliente,organizacaoId:org,ativo:true},select:{id:true}});
 const e=await tx.empresa.findFirst({where:{id:empresa,organizacaoId:org,ativo:true},select:{id:true}});
 if(!c||!e)throw Error("CADASTRO_INVALIDO");
 if(petIds.length){const count=await tx.pet.count({where:{id:{in:petIds},clienteId:cliente,ativo:true,cliente:{organizacaoId:org}}});if(count!==petIds.length)throw Error("PET_INVALIDO");}
}
export async function listQuotes(org,empresa,cliente){
 await assertTenant(prisma,org,empresa,cliente);
 const data=await prisma.orcamentoCliente.findMany({where:{organizacaoId:org,empresaId:empresa,clienteId:cliente},include:{itens:true},orderBy:{createdAt:"desc"},take:100});
 return data.map(serialized);
}
export async function createQuote(org,empresa,input,actorId){
 if(!actorId)throw Error("OPERADOR_OBRIGATORIO");
 const ids=[...new Set(input.itens.map(i=>i.petId).filter(Boolean))];
 return prisma.$transaction(async tx=>{
  await assertTenant(tx,org,empresa,input.clienteId,ids);
  const rows=input.itens.map(i=>{const totalCents=Math.round(i.quantidade*cents(i.valorUnitario));return{petId:i.petId||null,descricao:i.descricao,quantidade:i.quantidade,valorUnitario:(cents(i.valorUnitario)/100).toFixed(2),total:(totalCents/100).toFixed(2),totalCents};});
  const subtotal=rows.reduce((s,i)=>s+i.totalCents,0),discount=cents(input.desconto);
  if(!Number.isSafeInteger(subtotal)||subtotal>9999999999)throw Error("TOTAL_INVALIDO");
  if(input.validade&&input.validade<new Date().toISOString().slice(0,10))throw Error("ORCAMENTO_EXPIRADO");
  if(discount>subtotal)throw Error("DESCONTO_INVALIDO");
  const created=await tx.orcamentoCliente.create({data:{
   organizacaoId:org,empresaId:empresa,clienteId:input.clienteId,
   validade:input.validade?new Date(input.validade+"T12:00:00.000Z"):null,
   observacoes:input.observacoes||null,subtotal:(subtotal/100).toFixed(2),
   desconto:(discount/100).toFixed(2),total:((subtotal-discount)/100).toFixed(2),
   itens:{create:rows.map(({totalCents,...row})=>row)}
  },include:{itens:true}});
  await tx.auditoria.create({data:{organizacaoId:org,empresaId:empresa,usuarioId:actorId,
   acao:"ORCAMENTO_CRIADO",entidade:"OrcamentoCliente",entidadeId:created.id,
   dadosNovos:{numero:created.numero,clienteId:input.clienteId,totalCentavos:subtotal-discount}}});
  return serialized(created);
 },{isolationLevel:"Serializable"});
}
export async function setQuoteStatus(org,empresa,cliente,id,status,actorId){
 if(!actorId)throw Error("OPERADOR_OBRIGATORIO");
 return prisma.$transaction(async tx=>{
  const quote=await tx.orcamentoCliente.findFirst({where:{id,organizacaoId:org,empresaId:empresa,clienteId:cliente}});
  if(!quote)throw Error("ORCAMENTO_NAO_ENCONTRADO");
  if(!["RASCUNHO","ENVIADO"].includes(quote.status))throw Error("ORCAMENTO_FECHADO");
  if(quote.validade&&quote.validade.getTime()<new Date(new Date().toISOString().slice(0,10)+"T00:00:00Z").getTime()&&status==="APROVADO")throw Error("ORCAMENTO_EXPIRADO");
  const update=await tx.orcamentoCliente.updateMany({where:{id,organizacaoId:org,empresaId:empresa,clienteId:cliente,status:quote.status},data:{status,aprovadoEm:status==="APROVADO"?new Date():null}});
  if(update.count!==1)throw Error("ORCAMENTO_FECHADO");
  await tx.auditoria.create({data:{organizacaoId:org,empresaId:empresa,usuarioId:actorId,
   acao:"ORCAMENTO_STATUS_ALTERADO",entidade:"OrcamentoCliente",entidadeId:id,
   dadosAnteriores:{status:quote.status},dadosNovos:{status}}});
  return serialized(await tx.orcamentoCliente.findUnique({where:{id},include:{itens:true}}));
 },{isolationLevel:"Serializable"});
}
/** Credit is read-only until explicit payment confirmation and PDV integration exist. */
export async function creditLedger(org,empresa,cliente){
 await assertTenant(prisma,org,empresa,cliente);
 const rows=await prisma.creditoClienteMovimento.findMany({where:{organizacaoId:org,empresaId:empresa,clienteId:cliente},orderBy:[{createdAt:"desc"},{id:"desc"}],take:200});
 const all=await prisma.creditoClienteMovimento.findMany({where:{organizacaoId:org,empresaId:empresa,clienteId:cliente},select:{tipo:true,valor:true}});
 // ESTORNO ainda não contém vínculo à operação original; NÃO presumir direção.
 const ambiguidade=all.some(m=>m.tipo==="ESTORNO");
 const saldoCentavos=all.reduce((acc,m)=>acc+(m.tipo==="ENTRADA"?1:-1)*Math.round(Number(m.valor)*100),0);
 const saldoConfiavel=!ambiguidade&&saldoCentavos>=0&&Number.isSafeInteger(saldoCentavos);
 return {saldo:saldoConfiavel?saldoCentavos/100:null,saldoConfiavel,
  motivoSaldoIndisponivel:ambiguidade?"ESTORNO_SEM_VINCULO_ORIGINAL":saldoConfiavel?null:"RAZAO_INCONSISTENTE",
  movimentos:rows.map(x=>({...x,valor:Number(x.valor)})),
  lancamentosHabilitados:false,usoNoPdvHabilitado:false};
}
