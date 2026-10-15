/**
 * PointVet M.5.13 — HOMOLOGAÇÃO EM CI do lançamento manual de repasse de cartão.
 * Sem integração com banco, Open Finance, adquirente ou maquininha.
 * Após o operador conferir o extrato FORA do PointVet, o programa registra
 * SOMENTE um crédito LÍQUIDO no saldo conciliado interno da empresa.
 * Não altera pagamento/venda, não duplica receitas nem reconhece tarifas
 * como despesas pagas, não emite documento fiscal.
 * NÃO há rota HTTP, e o serviço é impossível de usar fora do CI isolado.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {avaliarIntegridadePreBaixaNoTxM513} from "./pdv-unificado-diagnostico-pre-baixa-sandbox.service.js";
import {validarComandoFinanceiroManualM518} from "./pdv-unificado-comando-financeiro.contract.js";
const ORIGEM="REPASSE_CARTAO_MANUAL_UNIFICADO";
const fail=code=>{throw Error("M513_"+code);};
const money=v=>{const [n,d=""]=String(v).split(".");return n+"."+d.padEnd(2,"0");};
const referenciaValida=v=>typeof v==="string"&&/^[A-Za-z0-9][A-Za-z0-9_./:-]{7,119}$/.test(v);
const result=(row,reutilizada)=>Object.freeze({
 conciliacaoId:row.id,empresaId:row.empresaId,
 origem:row.origem,origemId:row.origemId,
 contaFinanceiraId:row.contaFinanceiraId,
 valorLiquido:money(row.valor),direcao:row.direcao,
 status:"CONFIRMACAO_MANUAL_REGISTRADA",reutilizada,
 depositoBancarioExecutadoPeloPointVet:false,
 confirmacaoAutomaticaDoBanco:false,
 confirmacaoHumanaDoExtrato:true,
 atualizouSaldoConciliadoInterno:true,
 pagamentoAprovado:false,vendaCriada:false,
 gerouCaixa:false,gerouBaixaTitulo:false,
 tributacaoReconhecida:false,liberouCheckout:false
});
async function authorize(tx,{organizacaoId,empresaId,usuarioId}){
 const [user,org,membro,companyLink]=await Promise.all([
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
 if(user?.status!=="ATIVO"||!org?.ativo||!membro?.ativo||
    !companyLink?.ativo||!companyLink.empresa?.ativo||
    companyLink.empresa.organizacaoId!==organizacaoId||
    !companyLink.cargo?.ativo||!companyLink.cargo.permissoes.some(
     p=>p.permissao.codigo==="financeiro.gerenciar"))
  fail("SEM_ACESSO_FINANCEIRO");
}
export async function registrarRepasseCartaoManualSomenteSandbox({
 organizacaoId,empresaId,usuarioId,preparacaoId,
 dados={},simularFalhaAposLancamento=false
}={}){
 exigirBancoIsolado();
 if([organizacaoId,empresaId,usuarioId,preparacaoId].some(
  x=>typeof x!=="string"||!x.trim()))fail("CONTEXTO_INVALIDO");
 // Flag is an attestation of an off-platform manual extrato check ONLY.
 if(dados?.confirmouCreditoNoExtrato!==true||
    !referenciaValida(dados?.referenciaExtrato))
  fail("CONFIRMACAO_MANUAL_EXPLICITA_OBRIGATORIA");
 return prisma.$transaction(async tx=>{
  const db=await tx.$queryRaw`SELECT current_database() AS nome`;
  if(db[0]?.nome!=="pointvet_unified_ci")fail("BANCO_NAO_ISOLADO");
  const start=await tx.preparacaoBaixaCartaoManualUnificada.findFirst({
   where:{id:preparacaoId,organizacaoId,empresaId},
   select:{comandaId:true}});
  if(!start)fail("PREPARACAO_NAO_ENCONTRADA");
  // Lock the comanda FIRST, respecting M.3C/M.5.5/M.5.10/M.5.11.
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${start.comandaId} FOR UPDATE`;
  await authorize(tx,{organizacaoId,empresaId,usuarioId});
  const pre=await tx.preparacaoBaixaCartaoManualUnificada.findFirst({
   where:{id:preparacaoId,organizacaoId,empresaId,
    status:"PREPARADA_SEM_BAIXA"},
   include:{parecerDocumental:true,parcelas:true}
  });
  if(!pre||!pre.parcelas.length||!pre.parecerDocumental)
   fail("PREPARACAO_INCOMPLETA");
  if(dados.referenciaExtrato!==pre.referenciaExtrato)
   fail("REFERENCIA_DIVERGENTE");
  const diagnostics=await avaliarIntegridadePreBaixaNoTxM513(tx,{
   organizacaoId,empresaId,preparacaoId
  });
  if(!diagnostics.integridadeInternaAprovada)
   fail("DOSSIÊ_INTERNO_INVALIDO");
  // M.5.18 optimistic binding INSIDE the same serialized transaction
  // that writes ledger + audit: stale UI forms cannot post a new deposit.
  const command=validarComandoFinanceiroManualM518({
   operacao:"CONFIRMAR_REPASSE",dados,organizacaoId,empresaId,usuarioId,
   preparacao:pre,parecer:pre.parecerDocumental
  });
  // A manual deposit may never coexist with a legacy sale-payment
  // reconciliation of the same synthetic credit payment.
  const lines=await tx.linhaRecebimentoManualUnificado.findMany({where:{
   forma:"CARTAO_CREDITO",operacao:{
    empresaId,reserva:{comandaId:pre.comandaId}}
  },select:{pagamentoId:true}});
  const paymentIds=lines.map(x=>x.pagamentoId).filter(Boolean);
  if(await tx.conciliacaoFinanceira.count({where:{
   empresaId,origem:"PAGAMENTO_VENDA",origemId:{in:paymentIds}
  }}))fail("PAGAMENTO_JA_RECONCILIADO");
  const old=await tx.conciliacaoFinanceira.findUnique({
   where:{origem_origemId:{origem:ORIGEM,origemId:pre.id}}
  });
  if(old){
   const wasCompensated=await tx.conciliacaoFinanceira.count({where:{
    origem:"ESTORNO_REPASSE_CARTAO_MANUAL_UNIFICADO",origemId:old.id
   }});
   if(wasCompensated)fail("REPASSE_COMPENSADO");
   const audits=await tx.auditoria.findMany({where:{
    organizacaoId,empresaId,entidade:"CONCILIACAO_FINANCEIRA",
    entidadeId:old.id,acao:"REPASSE_CARTAO_MANUAL_CONFIRMADO_CI"
   }});
   if(old.empresaId!==empresaId||old.contaFinanceiraId!==pre.contaFinanceiraId||
      old.usuarioId!==usuarioId||old.direcao!=="ENTRADA"||
      money(old.valor)!==money(pre.liquidoDeclarado)||
      old.dataMovimento.toISOString().slice(0,10)!==
        pre.dataCredito.toISOString().slice(0,10)||
      audits.length!==1||
      audits[0].dadosNovos?.preparacaoFingerprint!==pre.fingerprint||
      audits[0].dadosNovos?.fingerprintComando!==command.fingerprintComando||
      audits[0].dadosNovos?.referenciaExtrato!==dados.referenciaExtrato||
      audits[0].dadosNovos?.confirmacaoAutomaticaDoBanco!==false)
    fail("REPLAY_DIVERGENTE");
   return result(old,true);
  }
  // No independent verification is claimed; the operator is explicitly
  // attesting a deposit seen manually OUTSIDE the app.
  const row=await tx.conciliacaoFinanceira.create({data:{
   empresaId,contaFinanceiraId:pre.contaFinanceiraId,usuarioId,
   origem:ORIGEM,origemId:pre.id,direcao:"ENTRADA",
   valor:pre.liquidoDeclarado,dataMovimento:pre.dataCredito,
   descricao:"Repasse cartão — conferência manual; líquido, sem integração bancária"
  }});
  await tx.auditoria.create({data:{
   organizacaoId,empresaId,usuarioId,
   acao:"REPASSE_CARTAO_MANUAL_CONFIRMADO_CI",
   entidade:"CONCILIACAO_FINANCEIRA",entidadeId:row.id,
   dadosNovos:{
    origem:ORIGEM,origemId:pre.id,
    preparacaoFingerprint:pre.fingerprint,
    fingerprintComando:command.fingerprintComando,
    parecerId:pre.parecerDocumental.id,
    referenciaExtrato:pre.referenciaExtrato,
    valorBruto:String(pre.bruto),tarifaCartao:String(pre.tarifaCartao),
    descontoAntecipacao:String(pre.descontoAntecipacao),
    valorLiquido:String(pre.liquidoDeclarado),
    confirmacaoPorOperador:true,confirmacaoAutomaticaDoBanco:false,
    deuBaixaNoPagamento:false,gerouBaixaFinanceira:false
   }
  }});
  if(simularFalhaAposLancamento)fail("ROLLBACK_INJETADO");
  return result(row,false);
 },{isolationLevel:"Serializable",maxWait:10000,timeout:30000});
}
