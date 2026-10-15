/**
 * PointVet M.5.22: CI-ONLY log of employee-ATTESTED external customer refunds.
 * This records assertions, not bank verifications, transfers, cash, fiscal refunds.
 * No HTTP route, no changes to Payment/Venda/ConciliacaoFinanceira.
 * Same-comanda row lock and Serializable transactions serialize partials.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {validarDeclaracaoDevolucaoM522,conferirLimiteAcumuladoM522}
 from "./pdv-unificado-devolucao-declarada.contract.js";
const fail=x=>{throw Error("M522_"+x);};
const money=v=>{
 const [whole,fract=""]=String(v).split(".");
 return whole+"."+fract.padEnd(2,"0");
};
const projection=(row,remaining,reused)=>Object.freeze({
 id:row.id,organizacaoId:row.organizacaoId,empresaId:row.empresaId,
 preparacaoId:row.preparacaoId,conciliacaoOrigemId:row.conciliacaoOrigemId,
 referenciaExterna:row.referenciaExterna,valorBruto:money(row.valorBruto),
 saldoBrutoRestante:remaining,registroReutilizado:reused,
 status:"DEVOLUCAO_EXTERNA_DECLARADA_NAO_VERIFICADA",
 comprovacaoBancariaIndependente:false,
 transferenciaPeloPointVet:false,gerouSaidaCaixa:false,
 alterouSaldoConciliado:false,aprovouPagamento:false,
 alterouVenda:false,emitiuEstornoFiscal:false,
 reconheceuTarifas:false,checkoutLiberado:false
});
async function authorize(tx,{organizacaoId,empresaId,usuarioId}){
 const [user,org,member,company]=await Promise.all([
  tx.usuario.findUnique({where:{id:usuarioId},select:{status:true}}),
  tx.organizacao.findUnique({where:{id:organizacaoId},select:{ativo:true}}),
  tx.usuarioOrganizacao.findUnique({where:{usuarioId_organizacaoId:{
   usuarioId,organizacaoId}},select:{ativo:true}}),
  tx.usuarioEmpresa.findUnique({where:{usuarioId_empresaId:{
   usuarioId,empresaId}},include:{
    empresa:{select:{organizacaoId:true,ativo:true}},
    cargo:{include:{permissoes:{include:{permissao:{select:{codigo:true}}}}}}
  }})
 ]);
 const granted=new Set(company?.cargo?.permissoes?.map(x=>x.permissao.codigo)||[]);
 if(user?.status!=="ATIVO"||!org?.ativo||!member?.ativo||
    !company?.ativo||!company.empresa?.ativo||
    company.empresa.organizacaoId!==organizacaoId||
    !company.cargo?.ativo||
    !granted.has("financeiro.gerenciar")||
    !granted.has("pdv.cancelar_venda"))
  fail("ACESSO_NEGADO");
}
export async function registrarDevolucaoExternaDeclaradaSomenteSandbox({
 organizacaoId,empresaId,usuarioId,preparacaoId,dados={},
 simularFalhaAposRegistro=false
}={}){
 exigirBancoIsolado();
 if([organizacaoId,empresaId,usuarioId,preparacaoId].some(
  v=>typeof v!=="string"||!v.trim()))
  fail("CONTEXTO_INVALIDO");
 return prisma.$transaction(async tx=>{
  if((await tx.$queryRaw`SELECT current_database() AS nome`)[0]?.nome!=="pointvet_unified_ci")
   fail("BANCO_NAO_ISOLADO");
  const lookup=await tx.preparacaoBaixaCartaoManualUnificada.findFirst({
   where:{id:preparacaoId,organizacaoId,empresaId},
   select:{comandaId:true}
  });
  if(!lookup)fail("PREPARACAO_NAO_ENCONTRADA");
  // Consistent global lock order with M.3C and M.5.13/M.5.14.
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${lookup.comandaId} FOR UPDATE`;
  await authorize(tx,{organizacaoId,empresaId,usuarioId});
  const pre=await tx.preparacaoBaixaCartaoManualUnificada.findFirst({
   where:{id:preparacaoId,organizacaoId,empresaId,
    status:"PREPARADA_SEM_BAIXA"},
   include:{parecerDocumental:true}
  });
  if(!pre)fail("PREPARACAO_INVALIDA");
  const entry=await tx.conciliacaoFinanceira.findUnique({
   where:{origem_origemId:{origem:"REPASSE_CARTAO_MANUAL_UNIFICADO",
    origemId:pre.id}}
  });
  if(!entry)fail("REPASSE_INTERNO_NAO_CONFIRMADO");
  if(await tx.conciliacaoFinanceira.count({where:{
   origem:"ESTORNO_REPASSE_CARTAO_MANUAL_UNIFICADO",origemId:entry.id
  }}))fail("REPASSE_INTERNO_COMPENSADO");
  if(await tx.estornoFechamentoManualUnificado.count({
   where:{reserva:{comandaId:pre.comandaId}}
  }))fail("ESTORNO_INTEGRAL_ANTERIOR_EXIGE_REVISAO");
  const audit=await tx.auditoria.findMany({where:{
   organizacaoId,empresaId,acao:"REPASSE_CARTAO_MANUAL_CONFIRMADO_CI",
   entidade:"CONCILIACAO_FINANCEIRA",entidadeId:entry.id
  },select:{usuarioId:true,dadosNovos:true}});
  if(audit.length!==1||audit[0].usuarioId!==entry.usuarioId||
     audit[0].dadosNovos?.origemId!==pre.id)
   fail("REPASSE_SEM_AUDITORIA_VALIDA");
  const validated=validarDeclaracaoDevolucaoM522({
   organizacaoId,empresaId,usuarioId,preparacao:pre,
   parecer:pre.parecerDocumental,entrada:entry,dados
  });
  const history=await tx.devolucaoClienteManualUnificada.findMany({
   where:{organizacaoId,empresaId,preparacaoId},
   orderBy:[{createdAt:"asc"},{id:"asc"}],take:501
  });
  if(history.length>500)fail("HISTORICO_ACIMA_DO_LIMITE");
  const existing=await tx.devolucaoClienteManualUnificada.findUnique({
   where:{empresaId_referenciaExterna:{empresaId,
    referenciaExterna:validated.referenciaExterna}}
  });
  // Replay may carry its old optimistic remaining-balance precondition.
  // Never treat a replay as a NEW refund and never delete historical rows.
  if(existing){
   const logs=await tx.auditoria.findMany({where:{
    organizacaoId,empresaId,entidade:"DEVOLUCAO_CLIENTE_MANUAL",
    entidadeId:existing.id,acao:"DEVOLUCAO_EXTERNA_DECLARADA_CI"
   }});
   if(existing.preparacaoId!==pre.id||
      existing.conciliacaoOrigemId!==entry.id||
      existing.usuarioId!==usuarioId||
      existing.fingerprint!==validated.fingerprint||
      existing.confirmacaoHumanaExterna!==true||logs.length!==1||
      logs[0].dadosNovos?.fingerprint!==existing.fingerprint)
    fail("REFERENCIA_JA_UTILIZADA_COM_DADOS_DIVERGENTES");
   const sum=history.reduce((n,row)=>n+Number(row.valorBruto)*100,0);
   if(!Number.isSafeInteger(sum)||sum>Number(pre.bruto)*100)
    fail("HISTORICO_FINANCEIRO_DIVERGENTE");
   const remaining=Number(pre.bruto)*100-sum;
   return projection(existing,money(remaining/100),true);
  }
  const remainder=conferirLimiteAcumuladoM522({
   bruto:money(pre.bruto),anteriores:history.map(row=>({
    referenciaExterna:row.referenciaExterna,
    valorBruto:money(row.valorBruto),
    confirmacaoHumanaExterna:row.confirmacaoHumanaExterna
   })),
   novoValor:validated.valorBruto,
   saldoRestanteBrutoEsperado:validated.saldoRestanteBrutoEsperado
  });
  const created=await tx.devolucaoClienteManualUnificada.create({data:{
   organizacaoId,empresaId,comandaId:pre.comandaId,preparacaoId:pre.id,
   conciliacaoOrigemId:entry.id,usuarioId,
   referenciaExterna:validated.referenciaExterna,
   valorBruto:validated.valorBruto,motivo:validated.motivo,
   confirmacaoHumanaExterna:true,codigoRevisao:validated.codigoRevisao,
   fingerprint:validated.fingerprint,
   snapshot:{status:"DECLARACAO_HUMANA_NAO_VERIFICADA_PELO_BANCO",
    saldoAntes:validated.saldoRestanteBrutoEsperado,
    saldoDepois:remainder.restanteDepois,
    motivo:validated.motivo,
    naoHaComprovacaoAutomatica:true,
    naoAlteraCaixaFinanceiroFiscal:true}
  }});
  await tx.auditoria.create({data:{
   organizacaoId,empresaId,usuarioId,
   entidade:"DEVOLUCAO_CLIENTE_MANUAL",entidadeId:created.id,
   acao:"DEVOLUCAO_EXTERNA_DECLARADA_CI",
   dadosNovos:{fingerprint:validated.fingerprint,
    preparacaoId:pre.id,conciliacaoOrigemId:entry.id,
    referenciaExterna:validated.referenciaExterna,
    valorBruto:validated.valorBruto,
    saldoAnterior:remainder.totalAnterior,
    saldoRestante:remainder.restanteDepois,
    declarouDevolucaoExterna:true,
    comprovacaoAutomaticaBanco:false,
    semMutacaoFinanceiraFiscal:true}
  }});
  if(simularFalhaAposRegistro)fail("ROLLBACK_SIMULADO");
  return projection(created,remainder.restanteDepois,false);
 },{isolationLevel:"Serializable",maxWait:10000,timeout:30000});
}
