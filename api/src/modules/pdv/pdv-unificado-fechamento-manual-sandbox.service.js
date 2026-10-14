/**
 * PointVet M.3B — fechamento MANUAL em transação SERIALIZABLE exclusivamente
 * no PostgreSQL descartável pointvet_unified_ci. Sem HTTP, fiscal, PSP ou
 * utilização de crédito do cliente. NÃO executar no ambiente Pet King.
 *
 * Uma comanda pode conter CNPJs diferentes, mas cada Venda, Pagamento, caixa
 * e movimento de estoque pertence a UMA empresa. TUDO confirma ou TUDO volta.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {consultarReservaFechamento} from "./pdv-unificado.service.js";
import {centavosExatos,planejarEfetivacaoManualUnificada}
 from "./pdv-unificado-fechamento-manual.contract.js";

const BANCO_CI="pointvet_unified_ci";
const dinheiro=n=>`${Math.floor(n/100)}.${String(n%100).padStart(2,"0")}`;
const mil=n=>Math.round(Number(n)*1000);
function falha(m){throw Error(m);}
function compararItens(comanda,snapshot,vendas){
 const vistos=new Set();
 for(const op of snapshot.operacoes){
  const venda=vendas.find(v=>v.empresaId===op.empresaId);
  if(!venda||venda.itens.length!==op.itens.length)falha("M3_ITENS_DIVERGENTES");
  for(const snap of op.itens){
   const original=comanda.itens.find(i=>i.id===snap.comandaItemId);
   const vendido=venda.itens.find(i=>i.comandaItemId===snap.comandaItemId);
   if(!original||!vendido||vistos.has(original.id)||
      original.empresaId!==op.empresaId||original.status!=="ATIVO"||
      !original.itemCatalogo?.ativo||original.itemCatalogo.empresaId!==op.empresaId||
      original.itemCatalogoId!==snap.itemCatalogoId||
      (original.petId||null)!==(snap.petId||null)||
      (original.petId&&(!original.pet?.ativo||original.pet.clienteId!==comanda.clienteId))||
      (original.itemCatalogo.servico?.exigePet&&!original.petId)||
      centavosExatos(original.itemCatalogo.precoVenda)!==centavosExatos(snap.valorUnitario)||
      centavosExatos(original.valorUnitario)!==centavosExatos(snap.valorUnitario)||
      centavosExatos(original.valorTotal)!==centavosExatos(snap.valorTotal)||
      mil(original.quantidade)!==mil(snap.quantidade)||
      mil(vendido.quantidade)!==mil(snap.quantidade)||
      vendido.itemCatalogoId!==snap.itemCatalogoId||
      (vendido.petId||null)!==(snap.petId||null)||
      centavosExatos(vendido.valorTotal)!==centavosExatos(snap.valorTotal))
    falha("M3_ITENS_DIVERGENTES");
   vistos.add(original.id);
  }
 }
 if(vistos.size!==comanda.itens.length)falha("M3_ITENS_INCOMPLETOS");
}
/** Lote FEFO e saldo são abatidos dentro da MESMA transação, com checagem de saldo. */
async function baixarEstoqueEmpresa(tx,{op,usuarioId}){
 const itemIds=op.itens.map(i=>i.itemCatalogoId);
 const produtos=await tx.produto.findMany({where:{itemId:{in:itemIds}}});
 const byItem=new Map(produtos.map(p=>[p.itemId,p]));
 const quantidades=new Map();
 for(const item of op.itens){
  const produto=byItem.get(item.itemCatalogoId);
  if(!produto?.controlaEstoque)continue;
  const quant=mil(item.quantidade);
  if(!Number.isSafeInteger(quant)||quant<=0)falha("M3_QUANTIDADE_INVALIDA");
  const p=quantidades.get(produto.id)||{produto,unidades:0};
  p.unidades+=quant;quantidades.set(produto.id,p);
 }
 for(const {produto,unidades} of [...quantidades.values()].sort((a,b)=>a.produto.id.localeCompare(b.produto.id))){
  const total=unidades/1000;
  await tx.$queryRaw`SELECT "id" FROM "estoque_saldos" WHERE "produtoId"=${produto.id} FOR UPDATE`;
  const saldo=await tx.estoqueSaldo.findUnique({where:{produtoId:produto.id}});
  if(!saldo||mil(saldo.quantidade)<unidades)falha("M3_ESTOQUE_INSUFICIENTE");
  // Lock is per product. A concurrent close cannot deduct the same stock.
  const alterado=await tx.estoqueSaldo.updateMany({
   where:{produtoId:produto.id,quantidade:{gte:total}},
   data:{quantidade:{decrement:total}}
  });
  if(alterado.count!==1)falha("M3_ESTOQUE_CONCORRENTE");
  const antigo=mil(saldo.quantidade);
  if(!produto.controlaLote){
   await tx.movimentacaoEstoque.create({data:{
    empresaId:op.empresaId,produtoId:produto.id,usuarioId,tipo:"VENDA",
    quantidade:total,saldoAnterior:antigo/1000,saldoPosterior:(antigo-unidades)/1000,
    custoUnitario:produto.custoMedio,origemTipo:"VENDA",origemId:op.vendaId
   }});
   continue;
  }
  let restante=unidades,consumido=0;
  const hoje=new Date();hoje.setUTCHours(0,0,0,0);
  const lotes=await tx.loteProduto.findMany({where:{produtoId:produto.id,
   quantidadeAtual:{gt:0},OR:[{dataValidade:null},{dataValidade:{gte:hoje}}]},
   orderBy:[{dataValidade:"asc"},{createdAt:"asc"}]});
  for(const lote of lotes){
   if(!restante)break;
   const retirar=Math.min(restante,mil(lote.quantidadeAtual));
   if(retirar<=0)continue;
   const changed=await tx.loteProduto.updateMany({
    where:{id:lote.id,quantidadeAtual:{gte:retirar/1000}},
    data:{quantidadeAtual:{decrement:retirar/1000}}
   });
   if(changed.count!==1)falha("M3_LOTE_CONCORRENTE");
   await tx.movimentacaoEstoque.create({data:{
    empresaId:op.empresaId,produtoId:produto.id,loteId:lote.id,usuarioId,
    tipo:"VENDA",quantidade:retirar/1000,
    saldoAnterior:(antigo-consumido)/1000,saldoPosterior:(antigo-consumido-retirar)/1000,
    custoUnitario:produto.custoMedio,origemTipo:"VENDA",origemId:op.vendaId
   }});
   restante-=retirar;consumido+=retirar;
  }
  if(restante!==0)falha("M3_ESTOQUE_LOTE_INSUFICIENTE");
 }
}
/** Replay must prove that ALL companies finished and every line points to one payment. */
async function conferirReplay(tx,{operacoes,registro}){
 if(!operacoes.every(o=>o.status==="CONCLUIDA"&&o.vendaId))
  falha("M3_ESTADO_PARCIAL_REQUER_REVISAO");
 const vendas=await tx.venda.findMany({where:{id:{in:operacoes.map(o=>o.vendaId)}}});
 if(vendas.length!==operacoes.length||vendas.some(v=>v.status!=="FINALIZADA"||
    !operacoes.some(o=>o.vendaId===v.id&&o.empresaId===v.empresaId)))
  falha("M3_REPLAY_INCONSISTENTE");
 if(!registro.linhas.length||registro.linhas.some(l=>!l.pagamentoId))
  falha("M3_REPLAY_INCONSISTENTE");
 const pagamentos=await tx.pagamento.findMany({where:{id:{in:registro.linhas.map(l=>l.pagamentoId)}}});
 if(pagamentos.length!==registro.linhas.length)falha("M3_REPLAY_INCONSISTENTE");
 const parcelas=await tx.parcelaRecebivelManualUnificado.findMany({
  where:{linhaId:{in:registro.linhas.map(l=>l.id)}}
 });
 for(const line of registro.linhas){
  const op=operacoes.find(o=>o.id===line.operacaoId);
  const pay=pagamentos.find(p=>p.id===line.pagamentoId);
  if(!op||!pay||pay.vendaId!==op.vendaId||pay.forma!==line.forma||
     pay.sessaoCaixaId!==line.sessaoCaixaId||
     centavosExatos(pay.valor)!==centavosExatos(line.valor))
    falha("M3_REPLAY_INCONSISTENTE");
  const lanc=parcelas.filter(p=>p.linhaId===line.id);
  if(line.forma==="CARTAO_CREDITO"){
   if(lanc.length!==line.parcelas||
     lanc.reduce((s,p)=>s+centavosExatos(p.valor),0)!==centavosExatos(line.valor))
    falha("M3_REPLAY_INCONSISTENTE");
  }else if(lanc.length)falha("M3_REPLAY_INCONSISTENTE");
 }
 return {reutilizada:true,pagamentosCriados:false,estoqueMovimentado:false,
  vendas:operacoes.map(o=>({empresaId:o.empresaId,vendaId:o.vendaId,status:o.status})),
  parcelasAReceber:parcelas.length,emissaoFiscal:false,execucaoRealHabilitada:false};
}
/**
 * M.3B — pagamento é informado externamente pelo atendente, SEM PSP.
 * Nunca chamar pelo HTTP ou em banco de produção.
 * "simularFalhaAposEmpresaId" prova o rollback integral, inclusive estoque.
 */
