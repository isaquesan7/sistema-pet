/**
 * PointVet M.5.10 — persistência idempotente de PRE-BAIXA de cartão, CI ONLY.
 * Não é liquidação contábil, não verifica extrato e nunca credita conta.
 * Banco descartável, transaction Serializable, comanda bloqueada, unique DB
 * por referencia externa da empresa e por parcela globalmente.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {consolidarRecebiveisCartaoM56} from "./pdv-unificado-resumo-recebiveis.contract.js";
import {planejarBaixaCartaoM59} from "./pdv-unificado-baixa-cartao.contract.js";
const fail=x=>{throw Error("M510_"+x);};
const response=(data,reutilizada)=>Object.freeze({
 preparacaoId:data.id,organizacaoId:data.organizacaoId,empresaId:data.empresaId,
 comandaId:data.comandaId,status:data.status,fingerprint:data.fingerprint,
 parcelas:data.parcelas.map(p=>p.parcelaId).sort(),reutilizada,
 valorBruto:String(data.bruto),valorLiquidoDeclarado:String(data.liquidoDeclarado),
 verificacaoBancariaIndependente:false,apenasPreBaixa:true,
 alterouPagamento:false,creditouBanco:false,gerouConciliacao:false,
 gerouMovimentoCaixa:false,gerouTitulo:false,emitiuDocumentoFiscal:false,
 autorizadoEmProducao:false
});
async function verifyRole(tx,{organizacaoId,empresaId,usuarioId}){
 const [user,org,membro,vinculo]=await Promise.all([
  tx.usuario.findUnique({where:{id:usuarioId},select:{status:true}}),
  tx.organizacao.findUnique({where:{id:organizacaoId},select:{ativo:true}}),
  tx.usuarioOrganizacao.findUnique({where:{
   usuarioId_organizacaoId:{usuarioId,organizacaoId}},select:{ativo:true}}),
  tx.usuarioEmpresa.findUnique({where:{usuarioId_empresaId:{usuarioId,empresaId}},
   include:{empresa:{select:{organizacaoId:true,ativo:true}},
    cargo:{include:{permissoes:{include:{permissao:{select:{codigo:true}}}}}}}})
 ]);
 if(user?.status!=="ATIVO"||!org?.ativo||!membro?.ativo||!vinculo?.ativo||
    vinculo.empresa?.organizacaoId!==organizacaoId||!vinculo.empresa?.ativo||
    !vinculo.cargo?.ativo||!vinculo.cargo.permissoes.some(
     p=>p.permissao.codigo==="financeiro.gerenciar"))
  fail("ACESSO_FINANCEIRO_NEGADO");
}
export async function registrarPreBaixaCartaoSomenteSandbox({
 organizacaoId,empresaId,usuarioId,comandaId,pedido,
 simularFalhaAposRegistro=false
}={}){
 exigirBancoIsolado();
 if([organizacaoId,empresaId,usuarioId,comandaId].some(
  x=>typeof x!=="string"||!x.trim()))fail("CONTEXTO_INVALIDO");
 return prisma.$transaction(async tx=>{
  const db=await tx.$queryRaw`SELECT current_database() AS nome`;
  if(db[0]?.nome!=="pointvet_unified_ci")fail("BANCO_NAO_ISOLADO");
  // Same comanda lock order as M3C reversal and M5.5 parcel reconciliation.
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${comandaId} FOR UPDATE`;
  await verifyRole(tx,{organizacaoId,empresaId,usuarioId});
  const comanda=await tx.comanda.findFirst({where:{
   id:comandaId,status:"FECHADA",rascunhoUnificado:true,
   cliente:{organizacaoId}
  },select:{id:true,status:true}});
  if(!comanda)fail("COMANDA_INDISPONIVEL");
  const account=await tx.contaFinanceira.findFirst({where:{
   id:pedido?.contaFinanceiraId,empresaId,ativo:true,tipo:"BANCO"
  },select:{id:true}});
  if(!account)fail("CONTA_FORA_DA_EMPRESA");
  const linhas=await tx.linhaRecebimentoManualUnificado.findMany({
   where:{forma:"CARTAO_CREDITO",operacao:{empresaId,reserva:{comandaId}}},
   include:{
    pagamento:{select:{id:true,forma:true,status:true,valor:true,parcelas:true,vendaId:true}},
    registro:{select:{status:true}},
    operacao:{include:{
     venda:{select:{id:true,empresaId:true,status:true}},
     reserva:{select:{comandaId:true,status:true}}
    }},
    parcelasRecebiveis:{orderBy:{indice:"asc"}}
   },orderBy:{id:"asc"}
  });
  const parcelIds=linhas.flatMap(l=>l.parcelasRecebiveis.map(p=>p.id));
  const auditorias=parcelIds.length?await tx.auditoria.findMany({where:{
   organizacaoId,empresaId,acao:"REPASSE_CARTAO_CONCILIADO_MANUAL_CI",
   entidade:"ParcelaRecebivelManualUnificado",entidadeId:{in:parcelIds}
  },select:{acao:true,entidade:true,entidadeId:true,empresaId:true,
   organizacaoId:true,dadosNovos:true}}):[];
  const resumo=consolidarRecebiveisCartaoM56({organizacaoId,empresaId,comandaId,
   linhas:linhas.map(l=>({...l,comandaStatus:comanda.status})),auditorias});
  const plano=planejarBaixaCartaoM59({resumo,pedido});
  const previous=await tx.preparacaoBaixaCartaoManualUnificada.findUnique({
   where:{empresaId_referenciaExtrato:{
    empresaId,referenciaExtrato:plano.referenciaExtrato}},
   include:{parcelas:true}
  });
  if(previous){
   if(previous.fingerprint!==plano.fingerprint||
      previous.organizacaoId!==organizacaoId||previous.comandaId!==comandaId||
      previous.status!=="PREPARADA_SEM_BAIXA"||
      previous.parcelas.length!==plano.parcelas.length||
      !previous.parcelas.every(p=>plano.parcelas.some(q=>q.parcelaId===p.parcelaId)))
    fail("REFERENCIA_DIVERGENTE");
   return response(previous,true);
  }
  const used=await tx.parcelaPreBaixaCartaoManualUnificada.findMany({where:{
   parcelaId:{in:plano.parcelas.map(p=>p.parcelaId)}
  },select:{parcelaId:true}});
  if(used.length)fail("PARCELA_JA_PREPARADA");
  const pre=await tx.preparacaoBaixaCartaoManualUnificada.create({data:{
   organizacaoId,empresaId,comandaId,usuarioId,
   contaFinanceiraId:plano.contaFinanceiraId,
   referenciaExtrato:plano.referenciaExtrato,
   fingerprint:plano.fingerprint,tipo:plano.tipo,
   dataCredito:new Date(plano.dataCredito+"T00:00:00.000Z"),
   bruto:plano.valores.bruto,tarifaCartao:plano.valores.tarifaCartao,
   descontoAntecipacao:plano.valores.descontoAntecipacao,
   liquidoDeclarado:plano.valores.liquidoDeclarado,
   snapshot:{versao:1,fase:plano.fase,parcelas:plano.parcelas,
    valores:plano.valores,declaracaoExternaInformada:true,
    verificacaoBancariaIndependente:false,baixaRealExecutada:false},
   parcelas:{create:plano.parcelas.map(p=>({parcelaId:p.parcelaId}))}
  },include:{parcelas:true}});
  await tx.auditoria.create({data:{
   organizacaoId,empresaId,usuarioId,
   acao:"PRE_BAIXA_CARTAO_PREPARADA_CI",
   entidade:"PreparacaoBaixaCartaoManualUnificada",entidadeId:pre.id,
   dadosNovos:{fingerprint:plano.fingerprint,
    referenciaExtrato:plano.referenciaExtrato,
    parcelas:plano.parcelas.map(p=>p.parcelaId),
    valores:plano.valores,naoCreditouBanco:true,naoBaixouPagamento:true}
  }});
  if(simularFalhaAposRegistro)fail("FALHA_INJETADA_ROLLBACK");
  return response(pre,false);
 },{isolationLevel:"Serializable",maxWait:10000,timeout:30000});
}
