/**
 * PointVet M.4B — conversion of an approved quote to exactly one unified
 * DRAFT, in a disposable PostgreSQL CI database ONLY. Never routed to HTTP.
 * No reservations, real payments, inventory write or fiscal emission.
 */
import {createHash} from "node:crypto";
import prisma from "../../config/prisma.js";
import {travarUnidadesProdutos} from "../catalogo/catalogo-unidade.service.js";
import {exigirBancoIsolado} from "../pdv/pdv-unificado-venda-sandbox.service.js";
import {previsualizarOrcamentoNoPdvUnificado,previewQuoteSchema}
 from "./client-quote-pdv-preview.service.js";
const fail=code=>{throw Error(code);};
const cents=n=>Math.round(Number(n)*100);
const fingerprint=(quoteId,vinculos)=>createHash("sha256").update(JSON.stringify({
 version:1,quoteId,mappings:[...vinculos].sort((a,b)=>a.orcamentoItemId.localeCompare(b.orcamentoItemId))
})).digest("hex");
async function assertPermissions(tx,{organizacaoId,usuarioId,empresaId}){
 const u=await tx.usuario.findUnique({where:{id:usuarioId},select:{status:true}});
 if(u?.status!=="ATIVO")fail("M4B_USUARIO_INATIVO");
 const link=await tx.usuarioEmpresa.findFirst({
  where:{usuarioId,empresaId,ativo:true,empresa:{organizacaoId,ativo:true}},
  include:{cargo:{include:{permissoes:{include:{permissao:true}}}}}
 });
 const codes=new Set(link?.cargo?.ativo?link.cargo.permissoes.map(p=>p.permissao.codigo):[]);
 if(!codes.has("pdv.acessar")||!codes.has("financeiro.gerenciar"))
  fail("M4B_PERMISSOES_INSUFICIENTES");
}
async function checkExisting(tx,link,quote,{vinculos,fingerprintKey}){
 if(link.fingerprint!==fingerprintKey)fail("M4B_CONVERSAO_DIVERGENTE");
 const comanda=await tx.comanda.findFirst({where:{
  id:link.comandaId,clienteId:quote.clienteId,rascunhoUnificado:true
 },include:{itens:true,vendas:{select:{id:true}}}});
 const record=await tx.conversaoOrcamentoPdv.findUnique({
  where:{id:link.id},include:{itens:true}
 });
 const snap=link.snapshot;
 if(!comanda||comanda.status!=="ABERTA"||comanda.vendas.length||
    comanda.versaoRascunho!==snap.versaoRascunho||!record||
    record.itens.length!==quote.itens.length||
    comanda.itens.length!==quote.itens.length||
    await tx.reservaFechamentoUnificado.count({where:{comandaId:link.comandaId}}))
  fail("M4B_CONVERSAO_JA_ALTERADA");
 // Compare a MULTISET of current draft lines against the immutable mapping:
 // a simple .some() check would miss replacement of one of two identical lines.
 const byItem=new Map(record.itens.map(i=>[i.orcamentoItemId,i]));
 const byMapped=new Map(vinculos.map(v=>[v.orcamentoItemId,v.itemCatalogoId]));
 if(byItem.size!==quote.itens.length)fail("M4B_CONVERSAO_JA_ALTERADA");
 const signature=(catalogId,petId,quantity,price,total,companyId,status)=>JSON.stringify([
  catalogId,petId||null,Number(quantity).toFixed(3),cents(price),cents(total),companyId,status
 ]);
 const expected=[];
 for(const q of quote.itens){
  const rec=byItem.get(q.id);
  if(!rec||rec.itemCatalogoId!==byMapped.get(q.id)||
     Number(rec.quantidade)!==Number(q.quantidade)||
     cents(rec.valorUnitario)!==cents(q.valorUnitario)||
     cents(rec.valorTotal)!==cents(q.total))
   fail("M4B_CONVERSAO_JA_ALTERADA");
  expected.push(signature(rec.itemCatalogoId,q.petId,rec.quantidade,
   rec.valorUnitario,rec.valorTotal,link.empresaId,"ATIVO"));
 }
 const actual=comanda.itens.map(i=>signature(i.itemCatalogoId,i.petId,
  i.quantidade,i.valorUnitario,i.valorTotal,i.empresaId,i.status));
 if(JSON.stringify(expected.sort())!==JSON.stringify(actual.sort()))
  fail("M4B_CONVERSAO_JA_ALTERADA");
 return {modo:"RASCUNHO_PDV_UNIFICADO_CI",conversaoId:link.id,
  orcamentoId:quote.id,rascunhoId:link.comandaId,versao:snap.versaoRascunho,
  total:snap.total,reutilizada:true,
  checkoutHabilitado:false,gerouPagamento:false,movimentouEstoque:false,emitiuFiscal:false};
}
export async function converterOrcamentoEmRascunhoSomenteSandbox({
 organizacaoId,usuarioId,empresaId,clienteId,orcamentoId,vinculos,
 simularFalhaDepoisDaComanda=false
}){
 exigirBancoIsolado();
 const parsed=previewQuoteSchema.parse({vinculos});
 const fingerprintKey=fingerprint(orcamentoId,parsed.vinculos);
 return prisma.$transaction(async tx=>{
  const db=await tx.$queryRawUnsafe("SELECT current_database() AS nome");
  if(db[0]?.nome!=="pointvet_unified_ci")fail("BANCO_NAO_ISOLADO");
  // Serialize all conversions for this quote, across concurrent operators.
  await tx.$queryRawUnsafe('SELECT "id" FROM "orcamentos_clientes" WHERE "id"=$1 FOR UPDATE',orcamentoId);
  await assertPermissions(tx,{organizacaoId,usuarioId,empresaId});
  const quote=await tx.orcamentoCliente.findFirst({where:{
   id:orcamentoId,organizacaoId,empresaId,clienteId
  },include:{itens:{orderBy:{id:"asc"}}}});
  if(!quote)fail("ORCAMENTO_NAO_ENCONTRADO");
  if(quote.status!=="APROVADO")fail("M4A_ORCAMENTO_NAO_APROVADO");
  const prior=await tx.conversaoOrcamentoPdv.findUnique({where:{orcamentoId}});
  if(prior){
   if(prior.organizacaoId!==organizacaoId||prior.empresaId!==empresaId||
     prior.clienteId!==clienteId)fail("M4B_CROSS_TENANT");
   return checkExisting(tx,prior,quote,{vinculos:parsed.vinculos,fingerprintKey});
  }
  // Preço/quantidade do produto devem ser lidos depois de bloquear mudança
  // de unidade, inclusive na primeira conversão de orçamento (CI isolado).
  await travarUnidadesProdutos(tx,parsed.vinculos.map(x=>x.itemCatalogoId));
  const current=await previsualizarOrcamentoNoPdvUnificado({
   organizacaoId,usuarioId,empresaId,clienteId,orcamentoId,vinculos:parsed.vinculos
  },tx);
  if(current.itens.length!==quote.itens.length||
     cents(current.total)!==cents(quote.total))fail("M4B_PREVIA_DIVERGENTE");
  const comanda=await tx.comanda.create({data:{
   clienteId,rascunhoUnificado:true,status:"ABERTA",
   observacoes:"Rascunho de orçamento aprovado #"+quote.numero+" (M.4B CI)"
  }});
  const mapped=new Map(parsed.vinculos.map(x=>[x.orcamentoItemId,x.itemCatalogoId]));
  const byProduct=new Map(current.itens.map((i,index)=>[quote.itens[index].id,i]));
  const lines=quote.itens.map(item=>{
   const check=byProduct.get(item.id);
   if(!check||check.itemCatalogoId!==mapped.get(item.id)||
      cents(item.total)!==cents(check.valorTotal))fail("M4B_LINHA_DIVERGENTE");
   return {comandaId:comanda.id,empresaId,itemCatalogoId:mapped.get(item.id),
    petId:item.petId||null,descricao:check.descricao,
    quantidade:item.quantidade,valorUnitario:item.valorUnitario,
    valorTotal:item.total,desconto:"0.00"};
  });
  await tx.comandaItem.createMany({data:lines});
  if(simularFalhaDepoisDaComanda)fail("M4B_FALHA_SIMULADA_TRANSACAO");
  const entry=await tx.conversaoOrcamentoPdv.create({data:{
   orcamentoId,comandaId:comanda.id,organizacaoId,empresaId,clienteId,
   usuarioId,fingerprint:fingerprintKey,
   snapshot:{versao:1,versaoRascunho:comanda.versaoRascunho,total:current.total,
    orcamentoNumero:quote.numero,quoteStatus:"APROVADO",
    cotacaoAprovadaEm:quote.aprovadoEm?.toISOString()||null,
    mapeamentos:parsed.vinculos},
   itens:{create:quote.itens.map(item=>({
    orcamentoItemId:item.id,itemCatalogoId:mapped.get(item.id),
    quantidade:item.quantidade,valorUnitario:item.valorUnitario,valorTotal:item.total
   }))}
  }});
  await tx.auditoria.create({data:{
   organizacaoId,empresaId,usuarioId,acao:"ORCAMENTO_CONVERTIDO_RASCUNHO_CI",
   entidade:"OrcamentoCliente",entidadeId:orcamentoId,
   dadosNovos:{conversaoId:entry.id,comandaId:comanda.id,
    total:current.total,mapeamentos:parsed.vinculos}
  }});
  return {modo:"RASCUNHO_PDV_UNIFICADO_CI",conversaoId:entry.id,
   orcamentoId,rascunhoId:comanda.id,versao:comanda.versaoRascunho,
   total:current.total,reutilizada:false,
   checkoutHabilitado:false,gerouPagamento:false,movimentouEstoque:false,emitiuFiscal:false};
 },{isolationLevel:"Serializable",maxWait:10000,timeout:25000});
}
