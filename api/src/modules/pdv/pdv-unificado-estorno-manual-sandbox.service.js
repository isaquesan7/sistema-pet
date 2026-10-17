/**
 * PointVet M.3C — estorno integral de recebimentos manuais.
 * Confirmação de reembolso é declaração do funcionário, não transação PSP.
 * O fechamento do caixa legado exclui DINHEIRO ESTORNADO dos pagamentos;
 * não registrar ESTORNO financeiro novamente (duplicaria a devolução).
 * O wrapper de sandbox é exclusivamente CI; o núcleo transacional é reutilizado
 * no checkout manual autenticado, com gates de organização/CNPJ no chamador.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {consultarReservaFechamento} from "./pdv-unificado.service.js";
import {centavosExatos} from "./pdv-unificado-fechamento-manual.contract.js";
import {normalizarPedidoEstornoManual,fingerprintEstornoManual,validarReversaoPendente,
 conferirCompensacoesEstoquePorLote}
 from "./pdv-unificado-estorno-manual.contract.js";
const fail=x=>{throw Error(x);};
const milli=x=>Math.round(Number(x)*1000);
const result=(a,reutilizada,contextoExecucao)=>({id:a.id,reservaId:a.reservaId,reutilizada,
 status:"ESTORNO_REGISTRADO",snapshot:a.snapshot,houveRefundPorAPI:false,
 houveFiscal:false,houvePsp:false,apenasAmbienteIsolado:contextoExecucao==="CI"});
async function authorize(tx,usuarioId,organizacaoId,ops){
 const user=await tx.usuario.findUnique({where:{id:usuarioId},select:{status:true}});
 if(user?.status!=="ATIVO")fail("M3C_USUARIO_INATIVO");
 const links=await tx.usuarioEmpresa.findMany({
  where:{usuarioId,ativo:true,empresa:{organizacaoId,ativo:true}},
  include:{cargo:{include:{permissoes:{include:{permissao:true}}}}}
 });
 const ok=new Set(links.filter(v=>v.cargo?.ativo&&v.cargo.permissoes.some(
  p=>p.permissao.codigo==="pdv.cancelar_venda")).map(v=>v.empresaId));
 if(ops.some(o=>!ok.has(o.empresaId)))fail("M3C_SEM_PERMISSAO_ESTORNO");
}
async function replay(tx,audit,comanda,reserva,ops,registro,contextoExecucao){
 if(comanda.status!=="CANCELADA"||reserva.status!=="CANCELADA"||
    ops.some(o=>o.status!=="ESTORNADA"))fail("M3C_REPLAY_INCONSISTENTE");
 const sales=await tx.venda.findMany({where:{id:{in:ops.map(o=>o.vendaId)}}});
 const lines=registro?.linhas||[];
 const payments=await tx.pagamento.findMany({where:{
  id:{in:lines.map(l=>l.pagamentoId).filter(Boolean)}
 }});
 const slices=await tx.parcelaRecebivelManualUnificado.findMany({where:{
  linhaId:{in:lines.map(l=>l.id)}
 }});
 if(!lines.length||sales.length!==ops.length||sales.some(s=>s.status!=="ESTORNADA")||
    payments.length!==lines.length||payments.some(p=>p.status!=="ESTORNADO")||
    slices.some(p=>p.status!=="ESTORNADA"))fail("M3C_REPLAY_INCONSISTENTE");
 const sold=await tx.movimentacaoEstoque.findMany({where:{
  origemTipo:"VENDA",origemId:{in:ops.map(o=>o.vendaId)},tipo:"VENDA"}});
 const reversed=await tx.movimentacaoEstoque.findMany({where:{
  origemTipo:"ESTORNO_MANUAL_UNIFICADO",origemId:audit.id,tipo:"CANCELAMENTO"}});
 if(audit.snapshot.movimentosEstoque!==reversed.length)
  fail("M3C_REPLAY_INCONSISTENTE");
 conferirCompensacoesEstoquePorLote(sold,reversed);
 return result(audit,true,contextoExecucao);
}
export async function estornarFechamentoManualSomenteSandbox({
 organizacaoId,usuarioId,empresaId,id,versao,dados,simularFalhaAposEmpresaId=null
}){
 exigirBancoIsolado();
 return prisma.$transaction(async tx=>{
  if((await tx.$queryRawUnsafe("SELECT current_database() AS nome"))[0]?.nome!=="pointvet_unified_ci")
   fail("BANCO_NAO_ISOLADO");
  return estornarFechamentoManualEmTransacao(tx,{
   organizacaoId,usuarioId,empresaId,id,versao,dados,simularFalhaAposEmpresaId,
   contextoExecucao:"CI"
  });
 },{isolationLevel:"Serializable",maxWait:10000,timeout:30000});
}
/** Núcleo M.3C compartilhado; só pode ser invocado dentro de uma transação
 * SERIALIZABLE, depois do gate operacional da entrada autenticada. */
