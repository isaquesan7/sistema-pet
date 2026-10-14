/** M.4B.2 — PostgreSQL 16 disposable credit ledger/causal reversal E2E. */
import {test} from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import {creditLedger} from "../src/modules/clientes/client-finance.service.js";
import {registrarEntradaCreditoConciliadaSomenteSandbox,
 simularUtilizacaoCreditoSomenteSandbox,estornarCreditoCausalSomenteSandbox}
 from "../src/modules/clientes/client-credit-ledger-sandbox.service.js";
const suffix=Date.now().toString(36);
const ref=(s)=>s+suffix;
test("M.4B.2: evidence-bound credit, negative balance, concurrency, idempotency and causal reversal",async()=>{
 const org=ref("credit-org-"),other=ref("credit-other-"),empresa=ref("credit-company-"),
  outsider=ref("credit-foreign-company-"),client=ref("credit-client-"),actor=ref("credit-actor-");
 await prisma.organizacao.createMany({data:[
  {id:org,slug:ref("credit-tenant-"),nome:"CI Crédito"},
  {id:other,slug:ref("credit-foreign-"),nome:"CI Outro"}
 ]});
 await prisma.empresa.createMany({data:[
  {id:empresa,organizacaoId:org,tipo:"LOJA_CONSULTORIO",
   nomeFantasia:"CI Crédito",razaoSocial:"CI Crédito",cnpj:"77777777777777"},
  {id:outsider,organizacaoId:other,tipo:"LOJA_CONSULTORIO",
   nomeFantasia:"CI Externa",razaoSocial:"CI Externa",cnpj:"66666666666666"}
 ]});
 await prisma.cliente.create({data:{id:client,organizacaoId:org,nome:"Cliente com adiantamento CI"}});
 await prisma.usuario.create({data:{id:actor,nome:"Operador financeiro CI",email:ref("credit-")+"@ci.invalid",senhaHash:"not-a-login"}});
 const financePermission=await prisma.permissao.upsert({
  where:{codigo:"financeiro.gerenciar"},update:{},create:{
   codigo:"financeiro.gerenciar",nome:"Financeiro gestão"}
 });
 const cargo=await prisma.cargo.create({data:{
  empresaId:empresa,nome:"Financeiro CI",
  permissoes:{create:[{permissaoId:financePermission.id}]}
 }});
 await prisma.usuarioEmpresa.create({data:{usuarioId:actor,empresaId:empresa,cargoId:cargo.id}});
 const account=await prisma.contaFinanceira.create({data:{
  empresaId:empresa,nome:"Conta Banco Crédito CI",tipo:"BANCO"
 }});
 const title=await prisma.tituloFinanceiro.create({data:{
  organizacaoId:org,empresaId:empresa,clienteId:client,tipo:"RECEBER",
  origem:"OUTRO",status:"PAGO",descricao:"ADIANTAMENTO CLIENTE CI",
  valorOriginal:"100.00",valorPago:"100.00"
 }});
 const baixa=await prisma.baixaFinanceira.create({data:{
  tituloId:title.id,contaFinanceiraId:account.id,usuarioId:actor,
  forma:"PIX",valor:"100.00",desconto:"0.00",juros:"0.00"
 }});
 const reconcile=await prisma.conciliacaoFinanceira.create({data:{
  empresaId:empresa,contaFinanceiraId:account.id,usuarioId:actor,
  origem:"BAIXA_TITULO",origemId:baixa.id,
  direcao:"ENTRADA",valor:"100.00",dataMovimento:new Date()
 }});
 const base={organizacaoId:org,empresaId:empresa,clienteId:client,usuarioId:actor};
 const request={...base,solicitacaoId:ref("entrada-adiantamento-"),
  conciliacaoId:reconcile.id,valorCentavos:10000};
 assert.deepEqual({
  saldo:(await creditLedger(org,empresa,client)).saldo,
  habilitado:(await creditLedger(org,empresa,client)).usoNoPdvHabilitado
 },{saldo:0,habilitado:false});
 const noOtherEffects=async()=>({
  vendas:await prisma.venda.count(),pagamentos:await prisma.pagamento.count(),
  caixa:await prisma.movimentacaoCaixa.count(),
  estoque:await prisma.movimentacaoEstoque.count(),
  documentos:await prisma.documentoFiscal.count()
 });
 const before=await noOtherEffects();
 const unsafeFlag=process.env.POINTVET_UNIFIED_SALES_SANDBOX;
 process.env.POINTVET_UNIFIED_SALES_SANDBOX="0";
 await assert.rejects(()=>registrarEntradaCreditoConciliadaSomenteSandbox(request),
  /EXECUCAO_SANDBOX_DESABILITADA/);
 process.env.POINTVET_UNIFIED_SALES_SANDBOX=unsafeFlag;
 await prisma.tituloFinanceiro.update({where:{id:title.id},data:{status:"PENDENTE"}});
 await assert.rejects(()=>registrarEntradaCreditoConciliadaSomenteSandbox(request),
  /M4B2_TITULO_NAO_E_ADIANTAMENTO/);
 await prisma.tituloFinanceiro.update({where:{id:title.id},data:{status:"PAGO"}});
 await prisma.conciliacaoFinanceira.update({where:{id:reconcile.id},data:{direcao:"SAIDA"}});
 await assert.rejects(()=>registrarEntradaCreditoConciliadaSomenteSandbox(request),
  /M4B2_ORIGEM_SEM_CONCILIACAO/);
 await prisma.conciliacaoFinanceira.update({where:{id:reconcile.id},data:{direcao:"ENTRADA"}});
 await assert.rejects(()=>registrarEntradaCreditoConciliadaSomenteSandbox({
  ...request,organizacaoId:other
 }),/M4B2_TENANT_INVALIDO/);
 await assert.rejects(()=>registrarEntradaCreditoConciliadaSomenteSandbox({
  ...request,empresaId:outsider
 }),/M4B2_TENANT_INVALIDO|M4B2_SEM_PERMISSAO_FINANCEIRA/);
 await assert.rejects(()=>registrarEntradaCreditoConciliadaSomenteSandbox({
  ...request,simularFalhaAposLancamento:true
 }),/M4B2_FALHA_SIMULADA_TRANSACAO/);
 assert.equal(await prisma.creditoClienteMovimento.count({where:{
  organizacaoId:org,empresaId:empresa,clienteId:client
 }}),0,"Rollback must remove the credit and audit");
 assert.equal(await prisma.auditoria.count({where:{
  entidade:"CreditoClienteMovimento",organizacaoId:org
 }}),0);
 const competing=await Promise.allSettled([
  registrarEntradaCreditoConciliadaSomenteSandbox(request),
  registrarEntradaCreditoConciliadaSomenteSandbox(request)
 ]);
 assert(competing.some(x=>x.status==="fulfilled"),
  "At least one credit must settle: "+competing.map(x=>x.reason?.message||x.status).join(", "));
 const deposited=await registrarEntradaCreditoConciliadaSomenteSandbox(request);
 assert.equal(deposited.reutilizada,true);
 assert.equal(deposited.saldoApos,100);
 assert.equal(await prisma.creditoClienteMovimento.count({
  where:{conciliacaoId:reconcile.id}
 }),1,"Reconciliation can fund only one entry");
 const wallet=await creditLedger(org,empresa,client);
 assert.equal(wallet.saldoConfiavel,true);
 assert.equal(wallet.saldo,100);
 assert.equal(wallet.usoNoPdvHabilitado,false);
 // If bookkeeping proof is modified after a credit was posted, balance must
 // instantly become untrusted and all subsequent mutations fail closed.
 await prisma.conciliacaoFinanceira.update({where:{id:reconcile.id},
  data:{direcao:"SAIDA"}});
 const invalidBank=await creditLedger(org,empresa,client);
 assert.equal(invalidBank.saldo,null);
 assert.equal(invalidBank.saldoConfiavel,false);
 assert.equal(invalidBank.motivoSaldoIndisponivel,"COMPROVACAO_CONTABIL_DIVERGENTE");
 await assert.rejects(()=>simularUtilizacaoCreditoSomenteSandbox({
  ...base,solicitacaoId:ref("debito-prova-invalida-"),valorCentavos:100
 }),/M4B2_RAZAO_NAO_HOMOLOGADO_COMPROVACAO_CONTABIL_DIVERGENTE/);
 await prisma.conciliacaoFinanceira.update({where:{id:reconcile.id},
  data:{direcao:"ENTRADA"}});
 await prisma.tituloFinanceiro.update({where:{id:title.id},
  data:{status:"PENDENTE"}});
 assert.equal((await creditLedger(org,empresa,client)).saldoConfiavel,false);
 await prisma.tituloFinanceiro.update({where:{id:title.id},
  data:{status:"PAGO"}});
 assert.equal((await creditLedger(org,empresa,client)).saldo,100);
 await assert.rejects(()=>registrarEntradaCreditoConciliadaSomenteSandbox({
  ...request,valorCentavos:9900
 }),/M4B2_REPLAY_DIVERGENTE/);
 await assert.rejects(()=>registrarEntradaCreditoConciliadaSomenteSandbox({
  ...request,solicitacaoId:ref("entrada-duplicada-")
 }),/M4B2_ORIGEM_JA_CREDITADA/);
 await assert.rejects(()=>simularUtilizacaoCreditoSomenteSandbox({
  ...base,solicitacaoId:ref("debito-excessivo-"),valorCentavos:10001
 }),/M4B2_SALDO_INSUFICIENTE/);
 // Two concurrent drafts of a 70-unit debit: only one may commit.
 const a={...base,solicitacaoId:ref("debito-race-a-"),valorCentavos:7000};
 const b={...base,solicitacaoId:ref("debito-race-b-"),valorCentavos:7000};
 const debitRace=await Promise.allSettled([
  simularUtilizacaoCreditoSomenteSandbox(a),
  simularUtilizacaoCreditoSomenteSandbox(b)
 ]);
 assert.equal(debitRace.filter(x=>x.status==="fulfilled").length,1,
  "No overdraft under concurrency: "+debitRace.map(x=>x.reason?.message||x.status).join(", "));
 const win=debitRace[0].status==="fulfilled"?debitRace[0].value:debitRace[1].value;
 const winning=debitRace[0].status==="fulfilled"?a:b;
 assert.equal((await simularUtilizacaoCreditoSomenteSandbox(winning)).reutilizada,true);
 assert.equal((await creditLedger(org,empresa,client)).saldo,30);
 await assert.rejects(()=>estornarCreditoCausalSomenteSandbox({
  ...base,solicitacaoId:ref("estorno-adiantamento-bloqueado-"),
  movimentoOriginalId:deposited.id,motivo:"Devolução de adiantamento pretendida"
 }),/M4B2_ESTORNO_SALDO_INSUFICIENTE/);
 const reversal={...base,solicitacaoId:ref("estorno-uso-simulado-"),
  movimentoOriginalId:win.id,motivo:"Reversão causal do débito simulado"};
 await assert.rejects(()=>estornarCreditoCausalSomenteSandbox({
  ...reversal,simularFalhaAposLancamento:true
 }),/M4B2_FALHA_SIMULADA_TRANSACAO/);
 assert.equal(await prisma.creditoClienteMovimento.count({where:{
  tipo:"ESTORNO",organizacaoId:org
 }}),0);
 const reversedDebit=await estornarCreditoCausalSomenteSandbox(reversal);
 assert.equal(reversedDebit.saldoApos,100);
 assert.equal((await estornarCreditoCausalSomenteSandbox(reversal)).reutilizada,true);
 await assert.rejects(()=>estornarCreditoCausalSomenteSandbox({
  ...reversal,solicitacaoId:ref("estorno-duplo-")
 }),/M4B2_ESTORNO_JA_EXISTENTE/);
 await assert.rejects(()=>estornarCreditoCausalSomenteSandbox({
  ...reversal,motivo:"Alteração maliciosa da mesma chave"
 }),/M4B2_REPLAY_DIVERGENTE/);
 await assert.rejects(()=>estornarCreditoCausalSomenteSandbox({
  ...base,solicitacaoId:ref("estorno-entrada-"),
  movimentoOriginalId:deposited.id,motivo:"Devolução do adiantamento conciliado (simulação)"
 }),/M4B2_DEVOLUCAO_EXTERNA_NAO_CONFIRMADA/);
 const reverseEntry=await estornarCreditoCausalSomenteSandbox({
  ...base,solicitacaoId:ref("estorno-entrada-"),
  movimentoOriginalId:deposited.id,motivo:"Devolução do adiantamento conciliado (simulação)",
  confirmouDevolucaoExterna:true
 });
 assert.equal(reverseEntry.saldoApos,0);
 const finalWallet=await creditLedger(org,empresa,client);
 assert.equal(finalWallet.saldo,0);
 assert.equal(finalWallet.saldoConfiavel,true);
 assert.equal(finalWallet.usoNoPdvHabilitado,false);
 assert.equal(await prisma.auditoria.count({where:{
  entidade:"CreditoClienteMovimento",organizacaoId:org
 }}),4,"One deposit, one simulated debit and two reversals; no duplicate audit");
 assert.deepEqual(await noOtherEffects(),before,
  "Even successful sandbox credit events cannot affect real sale/payment/cash/stock/fiscal");
 const old=await prisma.creditoClienteMovimento.create({data:{
  organizacaoId:org,empresaId:empresa,clienteId:client,tipo:"ENTRADA",valor:"1.00"
 }});
 const historical=await creditLedger(org,empresa,client);
 assert.equal(historical.saldo,null);
 assert.equal(historical.saldoConfiavel,false);
 assert.equal(historical.motivoSaldoIndisponivel,"RAZAO_HISTORICO_NAO_HOMOLOGADO");
 await assert.rejects(()=>simularUtilizacaoCreditoSomenteSandbox({
  ...base,solicitacaoId:ref("debito-historico-"),valorCentavos:100
 }),/M4B2_RAZAO_NAO_HOMOLOGADO/);
 await prisma.creditoClienteMovimento.delete({where:{id:old.id}});
});
