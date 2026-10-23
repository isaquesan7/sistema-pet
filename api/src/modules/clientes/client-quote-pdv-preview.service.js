/**
 * PointVet M.4A — quote-to-PDV visual preflight, never a conversion.
 * The client quote has free text and no catalogue FK: staff must explicitly
 * provide a complete 1:1 quote-item/catalogue mapping on every request.
 * Fail closed for differences in name, price, quantity, discount or company.
 * Uses the existing PDV simulation without writing sales or stock.
 */
import {z} from "zod";
import prisma from "../../config/prisma.js";
import {simularComanda} from "../pdv/pdv-unificado.service.js";
import {centavosExatos} from "../pdv/pdv-unificado-fechamento-manual.contract.js";

export const previewQuoteSchema=z.object({
 vinculos:z.array(z.object({
  orcamentoItemId:z.string().min(1),
  itemCatalogoId:z.string().min(1)
 }).strict()).min(1).max(100)
}).strict();

export async function previsualizarOrcamentoNoPdvUnificado({
 organizacaoId,empresaId,usuarioId,clienteId,orcamentoId,vinculos
},db=prisma){
 const q=await db.orcamentoCliente.findFirst({where:{
  id:orcamentoId,organizacaoId,empresaId,clienteId
 },include:{itens:{orderBy:{id:"asc"}}}});
 if(!q)throw Error("ORCAMENTO_NAO_ENCONTRADO");
 if(q.status!=="APROVADO")throw Error("M4A_ORCAMENTO_NAO_APROVADO");
 if(q.validade&&q.validade.toISOString().slice(0,10)<new Date().toISOString().slice(0,10))
  throw Error("ORCAMENTO_EXPIRADO");
 // Diferente de pagamento, desconto zero é permitido: não usar centavosExatos,
 // cujo contrato M.3 é deliberadamente estritamente positivo.
 if(!Number.isFinite(Number(q.desconto))||Number(q.desconto)!==0)
  throw Error("M4A_DESCONTO_SEM_CORRESPONDENCIA_PDV");
 if(!vinculos.length||vinculos.length!==q.itens.length)throw Error("M4A_MAPEAMENTO_INCOMPLETO");
 const mapped=new Map();
 for(const entry of vinculos){
  if(mapped.has(entry.orcamentoItemId))throw Error("M4A_ITEM_DUPLICADO");
  mapped.set(entry.orcamentoItemId,entry.itemCatalogoId);
 }
 if(q.itens.some(i=>!mapped.has(i.id)))throw Error("M4A_MAPEAMENTO_INCOMPLETO");
 const inputs=q.itens.map(item=>({
  empresaId,itemCatalogoId:mapped.get(item.id),
  petId:item.petId||null,quantidade:Number(item.quantidade)
 }));
 // Only the selected issuer company is authorized, never another company's catalog.
 const catalog=await db.itemCatalogo.findMany({where:{
  id:{in:[...new Set(inputs.map(i=>i.itemCatalogoId))]},
  empresaId,ativo:true,empresa:{organizacaoId,ativo:true}
 },select:{id:true,nome:true,precoVenda:true}});
 const byCatalog=new Map(catalog.map(i=>[i.id,i]));
 if(inputs.some(i=>!byCatalog.has(i.itemCatalogoId)))
  throw Error("M4A_CATALOGO_EMPRESA_INCOMPATIVEL");
 for(let n=0;n<q.itens.length;n++){
  const line=q.itens[n],item=byCatalog.get(inputs[n].itemCatalogoId);
  if(line.descricao.trim().toLocaleLowerCase("pt-BR")!==item.nome.trim().toLocaleLowerCase("pt-BR")||
     centavosExatos(line.valorUnitario)!==centavosExatos(item.precoVenda))
   throw Error("M4A_CATALOGO_PRECO_OU_DESCRICAO_DIVERGENTE");
 }
 const preview=await simularComanda({
  organizacaoId,usuarioId,empresaId,clienteId,itens:inputs
 },db);
 if(preview.empresas.length!==1||preview.empresas[0].empresaId!==empresaId||
    preview.empresas[0].itens.length!==q.itens.length)
  throw Error("M4A_PREVIA_EMPRESA_DIVERGENTE");
 for(let n=0;n<q.itens.length;n++){
  const item=q.itens[n],simulated=preview.empresas[0].itens[n];
  if(simulated.itemCatalogoId!==inputs[n].itemCatalogoId||
     centavosExatos(simulated.valorTotal)!==centavosExatos(item.total))
   throw Error("M4A_TOTAL_DIVERGENTE");
 }
 if(centavosExatos(preview.total)!==centavosExatos(q.total))
  throw Error("M4A_TOTAL_DIVERGENTE");
 return {modo:"PREVIA_ORCAMENTO_SEM_CONVERSAO",orcamentoId:q.id,
  orcamentoNumero:q.numero,empresaId,clienteId,
  total:preview.total,itens:preview.empresas[0].itens,
  podeCriarRascunho:false,podeFecharVenda:false,podeUsarCredito:false,
  movimentouEstoque:false,gerouPagamento:false,emitiuFiscal:false,
  observacao:"Correspondência conferida para simulação. Não altera orçamento, caixa, venda ou estoque."};
}
