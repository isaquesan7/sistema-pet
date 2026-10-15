/**
 * PointVet M.5.14: audited compensating debit for MANUALLY attested repasse.
 * CI ONLY: no bank connection, transfer, real refund or fiscal adjustment.
 * Never delete the original internal reconciled entry; compensating movement
 * is a separate SAIDA on the same company bank ledger, net value only.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
const ORIGEM="ESTORNO_REPASSE_CARTAO_MANUAL_UNIFICADO";
const fail=c=>{throw Error("M514_"+c);};
const money=v=>{const [whole,dec=""]=String(v).split(".");return whole+"."+dec.padEnd(2,"0");};
const REF=/^[A-Za-z0-9][A-Za-z0-9_./:-]{7,119}$/;
const MOTIVO=/^[\s\S]{12,500}$/;
const projection=(r,reutilizada)=>Object.freeze({
 id:r.id,empresaId:r.empresaId,contaFinanceiraId:r.contaFinanceiraId,
 origemId:r.origemId,direcao:r.direcao,valor:money(r.valor),
 status:"CONTRALANCAMENTO_MANUAL_REGISTRADO",reutilizada,
 transferenciaBancariaExecutada:false,reembolsoAutomatico:false,
 estornoFiscalExecutado:false,apagouLancamentoOriginal:false,
 alterouPagamento:false,alterouVenda:false,
 saldoInternoAjustado:true,liberouCheckout:false
});
async function authorize(tx,{organizacaoId,empresaId,usuarioId}){
 const [user,org,orgMember,companyMember]=await Promise.all([
  tx.usuario.findUnique({where:{id:usuarioId},select:{status:true}}),
  tx.organizacao.findUnique({where:{id:organizacaoId},select:{ativo:true}}),
  tx.usuarioOrganizacao.findUnique({where:{usuarioId_organizacaoId:{
   usuarioId,organizacaoId}},select:{ativo:true}}),
  tx.usuarioEmpresa.findUnique({where:{usuarioId_empresaId:{
   usuarioId,empresaId}},include:{
    empresa:{select:{ativo:true,organizacaoId:true}},
    cargo:{include:{permissoes:{include:{permissao:{select:{codigo:true}}}}}}
  }})
 ]);
 if(user?.status!=="ATIVO"||!org?.ativo||!orgMember?.ativo||
  !companyMember?.ativo||!companyMember.empresa?.ativo||
  companyMember.empresa.organizacaoId!==organizacaoId||
  !companyMember.cargo?.ativo||!companyMember.cargo.permissoes.some(
   p=>p.permissao.codigo==="financeiro.gerenciar"))
  fail("ACESSO_FINANCEIRO_NEGADO");
}
export async function compensarRepasseCartaoManualSomenteSandbox({
 organizacaoId,empresaId,usuarioId,conciliacaoId,dados={},
 simularFalhaAposDebito=false
}={}){
 exigirBancoIsolado();
 if([organizacaoId,empresaId,usuarioId,conciliacaoId].some(
  x=>typeof x!=="string"||!x.trim()))fail("CONTEXTO_INVALIDO");
 if(dados.confirmouCorrecaoExterna!==true||
    typeof dados.referenciaCorrecao!=="string"||
    !REF.test(dados.referenciaCorrecao)||
    typeof dados.motivo!=="string"||!MOTIVO.test(dados.motivo.trim()))
  fail("JUSTIFICATIVA_OU_CONFIRMACAO_INVALIDA");
 return prisma.$transaction(async tx=>{
  if((await tx.$queryRaw`SELECT current_database() AS nome`)[0]?.nome!=="pointvet_unified_ci")
   fail("BANCO_NAO_ISOLADO");
  const original=await tx.conciliacaoFinanceira.findFirst({where:{
   id:conciliacaoId,empresaId,origem:"REPASSE_CARTAO_MANUAL_UNIFICADO",
   direcao:"ENTRADA"
  },select:{id:true,origemId:true,empresaId:true,usuarioId:true,
   contaFinanceiraId:true,valor:true,dataMovimento:true}});
  if(!original)fail("LANCAMENTO_NAO_ENCONTRADO");
  const pre=await tx.preparacaoBaixaCartaoManualUnificada.findFirst({where:{
   id:original.origemId,empresaId,organizacaoId
  },select:{id:true,comandaId:true,contaFinanceiraId:true,liquidoDeclarado:true}});
  if(!pre)fail("PREPARACAO_NAO_ENCONTRADA");
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${pre.comandaId} FOR UPDATE`;
  await authorize(tx,{organizacaoId,empresaId,usuarioId});
  if(original.usuarioId===usuarioId)fail("EXIGE_SEGUNDO_OPERADOR");
  if(original.contaFinanceiraId!==pre.contaFinanceiraId||
     money(original.valor)!==money(pre.liquidoDeclarado))
   fail("VALORES_ORIGINAIS_DIVERGENTES");
  const auditOriginal=await tx.auditoria.findMany({where:{
   organizacaoId,empresaId,entidade:"CONCILIACAO_FINANCEIRA",
   entidadeId:original.id,acao:"REPASSE_CARTAO_MANUAL_CONFIRMADO_CI"
  },select:{usuarioId:true,dadosNovos:true}});
  if(auditOriginal.length!==1||auditOriginal[0].usuarioId!==original.usuarioId||
    auditOriginal[0].dadosNovos?.origemId!==pre.id)
   fail("AUDITORIA_ORIGINAL_INVALIDA");
  const old=await tx.conciliacaoFinanceira.findUnique({where:{
   origem_origemId:{origem:ORIGEM,origemId:original.id}
  }});
  if(old){
   const audits=await tx.auditoria.findMany({where:{
    organizacaoId,empresaId,acao:"REPASSE_CARTAO_MANUAL_COMPENSADO_CI",
    entidade:"CONCILIACAO_FINANCEIRA",entidadeId:old.id
   }});
   if(old.empresaId!==empresaId||old.usuarioId!==usuarioId||
      old.contaFinanceiraId!==original.contaFinanceiraId||
      old.direcao!=="SAIDA"||money(old.valor)!==money(original.valor)||
      audits.length!==1||
      audits[0].dadosNovos?.referenciaCorrecao!==dados.referenciaCorrecao||
      audits[0].dadosNovos?.motivo!==dados.motivo.trim()||
      audits[0].dadosNovos?.confirmacaoAutomaticaDoBanco!==false)
    fail("REPLAY_DIVERGENTE");
   return projection(old,true);
  }
  const correction=await tx.conciliacaoFinanceira.create({data:{
   empresaId,contaFinanceiraId:original.contaFinanceiraId,usuarioId,
   origem:ORIGEM,origemId:original.id,direcao:"SAIDA",
   valor:original.valor,dataMovimento:new Date(),
   descricao:"Correção manual de repasse de cartão: contralançamento, sem banco integrado"
  }});
  await tx.auditoria.create({data:{
   organizacaoId,empresaId,usuarioId,
   acao:"REPASSE_CARTAO_MANUAL_COMPENSADO_CI",
   entidade:"CONCILIACAO_FINANCEIRA",entidadeId:correction.id,
   dadosNovos:{origemId:original.id,preparacaoId:pre.id,
    referenciaCorrecao:dados.referenciaCorrecao,
    motivo:dados.motivo.trim(),valorLiquido:money(original.valor),
    contaFinanceiraId:original.contaFinanceiraId,
    confirmacaoManualExterna:true,confirmacaoAutomaticaDoBanco:false,
    naoExcluiuLancamentoOriginal:true,naoAlterouPagamento:true,
    naoGerouEstornoFiscal:true}
  }});
  if(simularFalhaAposDebito)fail("ROLLBACK_INJETADO");
  return projection(correction,false);
 },{isolationLevel:"Serializable",maxWait:10000,timeout:30000});
}