export async function estornarFechamentoManualEmTransacao(tx,{
 organizacaoId,usuarioId,empresaId,id,versao,dados,simularFalhaAposEmpresaId=null,
 contextoExecucao
}){
 if(!["CI","GESTAO_MANUAL"].includes(contextoExecucao))fail("M3C_CONTEXTO_INVALIDO");
 if(contextoExecucao!=="CI"&&simularFalhaAposEmpresaId!==null)
  fail("M3C_SIMULACAO_INDISPONIVEL");
 const pedido=normalizarPedidoEstornoManual(dados);
  // Static SQL with bound variables; never interpolate user-controlled IDs.
  await tx.$queryRawUnsafe('SELECT "id" FROM "comandas" WHERE "id"=$1 FOR UPDATE',id);
  const comanda=await tx.comanda.findFirst({where:{
   id,rascunhoUnificado:true,cliente:{organizacaoId}
  },include:{itens:{select:{id:true,status:true}}}});
  if(!comanda)fail("RASCUNHO_NAO_ENCONTRADO");
  if(comanda.versaoRascunho!==versao)fail("RASCUNHO_DESATUALIZADO");
  const reserva=await consultarReservaFechamento({
   organizacaoId,usuarioId,empresaId,id,versao
  },tx);
  if(!reserva)fail("M3C_RESERVA_AUSENTE");
  const ops=await tx.reservaOperacaoUnificada.findMany({
   where:{reservaId:reserva.id},orderBy:{empresaId:"asc"},
   include:{empresa:{select:{cnpj:true,organizacaoId:true,ativo:true}}}
  });
  if(!ops.length||ops.some(o=>o.empresa.organizacaoId!==organizacaoId))
   fail("M3C_EMPRESA_INVALIDA");
  await authorize(tx,usuarioId,organizacaoId,ops);
  const registro=await tx.registroRecebimentoManualUnificado.findUnique({
   where:{reservaId:reserva.id},include:{linhas:true}
  });
  const fingerprint=fingerprintEstornoManual({reservaId:reserva.id,usuarioId,pedido});
  const prior=await tx.estornoFechamentoManualUnificado.findUnique({
   where:{reservaId:reserva.id}
  });
  if(prior){
   if(prior.fingerprint!==fingerprint)fail("M3C_ESTORNO_DIVERGENTE");
   return replay(tx,prior,comanda,reserva,ops,registro,contextoExecucao);
  }
  // M.5.10: once a card pre-baixa was durably registered, the old
  // pending-only refund path cannot silently reverse it. Human financial
  // review is mandatory. Same comanda FOR UPDATE guards concurrent requests.
  if(await tx.preparacaoBaixaCartaoManualUnificada.count({
   where:{comandaId:id}
  }))fail("M3C_PRE_BAIXA_EXIGE_REVISAO");
  if(comanda.status!=="FECHADA"||reserva.status!=="RESERVADA"||
     comanda.itens.some(i=>i.status!=="FATURADO")||
     ops.some(o=>o.status!=="CONCLUIDA"||!o.vendaId))fail("M3C_ESTADO_INCONSISTENTE");
  if(!registro||registro.status!=="REGISTRADO"||!registro.linhas.length||
     registro.linhas.some(l=>!l.pagamentoId))fail("M3C_REGISTRO_INCONSISTENTE");
  const prep=await tx.criacaoPreparacaoUnificada.findUnique({
   where:{reservaId:reserva.id}
  });
  if(prep?.status!=="PREPARADA"||prep.snapshot?.comandaId!==id||
     prep.snapshot?.versaoRascunho!==versao||
     prep.snapshot?.operacoes?.length!==ops.length)fail("M3C_PREPARACAO_INVALIDA");
  const sales=await tx.venda.findMany({
   where:{id:{in:ops.map(o=>o.vendaId)}},include:{itens:true}
  });
  if(sales.length!==ops.length||sales.some(v=>v.status!=="FINALIZADA"||v.comandaId!==id||
     !ops.some(o=>o.vendaId===v.id&&o.empresaId===v.empresaId)))
   fail("M3C_VENDA_INVALIDA");
  const lines=registro.linhas;
  const pays=await tx.pagamento.findMany({where:{
   id:{in:lines.map(l=>l.pagamentoId)}
  }});
  if(pays.length!==lines.length)fail("M3C_PAGAMENTO_INCOMPLETO");
  for(const l of lines){
   const op=ops.find(o=>o.id===l.operacaoId),pay=pays.find(p=>p.id===l.pagamentoId);
   if(!op||!pay||pay.vendaId!==op.vendaId||pay.forma!==l.forma||
      pay.sessaoCaixaId!==l.sessaoCaixaId||
      centavosExatos(pay.valor)!==centavosExatos(l.valor))fail("M3C_PAGAMENTO_DIVERGENTE");
  }
  for(const op of ops){
   const corresponding=lines.filter(l=>l.operacaoId===op.id);
   const snap=prep.snapshot.operacoes.find(o=>o.empresaId===op.empresaId);
   if(!snap||!op.empresa.ativo||snap.cnpj!==op.empresa.cnpj||
      centavosExatos(snap.total)!==centavosExatos(op.valorTotal)||
      !corresponding.length||
      corresponding.reduce((n,l)=>n+centavosExatos(l.valor),0)!==centavosExatos(op.valorTotal))
    fail("M3C_EMPRESA_DIVERGENTE");
  }
  const saleIds=sales.map(s=>s.id),payIds=pays.map(p=>p.id);
  const slices=await tx.parcelaRecebivelManualUnificado.findMany({
   where:{linhaId:{in:lines.map(l=>l.id)}}
  });
  for(const l of lines){
   const parts=slices.filter(s=>s.linhaId===l.id);
   if(l.forma==="CARTAO_CREDITO"){
    if(parts.length!==l.parcelas||
       parts.reduce((n,p)=>n+centavosExatos(p.valor),0)!==centavosExatos(l.valor))
     fail("M3C_PARCELAS_DIVERGENTES");
   }else if(parts.length)fail("M3C_PARCELAS_DIVERGENTES");
  }
  const [docs,titles,conciliations]=await Promise.all([
   tx.documentoFiscal.findMany({where:{vendaId:{in:saleIds}},select:{id:true}}),
   tx.tituloFinanceiro.findMany({where:{OR:[
    {vendaId:{in:saleIds}},{pagamentoId:{in:payIds}}
   ]},select:{id:true}}),
   tx.conciliacaoFinanceira.findMany({where:{
    origem:"PAGAMENTO_VENDA",origemId:{in:payIds}
   },select:{id:true}})
  ]);
  validarReversaoPendente({parcelas:slices,documentosFiscais:docs,
   titulosFinanceiros:titles,conciliacoes:conciliations,pagamentos:pays});
  const cashIds=[...new Set(lines.map(l=>l.sessaoCaixaId))].sort();
  for(const c of cashIds)
   await tx.$queryRawUnsafe('SELECT "id" FROM "sessoes_caixa" WHERE "id"=$1 FOR UPDATE',c);
  const sessions=await tx.sessaoCaixa.findMany({where:{id:{in:cashIds}},
   include:{caixa:{select:{empresaId:true,ativo:true}}}});
  if(sessions.length!==cashIds.length||lines.some(l=>{
   const op=ops.find(o=>o.id===l.operacaoId);
   return !sessions.some(s=>s.id===l.sessaoCaixaId&&s.status==="ABERTO"&&
     s.caixa.ativo&&s.caixa.empresaId===op?.empresaId);
  }))fail("M3C_CAIXA_FECHADO_EXIGE_REVISAO");
  const recordedCash=await tx.movimentacaoCaixa.findMany({where:{
   referenciaTipo:"PAGAMENTO",referenciaId:{in:payIds}
  }});
  if(recordedCash.some(c=>c.tipo!=="VENDA")||pays.some(p=>
    recordedCash.filter(c=>c.referenciaId===p.id).length!==(p.forma==="DINHEIRO"?1:0)))
   fail("M3C_CAIXA_INCONSISTENTE");
  const movements=await tx.movimentacaoEstoque.findMany({
   where:{origemTipo:"VENDA",origemId:{in:saleIds},tipo:"VENDA"},
   orderBy:[{empresaId:"asc"},{produtoId:"asc"},{createdAt:"asc"},{id:"asc"}]
  });
  const itemIds=[...new Set(sales.flatMap(v=>v.itens.map(i=>i.itemCatalogoId).filter(Boolean)))];
  const products=await tx.produto.findMany({where:{itemId:{in:itemIds}},
   include:{item:{select:{empresaId:true}}}});
  const byItem=new Map(products.map(p=>[p.itemId,p]));
  const expect=new Map(),actual=new Map();
  for(const sale of sales)for(const item of sale.itens){
   const prod=byItem.get(item.itemCatalogoId);
   if(!prod?.controlaEstoque)continue;
   if(prod.item.empresaId!==sale.empresaId)fail("M3C_ESTOQUE_EMPRESA_INVALIDA");
   const key=sale.id+":"+prod.id;
   expect.set(key,(expect.get(key)||0)+milli(item.quantidade));
  }
  for(const m of movements){
   const op=ops.find(o=>o.vendaId===m.origemId);
   const product=products.find(p=>p.id===m.produtoId);
   if(!op||m.empresaId!==op.empresaId||product?.item.empresaId!==op.empresaId||
      milli(m.quantidade)<=0)fail("M3C_ESTOQUE_INCONSISTENTE");
   const key=m.origemId+":"+m.produtoId;
   actual.set(key,(actual.get(key)||0)+milli(m.quantidade));
  }
  if(actual.size!==expect.size||[...expect].some(([k,v])=>actual.get(k)!==v))
   fail("M3C_ESTOQUE_INCONSISTENTE");
  if(await tx.movimentacaoEstoque.count({where:{
   origemTipo:"CANCELAMENTO_VENDA",origemId:{in:saleIds}
  }}))fail("M3C_ESTOQUE_JA_COMPENSADO");
  const stocks=[...new Set(movements.map(m=>m.produtoId))].sort();
  const lots=[...new Set(movements.map(m=>m.loteId).filter(Boolean))].sort();
  for(const id of stocks)
   await tx.$queryRawUnsafe('SELECT "id" FROM "estoque_saldos" WHERE "produtoId"=$1 FOR UPDATE',id);
  for(const id of lots)
   await tx.$queryRawUnsafe('SELECT "id" FROM "lotes_produtos" WHERE "id"=$1 FOR UPDATE',id);
  const existingLots=await tx.loteProduto.findMany({where:{id:{in:lots}},
   select:{id:true,produtoId:true}});
  const lotById=new Map(existingLots.map(l=>[l.id,l]));
  if(await tx.estoqueSaldo.count({where:{produtoId:{in:stocks}}})!==stocks.length||
     existingLots.length!==lots.length||movements.some(m=>
      m.loteId&&lotById.get(m.loteId)?.produtoId!==m.produtoId))
   fail("M3C_ESTOQUE_INEXISTENTE");
  const audit=await tx.estornoFechamentoManualUnificado.create({data:{
   reservaId:reserva.id,usuarioId,motivo:pedido.motivo,
   referenciaExterna:pedido.referenciaExterna,confirmouDevolucaoExterna:true,
   fingerprint,snapshot:{versao:1,comandaId:id,reservaId:reserva.id,
    devolucaoExternaDeclarada:true,reembolsadoAutomaticamente:false,
    operacoes:ops.map(o=>({empresaId:o.empresaId,cnpj:o.empresa.cnpj,
     vendaId:o.vendaId,valorCentavos:centavosExatos(o.valorTotal)})),
    pagamentos:payIds,movimentosEstoque:movements.length,parcelasPendentes:slices.length}
  }});
  const now=new Date();
  for(const op of ops){
   const sale=sales.find(s=>s.id===op.vendaId);
   for(const l of lines.filter(l=>l.operacaoId===op.id)){
    const pay=pays.find(p=>p.id===l.pagamentoId);
    if((await tx.pagamento.updateMany({where:{id:pay.id,status:pay.status,vendaId:sale.id},
     data:{status:"ESTORNADO"}})).count!==1)fail("M3C_PAGAMENTO_CONCORRENTE");
    if(l.forma==="CARTAO_CREDITO"){
     if((await tx.parcelaRecebivelManualUnificado.updateMany({where:{
      linhaId:l.id,status:"AGUARDANDO_REPASSE",conciliadoEm:null
     },data:{status:"ESTORNADA"}})).count!==l.parcelas)fail("M3C_PARCELA_CONCORRENTE");
    }
    if(l.forma==="DINHEIRO"){
     await tx.movimentacaoCaixa.create({data:{
      sessaoCaixaId:l.sessaoCaixaId,usuarioId,tipo:"VENDA",valor:l.valor,
      descricao:"Estorno manual M.3C: auditoria, não segunda baixa de caixa",
      referenciaTipo:"ESTORNO_MANUAL_UNIFICADO",referenciaId:audit.id
     }});
    }
   }
   for(const m of movements.filter(m=>m.origemId===sale.id)){
    const before=await tx.estoqueSaldo.findUnique({where:{produtoId:m.produtoId}});
    if(!before)fail("M3C_ESTOQUE_INEXISTENTE");
    const previous=milli(before.quantidade),q=milli(m.quantidade);
    if(!Number.isSafeInteger(previous+q))fail("M3C_SALDO_INVALIDO");
    await tx.estoqueSaldo.update({where:{produtoId:m.produtoId},
     data:{quantidade:{increment:Number(m.quantidade)}}});
    if(m.loteId)await tx.loteProduto.update({where:{id:m.loteId},
     data:{quantidadeAtual:{increment:Number(m.quantidade)}}});
    await tx.movimentacaoEstoque.create({data:{
     empresaId:op.empresaId,produtoId:m.produtoId,loteId:m.loteId,
     usuarioId,tipo:"CANCELAMENTO",quantidade:m.quantidade,
     saldoAnterior:previous/1000,saldoPosterior:(previous+q)/1000,
     custoUnitario:m.custoUnitario,origemTipo:"ESTORNO_MANUAL_UNIFICADO",
     origemId:audit.id,observacao:"Compensa movimento "+m.id
    }});
   }
   if((await tx.venda.updateMany({where:{
    id:sale.id,empresaId:op.empresaId,status:"FINALIZADA"
   },data:{status:"ESTORNADA",canceladaEm:now}})).count!==1)fail("M3C_VENDA_CONCORRENTE");
   if((await tx.reservaOperacaoUnificada.updateMany({where:{
    id:op.id,reservaId:reserva.id,status:"CONCLUIDA",vendaId:sale.id
   },data:{status:"ESTORNADA"}})).count!==1)fail("M3C_OPERACAO_CONCORRENTE");
   if(simularFalhaAposEmpresaId===op.empresaId)fail("M3C_FALHA_SIMULADA_TRANSACAO");
  }
  if((await tx.comandaItem.updateMany({where:{comandaId:id,status:"FATURADO"},
   data:{status:"CANCELADO"}})).count!==comanda.itens.length)fail("M3C_ITENS_CONCORRENTES");
  if((await tx.comanda.updateMany({where:{
   id,status:"FECHADA",versaoRascunho:versao
  },data:{status:"CANCELADA"}})).count!==1)fail("M3C_COMANDA_CONCORRENTE");
  if((await tx.reservaFechamentoUnificado.updateMany({where:{
   id:reserva.id,status:"RESERVADA"
  },data:{status:"CANCELADA",canceladaEm:now,canceladoPorId:usuarioId,
   motivoCancelamento:"Estorno manual M.3C: "+pedido.motivo}})).count!==1)
   fail("M3C_RESERVA_CONCORRENTE");
  await tx.criacaoPreparacaoUnificada.updateMany({where:{
   reservaId:reserva.id,status:"PREPARADA"
  },data:{status:"INVALIDADA",invalidadaEm:now}});
  return result(audit,false,contextoExecucao);
}
