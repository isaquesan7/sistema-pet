/**
 * PointVet M.5.11 — second-person documentary review in isolated CI.
 * The reviewer declares comparison with external evidence; NO evidence
 * bytes, provider/bank API, accounting credit, refund, fiscal or checkout.
 * A single immutable review and its audit are committed atomically.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {validarParecerDocumentalM511} from "./pdv-unificado-parecer-documental.contract.js";
const fail=code=>{throw Error("M511_"+code);};
function result(record,reutilizada){
 return Object.freeze({parecerId:record.id,preparacaoId:record.preparacaoId,
  empresaId:record.empresaId,status:record.status,
  fingerprint:record.fingerprint,reutilizada,
  documentoAnexado:false,conteudoDocumentoValidado:false,
  comprovacaoBancariaIndependente:false,baixouFinanceiro:false,
  creditouBanco:false,aprovouPagamento:false,gerouCaixa:false,
  gerouFiscal:false,liberaProducao:false});
}
async function verifyReviewer(tx,{organizacaoId,empresaId,conferenteId}){
 const [user,org,member,companyMember]=await Promise.all([
  tx.usuario.findUnique({where:{id:conferenteId},select:{status:true}}),
  tx.organizacao.findUnique({where:{id:organizacaoId},select:{ativo:true}}),
  tx.usuarioOrganizacao.findUnique({where:{
   usuarioId_organizacaoId:{usuarioId:conferenteId,organizacaoId}
  },select:{ativo:true}}),
  tx.usuarioEmpresa.findUnique({where:{
   usuarioId_empresaId:{usuarioId:conferenteId,empresaId}
  },include:{empresa:{select:{organizacaoId:true,ativo:true}},
   cargo:{include:{permissoes:{include:{permissao:{select:{codigo:true}}}}}}}})
 ]);
 if(user?.status!=="ATIVO"||!org?.ativo||!member?.ativo||
    !companyMember?.ativo||!companyMember.empresa?.ativo||
    companyMember.empresa.organizacaoId!==organizacaoId||
    !companyMember.cargo?.ativo||
    !companyMember.cargo.permissoes.some(p=>p.permissao.codigo==="financeiro.gerenciar"))
  fail("CONFERENTE_SEM_PERMISSAO");
}
export async function registrarParecerPreBaixaSomenteSandbox({
 organizacaoId,empresaId,conferenteId,preparacaoId,evidencia,
 simularFalhaAposGravacao=false
}={}){
 exigirBancoIsolado();
 if([organizacaoId,empresaId,conferenteId,preparacaoId].some(
  x=>typeof x!=="string"||!x.trim()))fail("CONTEXTO_INVALIDO");
 return prisma.$transaction(async tx=>{
  if((await tx.$queryRaw`SELECT current_database() AS nome`)[0]?.nome!=="pointvet_unified_ci")
   fail("BANCO_NAO_ISOLADO");
  // Resolve identity, lock comanda before any review, then re-read after lock.
  const start=await tx.preparacaoBaixaCartaoManualUnificada.findUnique({
   where:{id:preparacaoId},select:{comandaId:true}
  });
  if(!start?.comandaId)fail("PREPARACAO_NAO_ENCONTRADA");
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${start.comandaId} FOR UPDATE`;
  const pre=await tx.preparacaoBaixaCartaoManualUnificada.findFirst({
   where:{id:preparacaoId,organizacaoId,empresaId,
    status:"PREPARADA_SEM_BAIXA"},
   include:{parcelas:true}
  });
  if(!pre||!pre.parcelas.length)fail("PREPARACAO_NAO_ENCONTRADA");
  await verifyReviewer(tx,{organizacaoId,empresaId,conferenteId});
  if(pre.usuarioId===conferenteId)fail("SEGREGACAO_DE_FUNCOES");
  const command=await tx.comanda.findFirst({where:{
   id:pre.comandaId,status:"FECHADA",rascunhoUnificado:true,
   cliente:{organizacaoId}
  },select:{id:true}});
  if(!command)fail("COMANDA_INDISPONIVEL");
  const bankAccount=await tx.contaFinanceira.findFirst({where:{
   id:pre.contaFinanceiraId,empresaId,ativo:true,tipo:"BANCO"
  },select:{id:true}});
  if(!bankAccount)fail("CONTA_INDISPONIVEL");
  if(pre.snapshot?.baixaRealExecutada!==false||
    pre.snapshot?.verificacaoBancariaIndependente!==false||
    pre.snapshot?.versao!==1)fail("PREPARACAO_DIVERGENTE");
  const ids=pre.parcelas.map(p=>p.parcelaId);
  if(new Set(ids).size!==ids.length)fail("PARCELAS_INVALIDAS");
  const parts=await tx.parcelaRecebivelManualUnificado.findMany({where:{
   id:{in:ids},status:"CONCILIADA",conciliadoEm:{not:null},
   linha:{operacao:{empresaId,reserva:{comandaId:pre.comandaId}}}
  },select:{id:true}});
  if(parts.length!==ids.length)fail("PARCELAS_NAO_CONCILIADAS");
  const declarations=await tx.auditoria.findMany({where:{
   organizacaoId,empresaId,acao:"REPASSE_CARTAO_CONCILIADO_MANUAL_CI",
   entidade:"ParcelaRecebivelManualUnificado",entidadeId:{in:ids}
  },select:{entidadeId:true,usuarioId:true,dadosNovos:true}});
  if(declarations.length!==ids.length||
     new Set(declarations.map(a=>a.entidadeId)).size!==ids.length||
     declarations.some(a=>
    a.usuarioId===conferenteId||a.dadosNovos?.status!=="CONCILIADA"||
    a.dadosNovos?.provaBancariaIndependente!==false))
   fail("SEGREGACAO_DA_DECLARACAO");
  const preAudits=await tx.auditoria.findMany({where:{
   organizacaoId,empresaId,acao:"PRE_BAIXA_CARTAO_PREPARADA_CI",
   entidade:"PreparacaoBaixaCartaoManualUnificada",entidadeId:pre.id
  },select:{usuarioId:true,dadosNovos:true}});
  if(preAudits.length!==1||preAudits[0].usuarioId!==pre.usuarioId||
     preAudits[0].dadosNovos?.fingerprint!==pre.fingerprint)
   fail("AUDITORIA_PREPARACAO_INVALIDA");
  const pedido=validarParecerDocumentalM511({
   ...evidencia,preparacaoFingerprint:pre.fingerprint,conferenteId
  });
  const existing=await tx.parecerPreBaixaCartaoManualUnificada.findUnique({
   where:{preparacaoId:pre.id}
  });
  if(existing){
   if(existing.fingerprint!==pedido.fingerprint||
      existing.conferenteId!==conferenteId||
      existing.organizacaoId!==organizacaoId||existing.empresaId!==empresaId||
      existing.status!=="CONFERENCIA_DOCUMENTAL_DECLARADA")
    fail("PARECER_IMUTAVEL_DIVERGENTE");
   return result(existing,true);
  }
  const review=await tx.parecerPreBaixaCartaoManualUnificada.create({data:{
   preparacaoId:pre.id,organizacaoId,empresaId,conferenteId,
   evidenciaReferencia:pedido.evidenciaReferencia,
   evidenciaSha256:pedido.evidenciaSha256,
   fingerprint:pedido.fingerprint,
   snapshot:{versao:1,preparacaoFingerprint:pre.fingerprint,
    referenciaExtrato:pre.referenciaExtrato,parcelas:ids.slice().sort(),
    apenasConferenciaDocumental:true,conteudoDocumentoValidado:false,
    comprovacaoBancariaIndependente:false,baixaContabilAutorizada:false}
  }});
  await tx.auditoria.create({data:{
   organizacaoId,empresaId,usuarioId:conferenteId,
   acao:"PRE_BAIXA_CARTAO_CONFERENCIA_DOCUMENTAL_CI",
   entidade:"ParecerPreBaixaCartaoManualUnificada",entidadeId:review.id,
   dadosNovos:{fingerprint:pedido.fingerprint,preparacaoId:pre.id,
    evidenciaReferencia:pedido.evidenciaReferencia,
    evidenciaSha256:pedido.evidenciaSha256,segregacaoDeFuncoes:true,
    comprovacaoBancariaIndependente:false,baixouFinanceiro:false}
  }});
  if(simularFalhaAposGravacao)fail("ROLLBACK_SIMULADO");
  return result(review,false);
 },{isolationLevel:"Serializable",maxWait:10000,timeout:30000});
}