export async function efetivarRecebimentosManuaisSomenteSandbox({
 organizacaoId,usuarioId,empresaId,id,versao,simularFalhaAposEmpresaId=null
}){
 exigirBancoIsolado();
 return prisma.$transaction(async tx=>{
  const nome=await tx.$queryRaw`SELECT current_database() AS nome`;
  if(nome[0]?.nome!==BANCO_CI)falha("BANCO_NAO_ISOLADO");
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${id} FOR UPDATE`;
  const comanda=await tx.comanda.findFirst({where:{
   id,rascunhoUnificado:true,cliente:{organizacaoId}},
   include:{itens:{include:{itemCatalogo:{include:{servico:true}},pet:true}}}
  });
  if(!comanda)falha("RASCUNHO_NAO_ENCONTRADO");
  if(comanda.versaoRascunho!==versao)falha("RASCUNHO_DESATUALIZADO");
  const reserva=await consultarReservaFechamento({organizacaoId,usuarioId,empresaId,id,versao},tx);
  if(!reserva||reserva.status!=="RESERVADA")falha("RESERVA_NAO_EDITAVEL");
  const registro=await tx.registroRecebimentoManualUnificado.findUnique({
   where:{reservaId:reserva.id},include:{linhas:true}
  });
  if(!registro||registro.status!=="REGISTRADO")falha("M3_REGISTRO_AUSENTE");
  const operacoes=await tx.reservaOperacaoUnificada.findMany({
   where:{reservaId:reserva.id},orderBy:{empresaId:"asc"}
  });
  if(operacoes.every(o=>o.status==="CONCLUIDA"))return conferirReplay(tx,{operacoes,registro});
  if(comanda.status!=="ABERTA"||
     operacoes.some(o=>o.status!=="VENDA_RASCUNHO"||!o.vendaId))
   falha("M3_ESTADO_PARCIAL_REQUER_REVISAO");
  const prep=await tx.criacaoPreparacaoUnificada.findUnique({where:{reservaId:reserva.id}});
  if(!prep||prep.status!=="PREPARADA"||prep.snapshot.clienteId!==comanda.clienteId)
   falha("M3_PREPARACAO_INVALIDA");
  const vendas=await tx.venda.findMany({where:{id:{in:operacoes.map(o=>o.vendaId)}},
   include:{itens:true}});
  const plano=planejarEfetivacaoManualUnificada({
   reserva,snapshot:prep.snapshot,registro,operacoes,vendas
  });
  compararItens(comanda,prep.snapshot,vendas);
  // Locks ordered across all companies; no closed/foreign session can receive money.
  const sessoes=[...new Set(plano.operacoes.flatMap(o=>o.pagamentos.map(p=>p.sessaoCaixaId)))].sort();
  for(const caixaId of sessoes){
   await tx.$queryRaw`SELECT "id" FROM "sessoes_caixa" WHERE "id"=${caixaId} FOR UPDATE`;
  }
  const abertas=await tx.sessaoCaixa.findMany({where:{id:{in:sessoes}},
   select:{id:true,status:true,caixa:{select:{empresaId:true,ativo:true}}}});
  for(const op of plano.operacoes){
   if(op.pagamentos.some(p=>!abertas.some(c=>c.id===p.sessaoCaixaId&&
       c.status==="ABERTO"&&c.caixa.ativo&&c.caixa.empresaId===op.empresaId)))
    falha("M3_CAIXA_INVALIDO");
  }
  const agora=new Date();
  let quantidadePagamentos=0,quantidadeParcelas=0;
  for(const op of plano.operacoes){
   for(const declarado of op.pagamentos){
    const pagamento=await tx.pagamento.create({data:{
     vendaId:op.vendaId,sessaoCaixaId:declarado.sessaoCaixaId,
     forma:declarado.forma,status:declarado.statusPagamento,
     valor:dinheiro(declarado.valorCentavos),parcelas:declarado.numeroParcelas,
     observacoes:`M.3B CI — registro manual ${registro.id}; linha ${declarado.linhaId}`,
     pagoEm:declarado.statusPagamento==="APROVADO"?agora:null
    }});
    const link=await tx.linhaRecebimentoManualUnificado.updateMany({
     where:{id:declarado.linhaId,pagamentoId:null},data:{pagamentoId:pagamento.id}
    });
    if(link.count!==1)falha("M3_LINHA_CONSUMIDA");
    quantidadePagamentos++;
    if(declarado.parcelasAReceber.length){
     await tx.parcelaRecebivelManualUnificado.createMany({data:
      declarado.parcelasAReceber.map(parcela=>({
       linhaId:declarado.linhaId,indice:parcela.numero,
       quantidadeTotal:parcela.totalParcelas,valor:dinheiro(parcela.valorCentavos),
       status:"AGUARDANDO_REPASSE"
      }))
     });
     quantidadeParcelas+=declarado.parcelasAReceber.length;
    }
    // Tipo VENDA é trilha de auditoria, ignorada no cálculo de fecharCaixa.
    if(declarado.movimentoCaixaSomenteAuditoria){
     await tx.movimentacaoCaixa.create({data:{
      sessaoCaixaId:declarado.sessaoCaixaId,usuarioId,tipo:"VENDA",
      valor:dinheiro(declarado.valorCentavos),
      descricao:"Registro manual de dinheiro em venda unificada (auditoria, não suprimento)",
      referenciaTipo:"PAGAMENTO",referenciaId:pagamento.id
     }});
    }
   }
   await baixarEstoqueEmpresa(tx,{op,usuarioId});
   const updated=await tx.venda.updateMany({where:{id:op.vendaId,status:"ABERTA",
    empresaId:op.empresaId},data:{status:"FINALIZADA",finalizadaEm:agora,
    observacoes:"POINTVET M.3B SANDBOX — fiscal pendente, sem emissão"}});
   if(updated.count!==1)falha("M3_VENDA_CONCORRENTE");
   const updatedOp=await tx.reservaOperacaoUnificada.updateMany({
    where:{id:op.operacaoId,reservaId:reserva.id,status:"VENDA_RASCUNHO",
     vendaId:op.vendaId},data:{status:"CONCLUIDA"}
   });
   if(updatedOp.count!==1)falha("M3_OPERACAO_CONCORRENTE");
   if(simularFalhaAposEmpresaId===op.empresaId)falha("M3_FALHA_SIMULADA_TRANSACAO");
  }
  const ids=prep.snapshot.operacoes.flatMap(op=>op.itens.map(i=>i.comandaItemId));
  const changed=await tx.comandaItem.updateMany({where:{
   id:{in:ids},comandaId:id,status:"ATIVO"
  },data:{status:"FATURADO"}});
  if(changed.count!==ids.length)falha("M3_COMANDA_ITEM_CONCORRENTE");
  const updatedDraft=await tx.comanda.updateMany({where:{
   id,versaoRascunho:versao,status:"ABERTA",rascunhoUnificado:true
  },data:{status:"FECHADA",fechadaEm:agora}});
  if(updatedDraft.count!==1)falha("M3_COMANDA_CONCORRENTE");
  return {reutilizada:false,pagamentosCriados:quantidadePagamentos,
   parcelasAReceber:quantidadeParcelas,estoqueMovimentado:true,
   vendas:plano.operacoes.map(o=>({empresaId:o.empresaId,vendaId:o.vendaId,status:"CONCLUIDA"})),
   emissaoFiscal:false,execucaoRealHabilitada:false,creditoClienteUtilizado:false,
   mensagem:"Somente CI: sem fiscal e sem integração do recebível com conciliação real."};
 },{isolationLevel:"Serializable",maxWait:10000,timeout:30000});
}
