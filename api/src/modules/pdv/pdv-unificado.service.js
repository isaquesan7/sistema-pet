/** PointVet 20.1: read-only multi-company cart simulation.
 * Never saves a comanda, sells inventory, accepts payment or generates fiscal documents.
 */
import {z} from "zod";
import prisma from "../../config/prisma.js";
const itemSchema=z.object({empresaId:z.string().min(1),itemCatalogoId:z.string().min(1),petId:z.string().nullable().optional(),quantidade:z.number().positive().max(10000)}).strict();
export const previewSchema=z.object({clienteId:z.string().min(1),itens:z.array(itemSchema).min(1).max(100)}).strict();
const cents=v=>Math.round(Number(v)*100);
const serialize=amount=>(amount/100).toFixed(2);
async function empresasAutorizadas({organizacaoId,usuarioId,empresaId}){
 const vinculos=await prisma.usuarioEmpresa.findMany({where:{usuarioId,ativo:true,empresa:{organizacaoId,ativo:true}},include:{empresa:{select:{id:true,nomeFantasia:true,cnpj:true,tipo:true}},cargo:{include:{permissoes:{include:{permissao:true}}}}}});
 return vinculos.filter(v=>v.empresaId===empresaId||v.cargo?.permissoes?.some(p=>p.permissao.codigo==="pdv.acessar")).map(v=>v.empresa);
}
export async function buscarCatalogo({organizacaoId,usuarioId,empresaId,busca=""}){
 const companies=await empresasAutorizadas({organizacaoId,usuarioId,empresaId});
 const items=await prisma.itemCatalogo.findMany({where:{empresaId:{in:companies.map(c=>c.id)},ativo:true,empresa:{organizacaoId,ativo:true},...(busca?{OR:[{nome:{contains:busca,mode:"insensitive"}},{codigoInterno:{contains:busca,mode:"insensitive"}},{codigoBarras:{contains:busca,mode:"insensitive"}}]}:{})},select:{id:true,empresaId:true,nome:true,tipo:true,precoVenda:true,codigoInterno:true,servico:{select:{exigePet:true}}},take:100,orderBy:[{nome:"asc"}]});
 const byCompany=new Map(companies.map(c=>[c.id,c]));
 return items.map(x=>({...x,precoVenda:Number(x.precoVenda),empresa:byCompany.get(x.empresaId)}));
}
export async function simularComanda({organizacaoId,usuarioId,empresaId,clienteId,itens}){
 const cliente=await prisma.cliente.findFirst({where:{id:clienteId,organizacaoId,ativo:true},select:{id:true,nome:true}});
 if(!cliente)throw Error("CLIENTE_NAO_ENCONTRADO");
 const companies=await empresasAutorizadas({organizacaoId,usuarioId,empresaId});
 const allowed=new Map(companies.map(c=>[c.id,c]));
 if(itens.some(x=>!allowed.has(x.empresaId)))throw Error("EMPRESA_SEM_ACESSO");
 const ids=[...new Set(itens.map(x=>x.itemCatalogoId))];
 const found=await prisma.itemCatalogo.findMany({where:{id:{in:ids},empresaId:{in:[...allowed.keys()]},ativo:true,empresa:{organizacaoId,ativo:true}},select:{id:true,empresaId:true,nome:true,tipo:true,precoVenda:true,servico:{select:{exigePet:true}}}});
 const map=new Map(found.map(i=>[i.id,i]));
 const petIds=[...new Set(itens.map(i=>i.petId).filter(Boolean))];
 const pets=petIds.length?await prisma.pet.findMany({where:{id:{in:petIds},clienteId,ativo:true,cliente:{organizacaoId}},select:{id:true}}):[];
 if(pets.length!==petIds.length)throw Error("PET_INVALIDO");
 const rows=itens.map(input=>{
  const item=map.get(input.itemCatalogoId);
  if(!item||item.empresaId!==input.empresaId)throw Error("ITEM_INVALIDO");
  if(item.tipo==="SERVICO"&&item.servico?.exigePet&&!input.petId)throw Error("PET_OBRIGATORIO");
  // money in integer cents, quantities up to 3 fractional digits.
  const quantityMilli=Math.round(input.quantidade*1000);
  if(Math.abs(quantityMilli/1000-input.quantidade)>0.0000001)throw Error("QUANTIDADE_INVALIDA");
  const totalCents=Math.round(cents(item.precoVenda)*quantityMilli/1000);
  return {empresaId:item.empresaId,empresa:allowed.get(item.empresaId).nomeFantasia,itemCatalogoId:item.id,descricao:item.nome,petId:input.petId||null,quantidade:quantityMilli/1000,valorUnitario:serialize(cents(item.precoVenda)),valorTotal:serialize(totalCents),totalCents};
 });
 const groups=new Map();
 for(const row of rows){const g=groups.get(row.empresaId)||{empresaId:row.empresaId,empresa:row.empresa,totalCents:0,itens:[]};g.totalCents+=row.totalCents;g.itens.push((({totalCents,...line})=>line)(row));groups.set(row.empresaId,g);}
 const subtotal=rows.reduce((sum,r)=>sum+r.totalCents,0);
 return {modo:"SIMULACAO_SEM_FECHAMENTO",cliente,quantidadeItens:rows.length,total:serialize(subtotal),empresas:[...groups.values()].map(({totalCents,...g})=>({...g,total:serialize(totalCents)})),observacao:"Nenhuma venda, cobrança, estoque ou nota fiscal foi alterada."};
}
