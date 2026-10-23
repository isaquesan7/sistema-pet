/**
 * PointVet M.5.5 — conciliação MANUAL de parcela de cartão, SOMENTE CI.
 * A declaração é humana, NÃO uma confirmação bancária independente.
 * Nenhuma rota HTTP, API de banco, TEF, PSP, email, fiscal, caixa ou estoque.
 * A parcela e a trilha de auditoria são gravadas atomicamente.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {centavosExatos} from "./pdv-unificado-fechamento-manual.contract.js";
import {normalizarConciliacaoManualM55,fingerprintConciliacaoManualM55}
 from "./pdv-unificado-conciliacao-manual.contract.js";
const fail=code=>{throw Error(code);};
async function authorizar(tx,{organizacaoId,empresaId,usuarioId}){
 const [user,org,linkOrg,linkEmpresa]=await Promise.all([
  tx.usuario.findUnique({where:{id:usuarioId},select:{status:true}}),
  tx.organizacao.findUnique({where:{id:organizacaoId},select:{ativo:true}}),
  tx.usuarioOrganizacao.findUnique({where:{usuarioId_organizacaoId:{usuarioId,organizacaoId}}}),
  tx.usuarioEmpresa.findUnique({where:{usuarioId_empresaId:{usuarioId,empresaId}},
   include:{empresa:{select:{organizacaoId:true,ativo:true}},
    cargo:{include:{permissoes:{include:{permissao:true}}}}}})
 ]);
 if(user?.status!=="ATIVO"||!org?.ativo||!linkOrg?.ativo||
    !linkEmpresa?.ativo||!linkEmpresa.empresa?.ativo||
    linkEmpresa.empresa.organizacaoId!==organizacaoId||
    !linkEmpresa.cargo?.ativo||
    !linkEmpresa.cargo.permissoes.some(p=>p.permissao.codigo==="financeiro.gerenciar"))
  fail("M55_SEM_ACESSO_FINANCEIRO");
}
function resultado(parcela,audit,reutilizada){
 return {parcelaId:parcela.id,empresaId:audit.empresaId,status:parcela.status,
  referenciaExterna:audit.dadosNovos.referenciaExterna,
  conciliadoEm:parcela.conciliadoEm,registroAuditId:audit.id,reutilizada,
  confirmacaoAutomaticaBanco:false,houveIntegracaoPSP:false,
  execucaoProducaoHabilitada:false,gerouCaixa:false,gerouPagamento:false,
  gerouDocumentoFiscal:false};
}
export async function conciliarParcelaCartaoSomenteSandbox({
 organizacaoId,empresaId,usuarioId,parcelaId,dados
}){
 exigirBancoIsolado();
 const pedido=normalizarConciliacaoManualM55(dados);
 if(!organizacaoId||!empresaId||!usuarioId||!parcelaId)
  fail("M55_CONTEXTO_INVALIDO");
 return prisma.$transaction(async tx=>{
  const db=await tx.$queryRaw`SELECT current_database() AS nome`;
  if(db[0]?.nome!=="pointvet_unified_ci")fail("M55_BANCO_NAO_ISOLADO");
  // Get comanda identity first, then lock same comanda as M.3C reversal,
  // followed by installment. Re-read all authoritative state after locks.
  const start=await tx.parcelaRecebivelManualUnificado.findUnique({
   where:{id:parcelaId},select:{linha:{select:{operacao:{select:{reserva:{select:{comandaId:true}}}}}}}
  });
  const comandaId=start?.linha?.operacao?.reserva?.comandaId;
  if(!comandaId)fail("M55_PARCELA_NAO_ENCONTRADA");
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${comandaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "parcelas_recebiveis_manual_unificado" WHERE "id"=${parcelaId} FOR UPDATE`;
  const parcela=await tx.parcelaRecebivelManualUnificado.findUnique({where:{id:parcelaId},
   include:{linha:{include:{
    pagamento:{select:{id:true,forma:true,status:true,vendaId:true}},
    registro:{select:{status:true}},
    operacao:{include:{empresa:{select:{organizacaoId:true,ativo:true}},
     reserva:{select:{comandaId:true,status:true}},venda:{select:{id:true,empresaId:true,status:true}}}}
   }}}
  });
  const line=parcela?.linha,op=line?.operacao;
  if(!op||op.empresaId!==empresaId||op.empresa?.organizacaoId!==organizacaoId)
   fail("M55_PARCELA_NAO_ENCONTRADA");
  await authorizar(tx,{organizacaoId,empresaId,usuarioId});
  const account=await tx.contaFinanceira.findFirst({where:{
   id:pedido.contaFinanceiraId,empresaId,ativo:true,tipo:"BANCO"
  }});
  if(!account)fail("M55_CONTA_EMPRESA_INVALIDA");
  const fingerprint=fingerprintConciliacaoManualM55({parcelaId,organizacaoId,empresaId,pedido});
  const existing=await tx.auditoria.findMany({where:{organizacaoId,empresaId,
   entidade:"ParcelaRecebivelManualUnificado",entidadeId:parcelaId,
   acao:"REPASSE_CARTAO_CONCILIADO_MANUAL_CI"}});
  if(parcela.status==="CONCILIADA"){
   if(existing.length!==1||existing[0].dadosNovos?.fingerprint!==fingerprint||
      !parcela.conciliadoEm)fail("M55_REPLAY_DIVERGENTE");
   return resultado(parcela,existing[0],true);
  }
  if(existing.length)fail("M55_AUDITORIA_DIVERGENTE");
  if(parcela.status!=="AGUARDANDO_REPASSE"||parcela.conciliadoEm||
     line.forma!=="CARTAO_CREDITO"||!line.pagamentoId||
     line.pagamento?.forma!=="CARTAO_CREDITO"||line.pagamento.status!=="PENDENTE"||
     line.pagamento.vendaId!==op.vendaId||
     line.registro?.status!=="REGISTRADO"||
     op.status!=="CONCLUIDA"||op.venda?.status!=="FINALIZADA"||
     op.venda?.id!==op.vendaId||op.venda?.empresaId!==empresaId||
     op.reserva?.comandaId!==comandaId||op.reserva.status!=="RESERVADA")
   fail("M55_ESTADO_NAO_CONCILIAVEL");
  const comanda=await tx.comanda.findUnique({where:{id:comandaId},
   select:{status:true,rascunhoUnificado:true}});
  if(!comanda?.rascunhoUnificado||comanda.status!=="FECHADA")
   fail("M55_COMANDA_INVALIDA");
  if(centavosExatos(parcela.valor)!==pedido.valorCentavos)fail("M55_VALOR_DIVERGENTE");
  const at=new Date();
  if((await tx.parcelaRecebivelManualUnificado.updateMany({where:{
   id:parcelaId,status:"AGUARDANDO_REPASSE",conciliadoEm:null
  },data:{status:"CONCILIADA",conciliadoEm:at}})).count!==1)
   fail("M55_CONCORRENCIA_INVALIDA");
  const audit=await tx.auditoria.create({data:{
   organizacaoId,empresaId,usuarioId,acao:"REPASSE_CARTAO_CONCILIADO_MANUAL_CI",
   entidade:"ParcelaRecebivelManualUnificado",entidadeId:parcelaId,
   dadosAnteriores:{status:"AGUARDANDO_REPASSE",valor:String(parcela.valor)},
   dadosNovos:{status:"CONCILIADA",contaFinanceiraId:account.id,
    referenciaExterna:pedido.referenciaExterna,
    confirmouRepasseExterno:true,fingerprint,valorCentavos:pedido.valorCentavos,
    provaBancariaIndependente:false,origem:"DECLARACAO_DO_OPERADOR"}
  }});
  return resultado({...parcela,status:"CONCILIADA",conciliadoEm:at},audit,false);
 },{isolationLevel:"Serializable",maxWait:10000,timeout:30000});
}
