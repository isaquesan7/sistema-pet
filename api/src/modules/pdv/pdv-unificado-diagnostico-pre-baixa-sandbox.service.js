/**
 * PointVet M.5.12 — read-only dossier integrity check over CI PostgreSQL.
 * No route, ledger update, bank access, fiscal action or production effect.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {avaliarDossiePreBaixaM512} from "./pdv-unificado-diagnostico-pre-baixa.contract.js";
const fail=x=>{throw Error("M512_"+x);};
export async function diagnosticarPreBaixaSomenteSandbox({
 organizacaoId,empresaId,usuarioId,preparacaoId
}={}){
 exigirBancoIsolado();
 if([organizacaoId,empresaId,usuarioId,preparacaoId].some(
  x=>typeof x!=="string"||!x.trim()))fail("CONTEXTO_INVALIDO");
 return prisma.$transaction(async tx=>{
  const db=await tx.$queryRaw`SELECT current_database() AS nome`;
  if(db[0]?.nome!=="pointvet_unified_ci")fail("BANCO_NAO_ISOLADO");
  const [user,org,membro,vinculo]=await Promise.all([
   tx.usuario.findUnique({where:{id:usuarioId},select:{status:true}}),
   tx.organizacao.findUnique({where:{id:organizacaoId},select:{ativo:true}}),
   tx.usuarioOrganizacao.findUnique({where:{
    usuarioId_organizacaoId:{usuarioId,organizacaoId}},select:{ativo:true}}),
   tx.usuarioEmpresa.findUnique({where:{
    usuarioId_empresaId:{usuarioId,empresaId}
   },include:{empresa:{select:{ativo:true,organizacaoId:true}},
    cargo:{include:{permissoes:{include:{permissao:{select:{codigo:true}}}}}}}})
  ]);
  if(user?.status!=="ATIVO"||!org?.ativo||!membro?.ativo||
    !vinculo?.ativo||!vinculo.empresa?.ativo||
    vinculo.empresa.organizacaoId!==organizacaoId||
    !vinculo.cargo?.ativo||
    !vinculo.cargo.permissoes.some(p=>p.permissao.codigo==="financeiro.gerenciar"))
   fail("SEM_PERMISSAO_FINANCEIRA");
  return avaliarIntegridadePreBaixaNoTxM513(tx,{organizacaoId,empresaId,preparacaoId});
 },{isolationLevel:"RepeatableRead",maxWait:8000,timeout:15000});
}

/**
 * Internal shared query. Its caller MUST already have authenticated role,
 * disposable-DB guard and a scoped transaction (M.5.12 or M.5.13).
 */
export async function avaliarIntegridadePreBaixaNoTxM513(tx,{
 organizacaoId,empresaId,preparacaoId
}){
  const preparacao=await tx.preparacaoBaixaCartaoManualUnificada.findFirst({
   where:{id:preparacaoId,empresaId,organizacaoId},
   include:{parcelas:true,parecerDocumental:true}
  });
  if(!preparacao)fail("PREPARACAO_NAO_ENCONTRADA");
  const [comanda,conta]=await Promise.all([
   tx.comanda.findFirst({where:{
    id:preparacao.comandaId,cliente:{organizacaoId}
   },select:{id:true,status:true,rascunhoUnificado:true}}),
   tx.contaFinanceira.findFirst({where:{
    id:preparacao.contaFinanceiraId,empresaId
   },select:{id:true,empresaId:true,ativo:true,tipo:true}})
  ]);
  const ids=preparacao.parcelas.map(p=>p.parcelaId);
  const [parts,prepAudit,reviewAudit,declarations]=await Promise.all([
   tx.parcelaRecebivelManualUnificado.findMany({where:{id:{in:ids}},
    include:{linha:{include:{
     pagamento:{select:{status:true}},
     operacao:{include:{
      venda:{select:{status:true}},reserva:{select:{comandaId:true,status:true}}
     }}
    }}}
   }),
   tx.auditoria.findMany({where:{organizacaoId,empresaId,
    entidade:"PreparacaoBaixaCartaoManualUnificada",entidadeId:preparacao.id,
    acao:"PRE_BAIXA_CARTAO_PREPARADA_CI"},
    select:{organizacaoId:true,empresaId:true,usuarioId:true,entidadeId:true,dadosNovos:true}}),
   tx.auditoria.findMany({where:{organizacaoId,empresaId,
    entidade:"ParecerPreBaixaCartaoManualUnificada",
    entidadeId:preparacao.parecerDocumental?.id||"m512-no-review",
    acao:"PRE_BAIXA_CARTAO_CONFERENCIA_DOCUMENTAL_CI"},
    select:{organizacaoId:true,empresaId:true,usuarioId:true,entidadeId:true,dadosNovos:true}}),
   tx.auditoria.findMany({where:{organizacaoId,empresaId,
    entidade:"ParcelaRecebivelManualUnificado",
    entidadeId:{in:ids},acao:"REPASSE_CARTAO_CONCILIADO_MANUAL_CI"},
    select:{organizacaoId:true,empresaId:true,usuarioId:true,entidadeId:true,dadosNovos:true}})
  ]);
  return avaliarDossiePreBaixaM512({
   organizacaoId,empresaId,preparacao,parecer:preparacao.parecerDocumental,
   comanda:comanda?{...comanda,organizacaoId}:null,conta,
   parcelas:parts.map(p=>({
    id:p.id,valor:p.valor,status:p.status,conciliadoEm:p.conciliadoEm,
    empresaId:p.linha?.operacao?.empresaId,
    comandaId:p.linha?.operacao?.reserva?.comandaId,
    forma:p.linha?.forma,pagamentoStatus:p.linha?.pagamento?.status,
    vendaStatus:p.linha?.operacao?.venda?.status,
    operacaoStatus:p.linha?.operacao?.status,
    reservaStatus:p.linha?.operacao?.reserva?.status
   })),
   auditoriasPreparacao:prepAudit,auditoriasParecer:reviewAudit,
   auditoriasDeclaracao:declarations
  });

}
