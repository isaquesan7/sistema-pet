/** Behavioral integration tests against a disposable CI PostgreSQL database.
 * Includes cross-company draft, price recalculation, authorization and stale revision.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import {salvarRascunho,listarRascunhos,simularComanda,conferirPreFechamento,planejarFechamento,reservarOperacoesFechamento,consultarReservaFechamento,cancelarReservaFechamento} from "../src/modules/pdv/pdv-unificado.service.js";
import {conferenciaAlocacaoSchema,conferirAlocacaoFechamento,diagnosticarRecuperacaoFechamento,prepararExecucaoUnificada,consultarPreparacaoUnificada} from "../src/modules/pdv/pdv-unificado-preparacao.service.js";
import {criarVendasFilhasSomenteSandbox} from "../src/modules/pdv/pdv-unificado-venda-sandbox.service.js";
import {enfileirarAutorizacoesSomenteSandbox,reclamarOutboxSomenteSandbox,verificarExpiracaoOutboxSomenteSandbox,registrarEventoSomenteSandbox} from "../src/modules/pdv/pdv-unificado-autorizacao-sandbox.service.js";
import {assinarWebhookPSPSimulado,receberWebhookPSPSomenteSandbox} from "../src/modules/pdv/pdv-unificado-psp-sandbox.contract.js";
import {registrarRecebedorMockSomenteSandbox,registrarConsultaStatusMockSomenteSandbox,conferirRespostaConsultaPSPMockSomenteSandbox} from "../src/modules/pdv/pdv-unificado-recebedores-sandbox.service.js";
import {registrarRecebimentoManualSomenteSandbox,consultarRecebimentoManualSomenteSandbox} from "../src/modules/pdv/pdv-unificado-registro-manual-sandbox.service.js";
import {efetivarRecebimentosManuaisSomenteSandbox} from "../src/modules/pdv/pdv-unificado-fechamento-manual-sandbox.service.js";
import {estornarFechamentoManualSomenteSandbox} from "../src/modules/pdv/pdv-unificado-estorno-manual-sandbox.service.js";
import {createSchema as quoteCreateSchema,createQuote,listQuotes,setQuoteStatus,creditLedger} from "../src/modules/clientes/client-finance.service.js";
import {previsualizarOrcamentoNoPdvUnificado} from "../src/modules/clientes/client-quote-pdv-preview.service.js";
import {converterOrcamentoEmRascunhoSomenteSandbox} from "../src/modules/clientes/client-quote-pdv-conversion-sandbox.service.js";
const suffix=Date.now().toString(36);
const ids={org:"org"+suffix,other:"other"+suffix,client:"cli"+suffix,user:"usr"+suffix,co1:"c1"+suffix,co2:"c2"+suffix,pet:null,it1:"i1"+suffix,it2:"i2"+suffix};
test("cross-company saving respects prices, access, rollback and version",async()=>{
 await prisma.organizacao.create({data:{id:ids.org,slug:"test-"+suffix,nome:"Organização CI"}});
 await prisma.organizacao.create({data:{id:ids.other,slug:"outside-"+suffix,nome:"Outra organização"}});
 await prisma.usuario.create({data:{id:ids.user,nome:"Tester",email:suffix+"@ci.invalid",senhaHash:"not-a-login"}});
 await prisma.cliente.create({data:{id:ids.client,organizacaoId:ids.org,nome:"Tutor de teste"}});
 await prisma.empresa.createMany({data:[
  {id:ids.co1,organizacaoId:ids.org,cnpj:"99999999999999",nomeFantasia:"Loja",razaoSocial:"Loja CI",tipo:"LOJA_CONSULTORIO"},
  {id:ids.co2,organizacaoId:ids.org,cnpj:"88888888888888",nomeFantasia:"Estética",razaoSocial:"Estética CI",tipo:"BANHO_TOSA"}
 ]});
 const permission=await prisma.permissao.upsert({where:{codigo:"pdv.acessar"},update:{},create:{codigo:"pdv.acessar",nome:"Acessar PDV"}});
 const cancelPermission=await prisma.permissao.upsert({where:{codigo:"pdv.cancelar_venda"},update:{},create:{codigo:"pdv.cancelar_venda",nome:"Cancelar venda"}});
 const financePermission=await prisma.permissao.upsert({where:{codigo:"financeiro.gerenciar"},update:{},create:{codigo:"financeiro.gerenciar",nome:"Gerenciar financeiro"}});
 const manager=await prisma.cargo.create({data:{empresaId:ids.co1,nome:"Gestor CI",permissoes:{create:[{permissaoId:permission.id},{permissaoId:cancelPermission.id},{permissaoId:financePermission.id}]}}});
 const cargo=await prisma.cargo.create({data:{empresaId:ids.co2,nome:"Operador CI",permissoes:{create:[{permissaoId:permission.id},{permissaoId:cancelPermission.id}]}}});
 await prisma.usuarioEmpresa.createMany({data:[{usuarioId:ids.user,empresaId:ids.co1,cargoId:manager.id},{usuarioId:ids.user,empresaId:ids.co2,cargoId:cargo.id}]});
 await prisma.itemCatalogo.createMany({data:[
  {id:ids.it1,empresaId:ids.co1,nome:"Ração",tipo:"PRODUTO",precoVenda:"180.00"},
  {id:ids.it2,empresaId:ids.co2,nome:"Banho",tipo:"SERVICO",precoVenda:"70.00"}
 ]});
 const args={organizacaoId:ids.org,usuarioId:ids.user,empresaId:ids.co1,clienteId:ids.client,itens:[
  {empresaId:ids.co1,itemCatalogoId:ids.it1,quantidade:1},
  {empresaId:ids.co2,itemCatalogoId:ids.it2,quantidade:2}
 ]};
 const calculated=await simularComanda(args);
 assert.equal(calculated.total,"320.00");
 assert.equal(calculated.empresas.length,2);
 const draft=await salvarRascunho(args);
 assert.equal(draft.total,"320.00");
 assert.equal(draft.versao,1);
 const review=await conferirPreFechamento({...args,id:draft.id,versao:1});
 assert.equal(review.total,"320.00");
 assert.equal(review.empresas.length,2);
 assert.equal(review.checkoutHabilitado,false);
 assert.equal(review.pendencias.length,0);
 const planned=await planejarFechamento({...args,id:draft.id,versao:1});
 const repeated=await planejarFechamento({...args,id:draft.id,versao:1});
 assert.equal(planned.podeExecutar,false);
 assert.equal(planned.operacoes.length,2);
 assert.equal(new Set(planned.operacoes.map(o=>o.chaveIdempotencia)).size,2);
 assert.deepEqual(planned.operacoes,repeated.operacoes,"Idempotency keys must be deterministic");
 const reservedDraft=await salvarRascunho(args);
 const reservationArgs={...args,id:reservedDraft.id,versao:1};
 const concurrent=await Promise.allSettled([
  reservarOperacoesFechamento(reservationArgs),
  reservarOperacoesFechamento(reservationArgs)
 ]);
 assert(concurrent.some(x=>x.status==="fulfilled"),"At least one reservation must commit");
 const initialReservation=await consultarReservaFechamento(reservationArgs);
 assert.equal(initialReservation.status,"RESERVADA");
 assert.equal(initialReservation.criadoPorId,ids.user);
 assert.equal(initialReservation.operacoes.length,2);
 assert.equal(new Set(initialReservation.operacoes.map(x=>x.chaveIdempotencia)).size,2);
 assert(initialReservation.operacoes.every(x=>x.vendaId===null));
 assert.equal(await prisma.reservaFechamentoUnificado.count({where:{comandaId:reservedDraft.id}}),1);
 assert.equal(await prisma.reservaOperacaoUnificada.count({where:{reserva:{comandaId:reservedDraft.id}}}),2);
 const replay=await reservarOperacoesFechamento(reservationArgs);
 assert.equal(replay.reutilizada,true);
 assert.equal(replay.id,initialReservation.id);
 assert.deepEqual(replay.operacoes.map(x=>x.id).sort(),initialReservation.operacoes.map(x=>x.id).sort());
 await assert.rejects(()=>salvarRascunho(args,{id:reservedDraft.id,versao:1}),/RASCUNHO_RESERVADO/);
 await assert.rejects(()=>reservarOperacoesFechamento({...reservationArgs,organizacaoId:ids.other}),/RASCUNHO_NAO_ENCONTRADO/);
 assert.equal(await prisma.venda.count(),0);
 assert.equal(await prisma.pagamento.count(),0);
 // Two seller-specific open cash sessions; a single company's session cannot
 // receive the other company's portion, even when the operator sees both.
 const cash1=await prisma.caixa.create({data:{empresaId:ids.co1,nome:"Caixa Loja CI"}});
 const cash2=await prisma.caixa.create({data:{empresaId:ids.co2,nome:"Caixa Estética CI"}});
 const session1=await prisma.sessaoCaixa.create({data:{caixaId:cash1.id,usuarioAberturaId:ids.user}});
 const session2=await prisma.sessaoCaixa.create({data:{caixaId:cash2.id,usuarioAberturaId:ids.user}});
 const proper={versao:1,alocacoes:[
  {empresaId:ids.co1,sessaoCaixaId:session1.id,pagamentos:[{forma:"PIX",valorCentavos:18000}]},
  {empresaId:ids.co2,sessaoCaixaId:session2.id,pagamentos:[{forma:"CARTAO_DEBITO",valorCentavos:14000}]}
 ]};
 assert(conferenciaAlocacaoSchema.safeParse(proper).success);
 const good=await conferirAlocacaoFechamento({...reservationArgs,dados:proper});
 assert.equal(good.preConferenciaAprovada,true);
 assert.equal(good.execucaoDisponivel,false);
 assert.equal(good.empresas.length,2);
 const prepArgs={...reservationArgs,dados:proper};
 const preparacoesConcorrentes=await Promise.allSettled([
  prepararExecucaoUnificada(prepArgs),prepararExecucaoUnificada(prepArgs)
 ]);
 assert(preparacoesConcorrentes.some(x=>x.status==="fulfilled"),"One preparation must commit");
 const preparacao=await consultarPreparacaoUnificada(reservationArgs);
 assert.equal(preparacao.status,"PREPARADA");
 assert.equal(preparacao.execucaoDisponivel,false);
 assert.equal(preparacao.operacoes.length,2);
 assert.equal(await prisma.criacaoPreparacaoUnificada.count({where:{reservaId:initialReservation.id}}),1);
 const replayPrep=await prepararExecucaoUnificada(prepArgs);
 assert.equal(replayPrep.id,preparacao.id);
 assert.equal(replayPrep.fingerprint,preparacao.fingerprint);
 assert.equal(replayPrep.reutilizada,true);
 const reordered=await prepararExecucaoUnificada({...reservationArgs,dados:{versao:1,alocacoes:[...proper.alocacoes].reverse()}});
 assert.equal(reordered.id,preparacao.id,"Equivalent allocation order must replay the same preparation");
 await assert.rejects(()=>prepararExecucaoUnificada({...reservationArgs,dados:{
  ...proper,alocacoes:[{...proper.alocacoes[0],pagamentos:[{forma:"DINHEIRO",valorCentavos:18000}]},proper.alocacoes[1]]
 }}),/PREPARACAO_DIVERGENTE/);
 assert.equal(await prisma.venda.count(),0,"Preparation must never create sales");
 assert.equal(await prisma.pagamento.count(),0,"Preparation must never create payments");

 const repeatedGood=await conferirAlocacaoFechamento({...reservationArgs,dados:proper});
 assert.deepEqual(good,repeatedGood,"Pre-conference must be repeatable, read-only");
 const wrongSession=await conferirAlocacaoFechamento({...reservationArgs,dados:{
  ...proper,alocacoes:[{...proper.alocacoes[0],sessaoCaixaId:session2.id},proper.alocacoes[1]]
 }});
 assert(wrongSession.pendencias.some(x=>x.codigo==="CAIXA_INDISPONIVEL_OU_OUTRA_EMPRESA"));
 const wrongAmount=await conferirAlocacaoFechamento({...reservationArgs,dados:{
  ...proper,alocacoes:[{...proper.alocacoes[0],pagamentos:[{forma:"PIX",valorCentavos:10000}]},proper.alocacoes[1]]
 }});
 assert(wrongAmount.pendencias.some(x=>x.codigo==="PAGAMENTO_DIVERGENTE"));
 const missingSeller=await conferirAlocacaoFechamento({...reservationArgs,dados:{versao:1,alocacoes:[proper.alocacoes[0]]}});
 assert(missingSeller.pendencias.some(x=>x.codigo==="EMPRESA_SEM_ALOCACAO"));
 assert.equal(conferenciaAlocacaoSchema.safeParse({...proper,alocacoes:[{...proper.alocacoes[0],pagamentos:[{forma:"CREDITO_CLIENTE",valorCentavos:18000}]},proper.alocacoes[1]]}).success,false);
 assert.equal(conferenciaAlocacaoSchema.safeParse({...proper,alocacoes:[{...proper.alocacoes[0],pagamentos:[{forma:"PIX",valorCentavos:-5}]},proper.alocacoes[1]]}).success,false);
 const diagnosis=await diagnosticarRecuperacaoFechamento(reservationArgs);
 assert.equal(diagnosis.recuperacaoAutomaticaHabilitada,false);
 assert.equal(diagnosis.operacoes.length,2);
 assert(diagnosis.operacoes.every(o=>o.diagnostico==="AGUARDANDO_EXECUCAO_FUTURA"));
 assert.equal(await prisma.venda.count(),0,"Readiness and diagnostic must not create sales");
 assert.equal(await prisma.pagamento.count(),0,"Readiness and diagnostic must not create payments");
 await prisma.cargoPermissao.delete({where:{cargoId_permissaoId:{cargoId:cargo.id,permissaoId:cancelPermission.id}}});
 await assert.rejects(()=>cancelarReservaFechamento({...reservationArgs,motivo:"Deve bloquear cancelamento parcial"}),/CANCELAMENTO_SEM_PERMISSAO/);
 assert.equal((await consultarReservaFechamento(reservationArgs)).status,"RESERVADA");
 await prisma.cargoPermissao.create({data:{cargoId:cargo.id,permissaoId:cancelPermission.id}});
 const cancelled=await cancelarReservaFechamento({...reservationArgs,motivo:"Revisão de itens no teste isolado"});
 assert.equal(cancelled.canceladoPorId,ids.user);
 assert.equal(cancelled.status,"CANCELADA");
 const cancelledPrep=await consultarPreparacaoUnificada(reservationArgs);
 assert.equal(cancelledPrep.status,"INVALIDADA");
 await assert.rejects(()=>prepararExecucaoUnificada(prepArgs),/RESERVA_NAO_EDITAVEL/);

 const afterCancelled=await diagnosticarRecuperacaoFechamento(reservationArgs);
 assert(afterCancelled.operacoes.every(o=>o.diagnostico==="CANCELADA"));
 assert(cancelled.operacoes.every(x=>x.status==="CANCELADA"));
 assert.equal((await cancelarReservaFechamento({...reservationArgs,motivo:"Repetição segura"})).status,"CANCELADA");
 await assert.rejects(()=>reservarOperacoesFechamento(reservationArgs),/RESERVA_CANCELADA/);
 const afterCancel=await salvarRascunho(args,{id:reservedDraft.id,versao:1});
 assert.equal(afterCancel.versao,2);
 assert.equal(await prisma.reservaOperacaoUnificada.count({where:{reservaId:cancelled.id}}),2);

 // M.2: durable manual declarations with neither money movement nor checkout.
 const declarationDraft=await salvarRascunho(args);
 const declarationArgs={...args,id:declarationDraft.id,versao:1};
 await reservarOperacoesFechamento(declarationArgs);
 await prepararExecucaoUnificada({...declarationArgs,dados:proper});
 const declared={versao:1,alocacoes:[
  {empresaId:ids.co1,sessaoCaixaId:session1.id,pagamentos:[
   {forma:"CARTAO_CREDITO",valorCentavos:18000,parcelas:3,confirmadoPeloAtendente:true,referencia:"recibo CI"}
  ]},
  {empresaId:ids.co2,sessaoCaixaId:session2.id,pagamentos:[
   {forma:"CARTAO_DEBITO",valorCentavos:14000,confirmadoPeloAtendente:true}
  ]}
 ]};
 const declarationContext={...declarationArgs,dados:declared};
 const declarationConcurrent=await Promise.allSettled([
  registrarRecebimentoManualSomenteSandbox(declarationContext),
  registrarRecebimentoManualSomenteSandbox(declarationContext)
 ]);
 assert(declarationConcurrent.some(x=>x.status==="fulfilled"),
  "At least one manual declaration must persist: "+declarationConcurrent.map(x=>String(x.reason?.message||x.status)).join(","));
 const registered=await consultarRecebimentoManualSomenteSandbox(declarationArgs);
 assert.equal(registered.status,"REGISTRADO");
 assert.equal(registered.criadoPorId,ids.user);
 assert.equal(registered.linhas.length,2);
 assert.equal(registered.linhas.find(x=>x.empresaId===ids.co1).parcelas,3);
 assert.equal(registered.gerouPagamento,false);
 assert.equal(registered.gerouMovimentoCaixa,false);
 assert.equal(await prisma.registroRecebimentoManualUnificado.count({where:{reserva:{comandaId:declarationDraft.id}}}),1);
 assert.equal(await prisma.linhaRecebimentoManualUnificado.count({where:{registro:{reserva:{comandaId:declarationDraft.id}}}}),2);
 const repeatedDeclaration=await registrarRecebimentoManualSomenteSandbox(declarationContext);
 assert.equal(repeatedDeclaration.reutilizada,true);
 assert.equal(repeatedDeclaration.id,registered.id);
 const differing=structuredClone(declared);
 differing.alocacoes[0].pagamentos[0].referencia="outro recibo";
 await assert.rejects(()=>registrarRecebimentoManualSomenteSandbox({...declarationArgs,dados:differing}),/REGISTRO_MANUAL_DIVERGENTE/);
 const notConfirmed=structuredClone(declared);
 notConfirmed.alocacoes[1].pagamentos[0].confirmadoPeloAtendente=false;
 await assert.rejects(()=>registrarRecebimentoManualSomenteSandbox({...declarationArgs,dados:notConfirmed}),/RECEBIMENTO_NAO_CONFIRMADO/);
 const wrongCash=structuredClone(declared);
 wrongCash.alocacoes[1].sessaoCaixaId=session1.id;
 await assert.rejects(()=>registrarRecebimentoManualSomenteSandbox({...declarationArgs,dados:wrongCash}),/CAIXA_DIVERGENTE/);
 await assert.rejects(()=>registrarRecebimentoManualSomenteSandbox({...declarationArgs,organizacaoId:ids.other,dados:declared}),/RASCUNHO_NAO_ENCONTRADO/);
 await assert.rejects(()=>cancelarReservaFechamento({...declarationArgs,motivo:"Reversão exige auditoria"}),/REGISTRO_MANUAL_EXIGE_REVERSAO/);
 assert.equal(await prisma.venda.count({where:{comandaId:declarationDraft.id}}),0);
 assert.equal(await prisma.pagamento.count(),0);
 assert.equal(await prisma.movimentacaoCaixa.count(),0);
 // Phase 20.2.4A — real Venda ABERTA rows in disposable DB only.
 const guard=process.env.POINTVET_UNIFIED_SALES_SANDBOX;
 process.env.POINTVET_UNIFIED_SALES_SANDBOX="0";
 await assert.rejects(()=>criarVendasFilhasSomenteSandbox({...reservationArgs}),/EXECUCAO_SANDBOX_DESABILITADA/);
 process.env.POINTVET_UNIFIED_SALES_SANDBOX=guard;

 const sandboxDraft=await salvarRascunho(args);
 const sandboxArgs={...args,id:sandboxDraft.id,versao:1};
 await reservarOperacoesFechamento(sandboxArgs);
 await prepararExecucaoUnificada({...sandboxArgs,dados:proper});
 // Test rollback after first seller has been inserted but before the second.
 await assert.rejects(()=>criarVendasFilhasSomenteSandbox({...sandboxArgs,simularFalhaAposEmpresaId:ids.co1}),/FALHA_SIMULADA_TRANSACAO/);
 assert.equal(await prisma.venda.count({where:{comandaId:sandboxDraft.id}}),0,"SQL rollback must undo the first seller");
 assert.equal(await prisma.vendaItem.count({where:{venda:{comandaId:sandboxDraft.id}}}),0);
 const saleRuns=await Promise.allSettled([criarVendasFilhasSomenteSandbox(sandboxArgs),criarVendasFilhasSomenteSandbox(sandboxArgs)]);
 assert(saleRuns.some(x=>x.status==="fulfilled"),"At least one transaction must commit");
 const replaySales=await criarVendasFilhasSomenteSandbox(sandboxArgs);
 assert.equal(replaySales.reutilizada,true);
 assert.equal(replaySales.vendas.length,2);
 assert(replaySales.vendas.every(v=>v.estado==="VENDA_RASCUNHO"&&Boolean(v.vendaId)));
 assert.equal(await prisma.venda.count({where:{comandaId:sandboxDraft.id}}),2);
 assert.equal(await prisma.vendaItem.count({where:{venda:{comandaId:sandboxDraft.id}}}),2);
 assert.equal(await prisma.venda.count({where:{comandaId:sandboxDraft.id,status:"FINALIZADA"}}),0);
 assert.equal(await prisma.pagamento.count({where:{venda:{comandaId:sandboxDraft.id}}}),0);
 assert.equal(await prisma.movimentacaoEstoque.count(),0);
 assert.equal(await prisma.documentoFiscal.count({where:{venda:{comandaId:sandboxDraft.id}}}),0);

 // 20.2.4B — durable sandbox auth intents and outbox; no gateway/network or real payment.
 process.env.POINTVET_UNIFIED_SALES_SANDBOX="0";
 await assert.rejects(()=>enfileirarAutorizacoesSomenteSandbox(sandboxArgs),/EXECUCAO_SANDBOX_DESABILITADA/);
 process.env.POINTVET_UNIFIED_SALES_SANDBOX=guard;
 const staged=await Promise.allSettled([
  enfileirarAutorizacoesSomenteSandbox(sandboxArgs),
  enfileirarAutorizacoesSomenteSandbox(sandboxArgs)
 ]);
 assert(staged.some(x=>x.status==="fulfilled"),"Sandbox intents must stage once: "+staged.map(x=>x.status==="rejected"?String(x.reason?.message||x.reason):"ok").join(" | "));
 const again=await enfileirarAutorizacoesSomenteSandbox(sandboxArgs);
 assert.equal(again.reutilizada,true);
 assert.equal(again.operacoes.length,2);
 assert(again.operacoes.every(o=>o.estado==="PREPARADA_SANDBOX"&&o.outboxStatus==="PENDENTE"));
 const intentCount=await prisma.intencaoAutorizacaoUnificada.count({where:{operacao:{reserva:{comandaId:sandboxDraft.id}}}});
 assert.equal(intentCount,2,"One intent per allocated payment");
 const jobs=await prisma.outboxAutorizacaoUnificada.findMany({where:{intencao:{operacao:{reserva:{comandaId:sandboxDraft.id}}}}});
 assert.equal(jobs.length,2);
 const [first,second]=again.operacoes;
 const authContext={...sandboxArgs,intencaoId:first.id};
 const claim=await reclamarOutboxSomenteSandbox(authContext);
 assert.equal(claim.status,"EM_SIMULACAO");
 assert.equal(claim.podeEnviar,false,"No real PSP dispatch in sandbox");
 const duplicatedClaim=await reclamarOutboxSomenteSandbox(authContext);
 assert.equal(duplicatedClaim.reutilizada,true);
 assert.equal(duplicatedClaim.token,claim.token);
 const uncertain=await registrarEventoSomenteSandbox({...authContext,token:claim.token,chaveEvento:"CI_INDETERMINADA_"+suffix,resultado:"INDETERMINADA"});
 assert.equal(uncertain.status,"INDETERMINADA_SIMULADA");
 assert.equal(uncertain.outbox,"REVISAO_MANUAL");
 assert.equal((await reclamarOutboxSomenteSandbox(authContext)).podeEnviar,false);
 const reconciled=await registrarEventoSomenteSandbox({...authContext,token:claim.token,chaveEvento:"CI_RECONCILIADA_"+suffix,resultado:"CONFIRMADA"});
 assert.equal(reconciled.status,"CONFIRMADA_SIMULADA");
 assert.equal(reconciled.outbox,"CONCLUIDO_SIMULADO");
 const sameEvent=await registrarEventoSomenteSandbox({...authContext,token:claim.token,chaveEvento:"CI_RECONCILIADA_"+suffix,resultado:"CONFIRMADA"});
 assert.equal(sameEvent.reutilizada,true);
 await assert.rejects(()=>registrarEventoSomenteSandbox({...authContext,token:claim.token,chaveEvento:"CI_RECONCILIADA_"+suffix,resultado:"RECUSADA"}),/EVENTO_CONFLITANTE/);
 await assert.rejects(()=>registrarEventoSomenteSandbox({...authContext,token:claim.token,chaveEvento:"CI_NOVA_"+suffix,resultado:"RECUSADA"}),/EVENTO_NAO_AUTORIZADO|RESULTADO_TERMINAL/);
 const denyCtx={...sandboxArgs,intencaoId:second.id};
 const secondClaim=await reclamarOutboxSomenteSandbox(denyCtx);
 const activeLease=await verificarExpiracaoOutboxSomenteSandbox({...denyCtx,agoraMs:secondClaim.leaseExpiraEm.getTime()-1});
 assert.equal(activeLease.status,"EM_SIMULACAO");
 assert.equal(activeLease.alterado,false);
 assert.equal(activeLease.podeReenviar,false);
 const expiredLease=await verificarExpiracaoOutboxSomenteSandbox({...denyCtx,agoraMs:secondClaim.leaseExpiraEm.getTime()+1});
 assert.equal(expiredLease.status,"REVISAO_MANUAL");
 assert.equal(expiredLease.motivo,"TIMEOUT_SEM_CONFIRMACAO");
 assert.equal(expiredLease.podeReenviar,false);
 const repeatExpired=await verificarExpiracaoOutboxSomenteSandbox({...denyCtx,agoraMs:secondClaim.leaseExpiraEm.getTime()+10000});
 assert.equal(repeatExpired.alterado,false);
 assert.equal(repeatExpired.precisaConciliar,true);
 const afterTimeoutClaim=await reclamarOutboxSomenteSandbox(denyCtx);
 assert.equal(afterTimeoutClaim.podeEnviar,false);
 assert.equal(afterTimeoutClaim.reutilizada,true);
 assert.equal(afterTimeoutClaim.token,secondClaim.token);
 const pendingTimeout=await prisma.outboxAutorizacaoUnificada.findUnique({where:{intencaoId:second.id}});
 assert.equal(pendingTimeout.tentativas,1,"Timeout may not create another provider request");
 assert.equal(pendingTimeout.motivoRevisao,"TIMEOUT_SEM_CONFIRMACAO");

 // Mock receiver registry; proof of provider/status-query correlation, NOT settlement.
 process.env.POINTVET_UNIFIED_SALES_SANDBOX="0";
 await assert.rejects(()=>registrarRecebedorMockSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co1,cnpj:"99999999999999",referenciaExterna:"ci_mock_loja_"+suffix
 }),/EXECUCAO_SANDBOX_DESABILITADA/);
 process.env.POINTVET_UNIFIED_SALES_SANDBOX=guard;
 const receiverLoja=await registrarRecebedorMockSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co1,cnpj:"99999999999999",referenciaExterna:"ci_mock_loja_"+suffix
 });
 const receiverEstetica=await registrarRecebedorMockSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co2,cnpj:"88888888888888",referenciaExterna:"ci_mock_estetica_"+suffix
 });
 assert.equal(receiverLoja.ativo,false);
 assert.equal(receiverEstetica.ativo,false);
 const replayReceiver=await registrarRecebedorMockSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co2,cnpj:"88888888888888",referenciaExterna:"ci_mock_estetica_"+suffix
 });
 assert.equal(replayReceiver.reutilizado,true);
 await assert.rejects(()=>registrarRecebedorMockSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co2,cnpj:"99999999999999",referenciaExterna:"ci_mock_wrong_"+suffix
 }),/RECEBEDOR_CNPJ_DIVERGENTE/);
 await assert.rejects(()=>registrarRecebedorMockSomenteSandbox({
  organizacaoId:ids.other,empresaId:ids.co2,cnpj:"88888888888888",referenciaExterna:"ci_mock_wrong_"+suffix
 }),/RECEBEDOR_CNPJ_DIVERGENTE/);
 const receiverForSecond=second.empresaId===ids.co1?receiverLoja:receiverEstetica;
 const receiverForFirst=first.empresaId===ids.co1?receiverLoja:receiverEstetica;
 const consult={...denyCtx,recebedorId:receiverForSecond.id,
  chaveConsulta:"CI_PSP_QUERY_"+suffix,referenciaTransacao:"CI_TRANSACTION_"+suffix,
  resultado:"INDETERMINADA"};
 await assert.rejects(()=>registrarConsultaStatusMockSomenteSandbox({
  ...consult,recebedorId:receiverForFirst.id
 }),/RECEBEDOR_NAO_CORRESPONDE_A_EMPRESA/);
 await assert.rejects(()=>registrarConsultaStatusMockSomenteSandbox({
  ...consult,organizacaoId:ids.other
 }),/RASCUNHO_NAO_ENCONTRADO/);
 await assert.rejects(()=>registrarConsultaStatusMockSomenteSandbox({
  ...consult,intencaoId:first.id,recebedorId:receiverForFirst.id,
  chaveConsulta:"CI_PSP_QUERY_SETTLED_"+suffix
 }),/CONSULTA_FORA_DA_REVISAO/);
 const evidence=await registrarConsultaStatusMockSomenteSandbox(consult);
 assert.equal(evidence.houveEnvioPsp,false);
 assert.equal(evidence.podeReenviar,false);
 assert.equal(evidence.liquidacaoConfirmada,false);
 const repeatedEvidence=await registrarConsultaStatusMockSomenteSandbox(consult);
 assert.equal(repeatedEvidence.reutilizada,true);
 assert.equal(repeatedEvidence.id,evidence.id);
 await assert.rejects(()=>registrarConsultaStatusMockSomenteSandbox({
  ...consult,resultado:"CONFIRMADA"
 }),/CONSULTA_STATUS_CONFLITANTE/);
 assert.equal(await prisma.evidenciaConsultaPspSimulada.count({where:{intencaoId:second.id}}),1);
 assert.equal((await prisma.intencaoAutorizacaoUnificada.findUnique({where:{id:second.id}})).status,"PREPARADA_SANDBOX");
 assert.equal((await prisma.outboxAutorizacaoUnificada.findUnique({where:{intencaoId:second.id}})).status,"REVISAO_MANUAL");

 const mockReply={provedor:"SIMULADOR_CI",empresaId:second.empresaId,
  cnpj:second.empresaId===ids.co1?"99999999999999":"88888888888888",
  recebedorRef:receiverForSecond.referenciaExterna,
  chaveIdempotencia:second.chaveIdempotencia,valorCentavos:Math.round(Number(second.valor)*100),
  moeda:"BRL",status:"LIQUIDADA",referenciaTransacao:"CI_MOCK_TX_"+suffix};
 const correlated=await conferirRespostaConsultaPSPMockSomenteSandbox({
  ...denyCtx,recebedorId:receiverForSecond.id,resposta:mockReply
 });
 assert.equal(correlated.correspondencia,true);
 assert.equal(correlated.liquidacaoConfirmada,false,"Mock LIQUIDADA must not settle money");
 assert.equal(correlated.podeFinalizarVenda,false);
 assert.equal(correlated.podeReenviar,false);
 assert.equal(correlated.pagamentoCriado,false);
 await assert.rejects(()=>conferirRespostaConsultaPSPMockSomenteSandbox({
  ...denyCtx,recebedorId:receiverForFirst.id,resposta:mockReply
 }),/RECEBEDOR_NAO_CORRESPONDE_A_EMPRESA/);
 await assert.rejects(()=>conferirRespostaConsultaPSPMockSomenteSandbox({
  ...denyCtx,recebedorId:receiverForSecond.id,resposta:{...mockReply,valorCentavos:1}
 }),/PSP_VALOR_DIVERGENTE/);
 await assert.rejects(()=>conferirRespostaConsultaPSPMockSomenteSandbox({
  ...denyCtx,recebedorId:receiverForSecond.id,resposta:{...mockReply,cnpj:"77777777777777"}
 }),/PSP_RECEBEDOR_DIVERGENTE/);
 await assert.rejects(()=>conferirRespostaConsultaPSPMockSomenteSandbox({
  ...denyCtx,organizacaoId:ids.other,recebedorId:receiverForSecond.id,resposta:mockReply
 }),/RASCUNHO_NAO_ENCONTRADO/);
 assert.equal(await prisma.pagamento.count({where:{venda:{comandaId:sandboxDraft.id}}}),0);
 assert.equal((await prisma.outboxAutorizacaoUnificada.findUnique({where:{intencaoId:second.id}})).status,"REVISAO_MANUAL");



 const assinaturaSegredo="somente-teste-pointvet-psp-sem-chave-real-2026";
 const timestamp=Math.floor(Date.now()/1000);
 const rawBody=JSON.stringify({versao:1,intencaoChave:second.chaveIdempotencia,
  empresaId:second.empresaId,recebedorCnpj:second.empresaId===ids.co1?"99999999999999":"88888888888888",
  valorCentavos:Math.round(Number(second.valor)*100),eventoId:"PSP_RECUSADA_"+suffix,
  resultado:"RECUSADA",token:secondClaim.token});
 const webhook={...sandboxArgs,rawBody,timestamp,secret:assinaturaSegredo,
  signature:assinarWebhookPSPSimulado({rawBody,timestamp,secret:assinaturaSegredo})};
 await assert.rejects(()=>receberWebhookPSPSomenteSandbox({...webhook,
   signature:"sha256="+("0".repeat(64))}),/WEBHOOK_ASSINATURA_INVALIDA/);
 await assert.rejects(()=>receberWebhookPSPSomenteSandbox({...webhook,
   rawBody:rawBody.replace("RECUSADA","CONFIRMADA")}),/WEBHOOK_ASSINATURA_INVALIDA/);
 await assert.rejects(()=>receberWebhookPSPSomenteSandbox({...webhook,
   agoraMs:Date.now()+600000}),/WEBHOOK_EXPIRADO/);
 const tamperedValue=JSON.stringify({...JSON.parse(rawBody),valorCentavos:1});
 await assert.rejects(()=>receberWebhookPSPSomenteSandbox({...webhook,rawBody:tamperedValue,
   signature:assinarWebhookPSPSimulado({rawBody:tamperedValue,timestamp,secret:assinaturaSegredo})}),/WEBHOOK_VALOR_DIVERGENTE/);
 const wrongReceiver=JSON.stringify({...JSON.parse(rawBody),recebedorCnpj:"77777777777777"});
 await assert.rejects(()=>receberWebhookPSPSomenteSandbox({...webhook,rawBody:wrongReceiver,
   signature:assinarWebhookPSPSimulado({rawBody:wrongReceiver,timestamp,secret:assinaturaSegredo})}),/WEBHOOK_RECEBEDOR_OU_INTENCAO_INVALIDA/);
 await assert.rejects(()=>receberWebhookPSPSomenteSandbox({...webhook,
   organizacaoId:ids.other}),/WEBHOOK_RECEBEDOR_OU_INTENCAO_INVALIDA/);
 const denial=await receberWebhookPSPSomenteSandbox(webhook);
 const replayWebhook=await receberWebhookPSPSomenteSandbox(webhook);
 assert.equal(replayWebhook.reutilizada,true);
 assert.equal(denial.status,"RECUSADA_SIMULADA");
 const settledLease=await verificarExpiracaoOutboxSomenteSandbox({...denyCtx,agoraMs:secondClaim.leaseExpiraEm.getTime()+60000});
 assert.equal(settledLease.status,"CONCLUIDO_SIMULADO");
 assert.equal(settledLease.precisaConciliar,false);
 assert.equal((await prisma.outboxAutorizacaoUnificada.findUnique({where:{intencaoId:second.id}})).tentativas,1);
 assert.equal(await prisma.venda.count({where:{comandaId:sandboxDraft.id,status:"FINALIZADA"}}),0);
 assert.equal(await prisma.pagamento.count({where:{venda:{comandaId:sandboxDraft.id}}}),0);
 assert.equal(await prisma.movimentacaoEstoque.count(),0);
 assert.equal(await prisma.documentoFiscal.count({where:{venda:{comandaId:sandboxDraft.id}}}),0);

 const diagnosisSandbox=await diagnosticarRecuperacaoFechamento(sandboxArgs);
 assert(diagnosisSandbox.operacoes.every(o=>o.diagnostico==="ESTADO_REQUER_REVISAO"),"Draft sale must never be considered finalized");
 await assert.rejects(()=>cancelarReservaFechamento({...sandboxArgs,motivo:"Venda ABERTA com vínculo"}),/RESERVA_NAO_EDITAVEL/);
 await assert.rejects(()=>salvarRascunho(args,{id:sandboxDraft.id,versao:1}),/RASCUNHO_BLOQUEADO/);
 await assert.rejects(()=>criarVendasFilhasSomenteSandbox({...sandboxArgs,organizacaoId:ids.other}),/RASCUNHO_NAO_ENCONTRADO/);

 // Reprice after preparation: stale snapshot must not create a sale.
 const staleDraft=await salvarRascunho(args);
 const staleArgs={...args,id:staleDraft.id,versao:1};
 await reservarOperacoesFechamento(staleArgs);
 await prepararExecucaoUnificada({...staleArgs,dados:proper});
 await prisma.itemCatalogo.update({where:{id:ids.it2},data:{precoVenda:"79.00"}});
 await assert.rejects(()=>criarVendasFilhasSomenteSandbox(staleArgs),/PRE_FECHAMENTO_COM_PENDENCIAS/);
 assert.equal(await prisma.venda.count({where:{comandaId:staleDraft.id}}),0);
 await prisma.itemCatalogo.update({where:{id:ids.it2},data:{precoVenda:"70.00"}});


 await prisma.itemCatalogo.update({where:{id:ids.it2},data:{precoVenda:"75.00"}});
 const changed=await conferirPreFechamento({...args,id:draft.id,versao:1});
 assert(changed.pendencias.some(i=>i.codigo==="PRECO_ALTERADO"));
 await assert.rejects(()=>planejarFechamento({...args,id:draft.id,versao:1}),/PRE_FECHAMENTO_COM_PENDENCIAS/);
 await prisma.itemCatalogo.update({where:{id:ids.it2},data:{precoVenda:"70.00"}});
 const entries=await listarRascunhos(args);
 assert(entries.some(x=>x.id===draft.id));
 assert.equal(await prisma.venda.count({where:{comandaId:draft.id}}),0,"Saving a separate draft must not create a sale");
 assert.equal(await prisma.pagamento.count(),0,"Draft must not create payments");
 const updated=await salvarRascunho({...args,itens:[{empresaId:ids.co1,itemCatalogoId:ids.it1,quantidade:2}]},{id:draft.id,versao:1});
 assert.equal(updated.total,"360.00");
 assert.equal(updated.versao,2);
 await assert.rejects(()=>conferirPreFechamento({...args,id:draft.id,versao:1}),/RASCUNHO_DESATUALIZADO/);
 const beforeFailure=await prisma.comandaItem.findMany({where:{comandaId:draft.id},select:{id:true,itemCatalogoId:true}});
 await assert.rejects(()=>salvarRascunho({...args,itens:[{empresaId:ids.co1,itemCatalogoId:ids.it2,quantidade:1}]},{id:draft.id,versao:2}),/ITEM_INVALIDO/);
 const afterFailure=await prisma.comandaItem.findMany({where:{comandaId:draft.id},select:{id:true,itemCatalogoId:true}});
 assert.deepEqual(afterFailure,beforeFailure,"Failed draft update must preserve original item rows");
 const revisionAfterFailure=await prisma.comanda.findUnique({where:{id:draft.id},select:{versaoRascunho:true}});
 assert.equal(revisionAfterFailure.versaoRascunho,2,"Failed update must preserve revision");
 await assert.rejects(()=>salvarRascunho(args,{id:draft.id,versao:1}),/RASCUNHO_DESATUALIZADO/);
 // Revocation invalidates any stale authorization to a participating company.
 await prisma.usuarioEmpresa.update({where:{usuarioId_empresaId:{usuarioId:ids.user,empresaId:ids.co2}},data:{ativo:false}});
 await assert.rejects(()=>simularComanda(args),/EMPRESA_SEM_ACESSO/);
 const entriesAfter=await listarRascunhos(args);
 assert(entriesAfter.some(x=>x.id===draft.id),"Draft now has only authorized company's line");
 await assert.rejects(()=>simularComanda({...args,organizacaoId:ids.other}),/CLIENTE_NAO_ENCONTRADO/);

 // M.3B — único fechamento manual multiempresa, incluindo estoque e recebíveis.
 // Esta validação vem APÓS os testes legados para não afetar asserts de zero pagamentos.
 await prisma.usuarioEmpresa.update({
  where:{usuarioId_empresaId:{usuarioId:ids.user,empresaId:ids.co2}},data:{ativo:true}
 });
 const product=await prisma.produto.create({data:{
  itemId:ids.it1,controlaEstoque:true,controlaLote:false
 }});
 await prisma.estoqueSaldo.create({data:{produtoId:product.id,quantidade:"10.000"}});
 const closingDraft=await salvarRascunho(args);
 const closingCtx={...args,id:closingDraft.id,versao:1};
 await reservarOperacoesFechamento(closingCtx);
 await prepararExecucaoUnificada({...closingCtx,dados:proper});
 await registrarRecebimentoManualSomenteSandbox({...closingCtx,dados:declared});
 await criarVendasFilhasSomenteSandbox(closingCtx);
 await assert.rejects(()=>efetivarRecebimentosManuaisSomenteSandbox({
  ...closingCtx,simularFalhaAposEmpresaId:ids.co1
 }),/M3_FALHA_SIMULADA_TRANSACAO/);
 assert.equal(await prisma.pagamento.count({where:{venda:{comandaId:closingDraft.id}}}),0);
 assert.equal(await prisma.parcelaRecebivelManualUnificado.count(),0);
 assert.equal(Number((await prisma.estoqueSaldo.findUnique({
  where:{produtoId:product.id}
 })).quantidade),10,"Rollback must restore stock");
 assert.equal(await prisma.venda.count({where:{
  comandaId:closingDraft.id,status:"FINALIZADA"
 }}),0);
 const closings=await Promise.allSettled([
  efetivarRecebimentosManuaisSomenteSandbox(closingCtx),
  efetivarRecebimentosManuaisSomenteSandbox(closingCtx)
 ]);
 assert(closings.some(x=>x.status==="fulfilled"),
  "One close must commit: "+closings.map(x=>String(x.reason?.message||x.status)).join(", "));
 const closed=await efetivarRecebimentosManuaisSomenteSandbox(closingCtx);
 assert.equal(closed.reutilizada,true);
 assert.equal(closed.vendas.length,2);
 assert.equal(await prisma.pagamento.count({where:{
  venda:{comandaId:closingDraft.id}
 }}),2,"Exactly one payment per manual declaration line");
 assert.equal(await prisma.parcelaRecebivelManualUnificado.count(),3);
 const receipts=await prisma.parcelaRecebivelManualUnificado.findMany({
  orderBy:{indice:"asc"}
 });
 assert(receipts.every(r=>r.status==="AGUARDANDO_REPASSE"&&r.vencimentoEm===null));
 assert.deepEqual(receipts.map(r=>Number(r.valor)),[60,60,60]);
 assert.equal(await prisma.venda.count({where:{
  comandaId:closingDraft.id,status:"FINALIZADA"
 }}),2);
 assert.equal(await prisma.movimentacaoEstoque.count({where:{
  origemTipo:"VENDA",origemId:{in:closed.vendas.map(v=>v.vendaId)}
 }}),1);
 assert.equal(Number((await prisma.estoqueSaldo.findUnique({
  where:{produtoId:product.id}
 })).quantidade),9);
 assert.equal((await prisma.comanda.findUnique({where:{id:closingDraft.id}})).status,"FECHADA");
 assert.equal(await prisma.documentoFiscal.count({where:{
  venda:{comandaId:closingDraft.id}
 }}),0,"M.3B must not emit fiscal documents");
 const lines=await prisma.linhaRecebimentoManualUnificado.findMany({
  where:{registro:{reserva:{comandaId:closingDraft.id}}}
 });
 assert(lines.every(l=>l.pagamentoId));
 assert.equal(await prisma.movimentacaoCaixa.count({where:{
  referenciaTipo:"PAGAMENTO",referenciaId:{in:lines.map(l=>l.pagamentoId)}
 }}),0,"No fake cash movement for debit or credit");
 await assert.rejects(()=>efetivarRecebimentosManuaisSomenteSandbox({
  ...closingCtx,organizacaoId:ids.other
 }),/RASCUNHO_NAO_ENCONTRADO/);

 // Insufficient stock cannot finalize ANY company nor consume a declaration.
 const depleted=await salvarRascunho({...args,itens:[
  {empresaId:ids.co1,itemCatalogoId:ids.it1,quantidade:25},
  {empresaId:ids.co2,itemCatalogoId:ids.it2,quantidade:1}
 ]});
 const shortage={...args,id:depleted.id,versao:1};
 await reservarOperacoesFechamento(shortage);
 const shortAllocation={versao:1,alocacoes:[
  {empresaId:ids.co1,sessaoCaixaId:session1.id,pagamentos:[{forma:"DINHEIRO",valorCentavos:450000}]},
  {empresaId:ids.co2,sessaoCaixaId:session2.id,pagamentos:[{forma:"PIX",valorCentavos:7000}]}
 ]};
 await prepararExecucaoUnificada({...shortage,dados:shortAllocation});
 await registrarRecebimentoManualSomenteSandbox({...shortage,dados:{
  versao:1,alocacoes:shortAllocation.alocacoes.map(a=>({
   ...a,pagamentos:a.pagamentos.map(p=>({...p,confirmadoPeloAtendente:true}))
  }))
 }});
 await criarVendasFilhasSomenteSandbox(shortage);
 await assert.rejects(()=>efetivarRecebimentosManuaisSomenteSandbox(shortage),
  /M3_ESTOQUE_INSUFICIENTE/);
 assert.equal(await prisma.pagamento.count({where:{venda:{comandaId:depleted.id}}}),0);
 assert.equal(await prisma.venda.count({where:{
  comandaId:depleted.id,status:"FINALIZADA"
 }}),0);
 assert.equal(Number((await prisma.estoqueSaldo.findUnique({
  where:{produtoId:product.id}
 })).quantidade),9);


 // M.3C — Estorno manual integral, preservando histórico e compensando estoque.
 const reverseCtx={...closingCtx,dados:{
  motivo:"Devolução confirmada fora do PDV para todos os CNPJs",
  referenciaExterna:"CI_REV_"+suffix,confirmouDevolucaoExterna:true
 }};
 await assert.rejects(()=>estornarFechamentoManualSomenteSandbox({
  ...reverseCtx,dados:{...reverseCtx.dados,confirmouDevolucaoExterna:false}
 }),/M3C_CONFIRMACAO_EXTERNA/);
 const p0=receipts[0];
 await prisma.parcelaRecebivelManualUnificado.update({where:{id:p0.id},
  data:{status:"CONCILIADA",conciliadoEm:new Date()}});
 await assert.rejects(()=>estornarFechamentoManualSomenteSandbox(reverseCtx),
  /M3C_REPASSE_CONCILIADO/);
 await prisma.parcelaRecebivelManualUnificado.update({where:{id:p0.id},
  data:{status:"AGUARDANDO_REPASSE",conciliadoEm:null}});
 await prisma.sessaoCaixa.update({where:{id:session1.id},data:{status:"FECHADO"}});
 await assert.rejects(()=>estornarFechamentoManualSomenteSandbox(reverseCtx),
  /M3C_CAIXA_FECHADO/);
 await prisma.sessaoCaixa.update({where:{id:session1.id},data:{status:"ABERTO"}});
 await prisma.cargoPermissao.delete({where:{
  cargoId_permissaoId:{cargoId:cargo.id,permissaoId:cancelPermission.id}
 }});
 await assert.rejects(()=>estornarFechamentoManualSomenteSandbox(reverseCtx),
  /M3C_SEM_PERMISSAO_ESTORNO/);
 await prisma.cargoPermissao.create({data:{cargoId:cargo.id,permissaoId:cancelPermission.id}});
 await assert.rejects(()=>estornarFechamentoManualSomenteSandbox({
  ...reverseCtx,simularFalhaAposEmpresaId:ids.co1
 }),/M3C_FALHA_SIMULADA_TRANSACAO/);
 assert.equal(await prisma.estornoFechamentoManualUnificado.count(),0);
 assert.equal(await prisma.pagamento.count({where:{
  venda:{comandaId:closingDraft.id},status:"ESTORNADO"
 }}),0);
 assert.equal(await prisma.movimentacaoEstoque.count({where:{
  origemTipo:"ESTORNO_MANUAL_UNIFICADO"
 }}),0);
 assert.equal(Number((await prisma.estoqueSaldo.findUnique({
  where:{produtoId:product.id}
 })).quantidade),9);
 const concurrentReverse=await Promise.allSettled([
  estornarFechamentoManualSomenteSandbox(reverseCtx),
  estornarFechamentoManualSomenteSandbox(reverseCtx)
 ]);
 assert(concurrentReverse.some(x=>x.status==="fulfilled"),
  "One reversal must commit: "+concurrentReverse.map(x=>x.reason?.message||x.status).join(", "));
 const reverse=await estornarFechamentoManualSomenteSandbox(reverseCtx);
 assert.equal(reverse.reutilizada,true);
 assert.equal(reverse.houveRefundPorAPI,false);
 assert.equal(await prisma.estornoFechamentoManualUnificado.count(),1);
 assert.equal(await prisma.venda.count({where:{
  comandaId:closingDraft.id,status:"ESTORNADA"
 }}),2);
 assert.equal(await prisma.pagamento.count({where:{
  venda:{comandaId:closingDraft.id},status:"ESTORNADO"
 }}),2);
 assert.equal(await prisma.parcelaRecebivelManualUnificado.count({
  where:{status:"ESTORNADA"}
 }),3);
 assert.equal(await prisma.movimentacaoEstoque.count({where:{
  origemTipo:"ESTORNO_MANUAL_UNIFICADO",origemId:reverse.id
 }}),1);
 assert.equal(Number((await prisma.estoqueSaldo.findUnique({
  where:{produtoId:product.id}
 })).quantidade),10);
 assert.equal((await prisma.comanda.findUnique({where:{id:closingDraft.id}})).status,"CANCELADA");
 await assert.rejects(()=>estornarFechamentoManualSomenteSandbox({
  ...reverseCtx,dados:{...reverseCtx.dados,motivo:"Estorno diferente"}
 }),/M3C_ESTORNO_DIVERGENTE/);
 await assert.rejects(()=>estornarFechamentoManualSomenteSandbox({
  ...reverseCtx,organizacaoId:ids.other
 }),/RASCUNHO_NAO_ENCONTRADO/);
 await assert.rejects(()=>efetivarRecebimentosManuaisSomenteSandbox(closingCtx),
  /RESERVA_NAO_EDITAVEL/);


 // M.3C — lote FEFO + dinheiro físico, sem dupla saída no caixa.
 await prisma.produto.update({where:{id:product.id},data:{controlaLote:true}});
 const lote=await prisma.loteProduto.create({data:{
  produtoId:product.id,numeroLote:"CI_M3C_LOTE_"+suffix,quantidadeAtual:"10.000"
 }});
 const cashDraft=await salvarRascunho(args);
 const cashCtx={...args,id:cashDraft.id,versao:1};
 const cashPayments={versao:1,alocacoes:[
  {empresaId:ids.co1,sessaoCaixaId:session1.id,pagamentos:[
   {forma:"DINHEIRO",valorCentavos:18000,confirmadoPeloAtendente:true}
  ]},
  {empresaId:ids.co2,sessaoCaixaId:session2.id,pagamentos:[
   {forma:"PIX",valorCentavos:14000,confirmadoPeloAtendente:true}
  ]}
 ]};
 await reservarOperacoesFechamento(cashCtx);
 await prepararExecucaoUnificada({...cashCtx,dados:{versao:1,
  alocacoes:cashPayments.alocacoes.map(a=>({
   empresaId:a.empresaId,sessaoCaixaId:a.sessaoCaixaId,
   pagamentos:a.pagamentos.map(p=>({forma:p.forma,valorCentavos:p.valorCentavos}))
  }))
 }});
 await registrarRecebimentoManualSomenteSandbox({...cashCtx,dados:cashPayments});
 await criarVendasFilhasSomenteSandbox(cashCtx);
 await efetivarRecebimentosManuaisSomenteSandbox(cashCtx);
 assert.equal(Number((await prisma.loteProduto.findUnique({where:{id:lote.id}})).quantidadeAtual),9);
 assert.equal(Number((await prisma.estoqueSaldo.findUnique({where:{produtoId:product.id}})).quantidade),9);
 const cashSales=await prisma.venda.findMany({where:{comandaId:cashDraft.id}});
 const cashSaleIds=cashSales.map(v=>v.id);
 const cashPayment=await prisma.pagamento.findFirst({where:{
  vendaId:cashSales.find(s=>s.empresaId===ids.co1).id,forma:"DINHEIRO"
 }});
 assert.equal(cashPayment.status,"APROVADO");
 assert.equal(await prisma.movimentacaoCaixa.count({where:{
  referenciaTipo:"PAGAMENTO",referenciaId:cashPayment.id,tipo:"VENDA"
 }}),1);
 // A title tied to this sale prevents automatic reimbursement, even in CI.
 const title=await prisma.tituloFinanceiro.create({data:{
  organizacaoId:ids.org,empresaId:ids.co1,tipo:"RECEBER",
  descricao:"Bloqueio de vínculo financeiro M3C CI",valorOriginal:"180.00",
  vendaId:cashSales.find(s=>s.empresaId===ids.co1).id
 }});
 const cashReverse={...cashCtx,dados:{
  motivo:"Devolução de dinheiro e cancelamento Pix conferidos fora do PDV",
  confirmouDevolucaoExterna:true,referenciaExterna:"LOTE_CI_"+suffix
 }};
 await assert.rejects(()=>estornarFechamentoManualSomenteSandbox(cashReverse),
  /M3C_FINANCEIRO_CONCILIADO_OU_VINCULADO/);
 await prisma.tituloFinanceiro.delete({where:{id:title.id}});
 const cashBack=await estornarFechamentoManualSomenteSandbox(cashReverse);
 assert.equal(cashBack.reutilizada,false);
 assert.equal(Number((await prisma.loteProduto.findUnique({where:{id:lote.id}})).quantidadeAtual),10);
 assert.equal(Number((await prisma.estoqueSaldo.findUnique({where:{produtoId:product.id}})).quantidade),10);
 assert.equal((await prisma.pagamento.findUnique({where:{id:cashPayment.id}})).status,"ESTORNADO");
 assert.equal(await prisma.movimentacaoCaixa.count({where:{
  referenciaTipo:"ESTORNO_MANUAL_UNIFICADO",referenciaId:cashBack.id,tipo:"VENDA"
 }}),1,"Reversal is a cash AUDIT marker only");
 assert.equal(await prisma.movimentacaoCaixa.count({where:{
  tipo:"ESTORNO",referenciaId:{in:cashSaleIds}
 }}),0,"Must NOT double-subtract cash");
 assert.equal(await prisma.movimentacaoEstoque.count({where:{
  origemTipo:"ESTORNO_MANUAL_UNIFICADO",origemId:cashBack.id,loteId:lote.id
 }}),1,"Lot-specific compensation must exist");
 assert.equal((await prisma.pagamento.aggregate({where:{
  sessaoCaixaId:session1.id,forma:"DINHEIRO",status:"APROVADO"
 },_sum:{valor:true}}))._sum.valor,null,"Legacy cash sums only approved money");


 // M.4A — quota foundation coexists with M.3C without fiscal, sales or payments.
 const beforeQuotes={
  vendas:await prisma.venda.count(),pagamentos:await prisma.pagamento.count(),
  estoque:await prisma.movimentacaoEstoque.count(),fiscal:await prisma.documentoFiscal.count()
 };
 assert.equal(quoteCreateSchema.safeParse({
  clienteId:ids.client,desconto:0,itens:[{descricao:"Dose CI",quantidade:1,valorUnitario:2.999}]
 }).success,false,"Reject hidden fractions of cents");
 assert.equal(quoteCreateSchema.safeParse({
  clienteId:ids.client,desconto:0,itens:[{descricao:"Dose CI",quantidade:1.0009,valorUnitario:3}]
 }).success,false,"Reject quantity with more than 3 decimals");
 const newQuoteData=quoteCreateSchema.parse({
  clienteId:ids.client,desconto:5,
  itens:[{descricao:"Orçamento Ração",quantidade:1,valorUnitario:180},
         {descricao:"Acompanhamento",quantidade:2,valorUnitario:25.5}]
 });
 await assert.rejects(()=>createQuote(ids.other,ids.co1,newQuoteData,ids.user),
  /CADASTRO_INVALIDO/);
 await assert.rejects(()=>createQuote(ids.org,ids.co2,{
  ...newQuoteData,itens:[{...newQuoteData.itens[0],petId:"not_owned"}]
 },ids.user),/PET_INVALIDO/);
 await assert.rejects(()=>createQuote(ids.org,ids.co1,{
  ...newQuoteData,desconto:999999
 },ids.user),/DESCONTO_INVALIDO/);
 const quote=await createQuote(ids.org,ids.co1,newQuoteData,ids.user);
 assert.equal(quote.status,"RASCUNHO");
 assert.equal(quote.total,226);
 assert.equal((await listQuotes(ids.org,ids.co1,ids.client)).length,1);
 assert.equal((await listQuotes(ids.org,ids.co2,ids.client)).length,0,
  "A quote must remain visible only in its issuer company");
 await assert.rejects(()=>listQuotes(ids.other,ids.co1,ids.client),/CADASTRO_INVALIDO/);
 await assert.rejects(()=>setQuoteStatus(ids.org,ids.co2,ids.client,quote.id,"APROVADO",ids.user),
  /ORCAMENTO_NAO_ENCONTRADO/);
 const approvalRace=await Promise.allSettled([
  setQuoteStatus(ids.org,ids.co1,ids.client,quote.id,"APROVADO",ids.user),
  setQuoteStatus(ids.org,ids.co1,ids.client,quote.id,"APROVADO",ids.user)
 ]);
 assert.equal(approvalRace.filter(x=>x.status==="fulfilled").length,1,
  "Only one approval is allowed, without duplicate cash or reservation");
 assert.equal((await prisma.orcamentoCliente.findUnique({where:{id:quote.id}})).status,
  "APROVADO");
 await assert.rejects(()=>setQuoteStatus(ids.org,ids.co1,ids.client,quote.id,"CANCELADO",ids.user),
  /ORCAMENTO_FECHADO/);
 assert.equal(await prisma.auditoria.count({where:{
  organizacaoId:ids.org,empresaId:ids.co1,entidadeId:quote.id
 }}),2,"Quote creation/approval must both be audited");
 assert.deepEqual({
  vendas:await prisma.venda.count(),pagamentos:await prisma.pagamento.count(),
  estoque:await prisma.movimentacaoEstoque.count(),fiscal:await prisma.documentoFiscal.count()
 },beforeQuotes,"Quote approval cannot create sales, fiscal docs, payments or stock");
 const emptyWallet=await creditLedger(ids.org,ids.co1,ids.client);
 assert.equal(emptyWallet.saldo,0);
 assert.equal(emptyWallet.lancamentosHabilitados,false);
 assert.equal(emptyWallet.usoNoPdvHabilitado,false);
 await assert.rejects(()=>creditLedger(ids.other,ids.co1,ids.client),/CADASTRO_INVALIDO/);
 // Synthetic contradictory ledger rows inserted by fixture, NEVER a public credit endpoint.
 await prisma.creditoClienteMovimento.createMany({data:[
  {organizacaoId:ids.org,empresaId:ids.co1,clienteId:ids.client,
   tipo:"ENTRADA",valor:"40.00",idempotencia:"m4a-credit-"+suffix},
  {organizacaoId:ids.org,empresaId:ids.co1,clienteId:ids.client,
   tipo:"ESTORNO",valor:"40.00",idempotencia:"m4a-reversal-"+suffix}
 ]});
 const ambiguous=await creditLedger(ids.org,ids.co1,ids.client);
 assert.equal(ambiguous.saldo,null,"Never guess the direction of an unlinked reversal");
 assert.equal(ambiguous.saldoConfiavel,false);
 assert.equal(ambiguous.motivoSaldoIndisponivel,"ESTORNO_SEM_VINCULO_ORIGINAL");
 assert.equal((await creditLedger(ids.org,ids.co2,ids.client)).saldo,0,
  "Prepaid credit cannot cross company boundaries");


 // M.4A — explicit one-to-one mapping, read-only checked against current catalog.
 const sameItemQuote=await createQuote(ids.org,ids.co1,quoteCreateSchema.parse({
  clienteId:ids.client,itens:[{descricao:"Ração",quantidade:1,valorUnitario:180}]
 }),ids.user);
 await assert.rejects(()=>previsualizarOrcamentoNoPdvUnificado({
  organizacaoId:ids.org,usuarioId:ids.user,empresaId:ids.co1,clienteId:ids.client,
  orcamentoId:sameItemQuote.id,vinculos:[]}),/M4A_ORCAMENTO_NAO_APROVADO/);
 await setQuoteStatus(ids.org,ids.co1,ids.client,sameItemQuote.id,"APROVADO",ids.user);
 const quoteRow=(await prisma.orcamentoClienteItem.findFirst({
  where:{orcamentoId:sameItemQuote.id}
 }));
 const previewArgs={organizacaoId:ids.org,usuarioId:ids.user,empresaId:ids.co1,
  clienteId:ids.client,orcamentoId:sameItemQuote.id,
  vinculos:[{orcamentoItemId:quoteRow.id,itemCatalogoId:ids.it1}]};
 await assert.rejects(()=>previsualizarOrcamentoNoPdvUnificado({
  ...previewArgs,vinculos:[]}),/M4A_MAPEAMENTO_INCOMPLETO/);
 await assert.rejects(()=>previsualizarOrcamentoNoPdvUnificado({
  ...previewArgs,vinculos:[{orcamentoItemId:quoteRow.id,itemCatalogoId:ids.it2}]
 }),/M4A_CATALOGO_EMPRESA_INCOMPATIVEL/);
 const frozen={
  vendas:await prisma.venda.count(),pagamentos:await prisma.pagamento.count(),
  estoque:await prisma.movimentacaoEstoque.count(),fiscal:await prisma.documentoFiscal.count()
 };
 const quotePreview=await previsualizarOrcamentoNoPdvUnificado(previewArgs);
 assert.equal(quotePreview.modo,"PREVIA_ORCAMENTO_SEM_CONVERSAO");
 assert.equal(quotePreview.total,"180.00");
 assert.equal(quotePreview.podeCriarRascunho,false);
 assert.equal(quotePreview.podeFecharVenda,false);
 assert.equal(quotePreview.movimentouEstoque,false);
 await prisma.itemCatalogo.update({where:{id:ids.it1},data:{precoVenda:"181.00"}});
 await assert.rejects(()=>previsualizarOrcamentoNoPdvUnificado(previewArgs),
  /M4A_CATALOGO_PRECO_OU_DESCRICAO_DIVERGENTE/);
 await prisma.itemCatalogo.update({where:{id:ids.it1},data:{precoVenda:"180.00"}});
 assert.deepEqual({
  vendas:await prisma.venda.count(),pagamentos:await prisma.pagamento.count(),
  estoque:await prisma.movimentacaoEstoque.count(),fiscal:await prisma.documentoFiscal.count()
 },frozen,"Read-only quote preview must never book money, sales or stock");


 // M.4B — approved quote to exactly one durable unified DRAFT in disposable CI.
 const convArgs={...previewArgs};
 const physicalBefore={
  comanda:await prisma.comanda.count(),vendas:await prisma.venda.count(),
  pagamentos:await prisma.pagamento.count(),
  caixa:await prisma.movimentacaoCaixa.count(),
  estoque:await prisma.movimentacaoEstoque.count(),
  fiscal:await prisma.documentoFiscal.count(),
  credit:await prisma.creditoClienteMovimento.count()
 };
 await assert.rejects(()=>converterOrcamentoEmRascunhoSomenteSandbox({
  ...convArgs,simularFalhaDepoisDaComanda:true
 }),/M4B_FALHA_SIMULADA_TRANSACAO/);
 assert.equal(await prisma.conversaoOrcamentoPdv.count(),0);
 assert.equal(await prisma.comanda.count(),physicalBefore.comanda,
  "Conversion must roll back draft creation on any failure");
 await prisma.cargoPermissao.delete({where:{
  cargoId_permissaoId:{cargoId:manager.id,permissaoId:financePermission.id}
 }});
 await assert.rejects(()=>converterOrcamentoEmRascunhoSomenteSandbox(convArgs),
  /M4B_PERMISSOES_INSUFICIENTES/);
 await prisma.cargoPermissao.create({data:{
  cargoId:manager.id,permissaoId:financePermission.id
 }});
 await assert.rejects(()=>converterOrcamentoEmRascunhoSomenteSandbox({
  ...convArgs,organizacaoId:ids.other
 }),/M4B_PERMISSOES_INSUFICIENTES|ORCAMENTO_NAO_ENCONTRADO/);
 const conversionRace=await Promise.allSettled([
  converterOrcamentoEmRascunhoSomenteSandbox(convArgs),
  converterOrcamentoEmRascunhoSomenteSandbox(convArgs)
 ]);
 assert(conversionRace.some(x=>x.status==="fulfilled"),
  "Exactly one conversion must complete: "+
  conversionRace.map(x=>x.reason?.message||x.status).join(", "));
 const conversion=await converterOrcamentoEmRascunhoSomenteSandbox(convArgs);
 assert.equal(conversion.reutilizada,true);
 assert.equal(conversion.modo,"RASCUNHO_PDV_UNIFICADO_CI");
 assert.equal(conversion.total,"180.00");
 assert.equal(conversion.checkoutHabilitado,false);
 assert.equal(await prisma.conversaoOrcamentoPdv.count({
  where:{orcamentoId:sameItemQuote.id}
 }),1);
 assert.equal(await prisma.conversaoOrcamentoPdvItem.count({
  where:{conversao:{orcamentoId:sameItemQuote.id}}
 }),1);
 const fromQuote=await prisma.comanda.findUnique({
  where:{id:conversion.rascunhoId},include:{itens:true}
 });
 assert.equal(fromQuote.rascunhoUnificado,true);
 assert.equal(fromQuote.status,"ABERTA");
 assert.equal(fromQuote.itens.length,1);
 assert.equal(fromQuote.itens[0].itemCatalogoId,ids.it1);
 assert.equal(await prisma.auditoria.count({where:{
  entidade:"OrcamentoCliente",entidadeId:sameItemQuote.id,
  acao:"ORCAMENTO_CONVERTIDO_RASCUNHO_CI"
 }}),1);
 await assert.rejects(()=>converterOrcamentoEmRascunhoSomenteSandbox({
  ...convArgs,vinculos:[{orcamentoItemId:quoteRow.id,itemCatalogoId:ids.it2}]
 }),/M4B_CONVERSAO_DIVERGENTE/);
 const unchanged={
  vendas:await prisma.venda.count(),pagamentos:await prisma.pagamento.count(),
  caixa:await prisma.movimentacaoCaixa.count(),
  estoque:await prisma.movimentacaoEstoque.count(),
  fiscal:await prisma.documentoFiscal.count(),
  credit:await prisma.creditoClienteMovimento.count()
 };
 assert.deepEqual(unchanged,{
  vendas:physicalBefore.vendas,pagamentos:physicalBefore.pagamentos,
  caixa:physicalBefore.caixa,estoque:physicalBefore.estoque,
  fiscal:physicalBefore.fiscal,credit:physicalBefore.credit
 });
 // Replaying a tampered line MUST fail even when draft revision is unchanged.
 await prisma.comandaItem.update({where:{id:fromQuote.itens[0].id},
  data:{valorTotal:"179.00"}});
 await assert.rejects(()=>converterOrcamentoEmRascunhoSomenteSandbox(convArgs),
  /M4B_CONVERSAO_JA_ALTERADA/);
 await prisma.comandaItem.update({where:{id:fromQuote.itens[0].id},
  data:{valorTotal:"180.00"}});
 assert.equal((await converterOrcamentoEmRascunhoSomenteSandbox(convArgs)).reutilizada,true);
 // Draft edits invalidate replay; immutable conversion record prevents a second draft.
 const changeDraft=await salvarRascunho({
  ...args,clienteId:ids.client,itens:[{empresaId:ids.co1,
   itemCatalogoId:ids.it1,quantidade:1}]
 },{id:conversion.rascunhoId,versao:1});
 assert.equal(changeDraft.versao,2);
 await assert.rejects(()=>converterOrcamentoEmRascunhoSomenteSandbox(convArgs),
  /M4B_CONVERSAO_JA_ALTERADA/);
 assert.equal(await prisma.conversaoOrcamentoPdv.count({
  where:{orcamentoId:sameItemQuote.id}
 }),1);

});
