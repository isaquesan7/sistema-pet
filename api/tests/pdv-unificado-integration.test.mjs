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
import {conciliarParcelaCartaoSomenteSandbox} from "../src/modules/pdv/pdv-unificado-conciliacao-manual-sandbox.service.js";
import {planejarBaixaCartaoM59} from "../src/modules/pdv/pdv-unificado-baixa-cartao.contract.js";
import {registrarPreBaixaCartaoSomenteSandbox} from "../src/modules/pdv/pdv-unificado-pre-baixa-sandbox.service.js";
import {registrarParecerPreBaixaSomenteSandbox} from "../src/modules/pdv/pdv-unificado-parecer-documental-sandbox.service.js";
import {diagnosticarPreBaixaSomenteSandbox} from "../src/modules/pdv/pdv-unificado-diagnostico-pre-baixa-sandbox.service.js";
import {registrarRepasseCartaoManualSomenteSandbox} from "../src/modules/pdv/pdv-unificado-repasse-manual-sandbox.service.js";
import {compensarRepasseCartaoManualSomenteSandbox} from "../src/modules/pdv/pdv-unificado-repasse-compensacao-sandbox.service.js";
import {listarHistoricoRepasseCartaoM514,consultarConferenciaManualM515} from "../src/modules/pdv/pdv-unificado-repasse-historico.service.js";
import {consultarEtapasRepassesM516} from "../src/modules/pdv/pdv-unificado-fluxo-operacional.service.js";
import {discriminarTarifasAntecipacoesM520} from "../src/modules/pdv/pdv-unificado-discriminacao-tarifas.contract.js";
import {planejarDevolucaoAposRepasseM521,simularDevolucaoAposRepasseM521} from "../src/modules/pdv/pdv-unificado-estorno-pos-repasse.contract.js";
import {registrarDevolucaoExternaDeclaradaSomenteSandbox} from "../src/modules/pdv/pdv-unificado-devolucao-declarada-sandbox.service.js";
import {planejarIntencoesManuaisM517,simularIntencaoManualM517} from "../src/modules/pdv/pdv-unificado-intencao-manual.contract.js";
import {consultarResumoRecebiveisCartaoSomenteSandbox} from "../src/modules/pdv/pdv-unificado-resumo-recebiveis-sandbox.service.js";
import {listarComandasRecebiveisCartaoLeituraM57,consultarRecebiveisCartaoLeituraM57} from "../src/modules/pdv/pdv-unificado-recebiveis-leitura.service.js";
import {resumo as resumoFinanceiro,fluxo as fluxoFinanceiro,pendentesConciliacao,listarContas,conciliar as conciliarFinanceiro,desconciliar as desconciliarFinanceiro} from "../src/modules/financeiro/financeiro.service.js";
import {createSchema as quoteCreateSchema,createQuote,listQuotes,setQuoteStatus,creditLedger} from "../src/modules/clientes/client-finance.service.js";
import {previsualizarOrcamentoNoPdvUnificado} from "../src/modules/clientes/client-quote-pdv-preview.service.js";
import {converterOrcamentoEmRascunhoSomenteSandbox} from "../src/modules/clientes/client-quote-pdv-conversion-sandbox.service.js";
import {prepararVendaFilhaFiscalSomenteSandbox} from "../src/modules/fiscal/fiscal-unificado-venda-sandbox.service.js";
import {prepararFluxoFiscalSomenteSandbox,registrarEventoFiscalSimuladoSomenteSandbox,
 diagnosticarFluxoFiscalSomenteSandbox}
 from "../src/modules/fiscal/fiscal-unificado-protocolo-ci-sandbox.service.js";
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

 // M.4C.2: each REAL finalized child sale in disposable CI has its OWN
 // issuer and tax class. Preparing a fiscal preview never creates a tax doc.
 const fiscalPermission=await prisma.permissao.upsert({where:{codigo:"fiscal.visualizar"},
  update:{},create:{codigo:"fiscal.visualizar",nome:"Consultar fiscal"}
 });
 const childA=closed.vendas.find(v=>v.empresaId===ids.co1);
 const childB=closed.vendas.find(v=>v.empresaId===ids.co2);
 const fiscalInputA={organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,
  vendaId:childA.vendaId,escolhas:[{classe:"PRODUTO",tipoDocumento:"NFE"}]};
 const fiscalInputB={organizacaoId:ids.org,empresaId:ids.co2,usuarioId:ids.user,
  vendaId:childB.vendaId,escolhas:[{classe:"SERVICO",tipoDocumento:"NFSE"}]};
 await assert.rejects(()=>prepararVendaFilhaFiscalSomenteSandbox(fiscalInputA),
  /M4C2_PERMISSOES_INSUFICIENTES/);
 await prisma.cargoPermissao.createMany({data:[
  {cargoId:manager.id,permissaoId:fiscalPermission.id},
  {cargoId:cargo.id,permissaoId:fiscalPermission.id}
 ]});
 await prisma.configuracaoFiscalEmpresa.createMany({data:[
  {empresaId:ids.co1,regime:"SIMPLES_NACIONAL",ambiente:"HOMOLOGACAO",
   serieNfe:"1",serieNfce:"2",provedorFiscal:"CI_NAO_TRANSMITIR"},
  {empresaId:ids.co2,regime:"SIMPLES_NACIONAL",ambiente:"HOMOLOGACAO",
   serieNfse:"1",codigoMunicipioIbge:"2927408",provedorFiscal:"CI_NAO_TRANSMITIR"}
 ]});
 await prisma.configuracaoFiscalItem.createMany({data:[
  {itemCatalogoId:ids.it1,ncm:"23091000",cfop:"5102",
   origemMercadoria:"0",cstCsosn:"102"},
  {itemCatalogoId:ids.it2,codigoServicoMunicipal:"TESTE"}
 ]});
 const fiscalCountBefore=await prisma.documentoFiscal.count();
 const beforeFiscalRead={
  vendas:await prisma.venda.count(),pagamentos:await prisma.pagamento.count(),
  estoque:await prisma.movimentacaoEstoque.count(),caixa:await prisma.movimentacaoCaixa.count()
 };
 const fiscalA=await prepararVendaFilhaFiscalSomenteSandbox(fiscalInputA);
 const fiscalB=await prepararVendaFilhaFiscalSomenteSandbox(fiscalInputB);
 assert.equal(fiscalA.total,"180.00");
 assert.equal(fiscalB.total,"140.00");
 assert.equal(fiscalA.grupos[0].tipoDocumentoEscolhido,"NFE");
 assert.equal(fiscalB.grupos[0].tipoDocumentoEscolhido,"NFSE");
 assert.equal(fiscalA.grupos[0].emissor.empresaId,ids.co1);
 assert.equal(fiscalB.grupos[0].emissor.empresaId,ids.co2);
 assert.notEqual(fiscalA.fingerprint,fiscalB.fingerprint);
 assert.equal(fiscalA.emissaoDisponivel,false);
 assert.equal(fiscalA.gerouDocumento,false);
 assert.equal(fiscalB.transmitiu,false);
 assert.deepEqual(await prepararVendaFilhaFiscalSomenteSandbox(fiscalInputA),fiscalA);
 await assert.rejects(()=>prepararVendaFilhaFiscalSomenteSandbox({
  ...fiscalInputA,escolhas:[{classe:"PRODUTO",tipoDocumento:"RECIBO"}]
 }),/M4C2_TIPO_DOCUMENTO_INCOMPATIVEL/);
 await assert.rejects(()=>prepararVendaFilhaFiscalSomenteSandbox({
  ...fiscalInputA,organizacaoId:ids.other
 }),/M4C2_USUARIO_OU_EMPRESA_SEM_ACESSO/);
 await assert.rejects(()=>prepararVendaFilhaFiscalSomenteSandbox({
  ...fiscalInputA,empresaId:ids.co2
 }),/M4C2_VENDA_FILHA_NAO_ENCONTRADA/);
 await prisma.cargoPermissao.delete({where:{cargoId_permissaoId:{
  cargoId:cargo.id,permissaoId:fiscalPermission.id
 }}});
 await assert.rejects(()=>prepararVendaFilhaFiscalSomenteSandbox(fiscalInputB),
  /M4C2_PERMISSOES_INSUFICIENTES/);
 await prisma.cargoPermissao.create({data:{
  cargoId:cargo.id,permissaoId:fiscalPermission.id
 }});
 // M.4D.1: durable test-only fiscal protocol on already finalized child sales.
 // Despite the names of simulated events, NO official authorization exists.
 await prisma.usuarioOrganizacao.create({data:{
  usuarioId:ids.user,organizacaoId:ids.org,papel:"ADMINISTRADOR"
 }});
 // M.5.8: opt-in only on synthetic organization. Real organizations unchanged.
 await prisma.configuracaoOrganizacao.upsert({
  where:{organizacaoId:ids.org},
  create:{organizacaoId:ids.org,pdvUnificadoHabilitado:true},
  update:{pdvUnificadoHabilitado:true}
 });
 const emitPerm=await prisma.permissao.upsert({where:{codigo:"fiscal.emitir"},
  update:{},create:{codigo:"fiscal.emitir",nome:"Emitir fiscal"}});
 const cancelFiscal=await prisma.permissao.upsert({where:{codigo:"fiscal.cancelar"},
  update:{},create:{codigo:"fiscal.cancelar",nome:"Cancelar fiscal"}});
 await prisma.empresa.updateMany({
  where:{id:{in:[ids.co1,ids.co2]}},
  data:{cidade:"Salvador",estado:"BA"}
 });
 const m4dA={...fiscalInputA,classe:"PRODUTO",tipoDocumento:"NFE",
  solicitacaoId:"m4d-prepare-a-"+suffix};
 const m4dB={...fiscalInputB,classe:"SERVICO",tipoDocumento:"NFSE",
  solicitacaoId:"m4d-prepare-b-"+suffix};
 await assert.rejects(()=>prepararFluxoFiscalSomenteSandbox(m4dA),
  /M4D_PERMISSAO_FISCAL_INSUFICIENTE/);
 await prisma.cargoPermissao.createMany({data:[
  {cargoId:manager.id,permissaoId:emitPerm.id},
  {cargoId:cargo.id,permissaoId:emitPerm.id}
 ]});
 await assert.rejects(()=>prepararFluxoFiscalSomenteSandbox({
  ...m4dA,organizacaoId:ids.other
 }),/M4D_ACESSO_ORGANIZACAO_EMISSOR_INVALIDO/);
 await assert.rejects(()=>prepararFluxoFiscalSomenteSandbox({
  ...m4dA,empresaId:ids.co2
 }),/M4C2_VENDA_FILHA_NAO_ENCONTRADA/);
 await assert.rejects(()=>prepararFluxoFiscalSomenteSandbox({
  ...m4dA,simularFalhaAposGravar:true
 }),/M4D_FALHA_SIMULADA_PREPARACAO/);
 assert.equal(await prisma.fluxoFiscalUnificadoCi.count({where:{
  vendaId:childA.vendaId
 }}),0);
 const racingPrep=await Promise.allSettled([
  prepararFluxoFiscalSomenteSandbox(m4dA),
  prepararFluxoFiscalSomenteSandbox(m4dA)
 ]);
 assert(racingPrep.some(x=>x.status==="fulfilled"),
  "One fiscal preparation must commit: "+racingPrep.map(x=>x.reason?.message||x.status).join(", "));
 const flowA=await prepararFluxoFiscalSomenteSandbox(m4dA);
 const flowB=await prepararFluxoFiscalSomenteSandbox(m4dB);
 assert.equal(flowA.reutilizada,true);
 assert.equal(flowA.estado,"PREPARADA_CI");
 assert.equal(flowB.estado,"PREPARADA_CI");
 assert.notEqual(flowA.id,flowB.id);
 assert.equal(flowA.empresaId,ids.co1);
 assert.equal(flowB.empresaId,ids.co2);
 assert.equal(flowA.transmissaoHabilitada,false);
 assert.equal(await prisma.documentoFiscal.count(),fiscalCountBefore);
 await assert.rejects(()=>prepararFluxoFiscalSomenteSandbox({
  ...m4dA,solicitacaoId:"m4d-other-a-"+suffix
 }),/M4D_PREPARACAO_REPLAY_DIVERGENTE/);
 const evA={organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,
  fluxoId:flowA.id,chaveEvento:"m4d-inconclusivo-"+suffix,
  tipo:"SIMULAR_RESPOSTA_INDETERMINADA",
  motivo:"Somente CI: resultado incerto; exigir consulta manual"};
 // Moving source fields after preparation revokes all further event actions.
 await prisma.configuracaoFiscalEmpresa.update({where:{empresaId:ids.co1},
  data:{serieNfe:"99"}});
 await assert.rejects(()=>registrarEventoFiscalSimuladoSomenteSandbox(evA),
  /M4D_FONTE_FISCAL_ALTERADA/);
 await prisma.configuracaoFiscalEmpresa.update({where:{empresaId:ids.co1},
  data:{serieNfe:"1"}});
 await assert.rejects(()=>registrarEventoFiscalSimuladoSomenteSandbox({
  ...evA,simularFalhaAposGravar:true
 }),/M4D_FALHA_SIMULADA_EVENTO/);
 assert.equal((await prisma.fluxoFiscalUnificadoCi.findUnique({
  where:{id:flowA.id}
 })).estado,"PREPARADA_CI");
 assert.equal(await prisma.eventoFluxoFiscalUnificadoCi.count({
  where:{fluxoId:flowA.id}
 }),0);
 const indeterminado=await registrarEventoFiscalSimuladoSomenteSandbox(evA);
 assert.equal(indeterminado.estado,"INDETERMINADA_CI");
 assert.equal(indeterminado.exigeConsultaManual,true);
 assert.equal((await registrarEventoFiscalSimuladoSomenteSandbox(evA)).reutilizada,true);
 await assert.rejects(()=>registrarEventoFiscalSimuladoSomenteSandbox({
  ...evA,tipo:"SIMULAR_RESPOSTA_ACEITA"
 }),/M4D_EVENTO_REPLAY_CONFLITANTE/);
 await assert.rejects(()=>registrarEventoFiscalSimuladoSomenteSandbox({
  ...evA,chaveEvento:"m4d-retry-"+suffix,tipo:"SIMULAR_RESPOSTA_ACEITA"
 }),/M4D_TRANSICAO_NAO_PERMITIDA/);
 // M.4D.2: simulated consultation of an unknown result MUST first have a
 // separately authorized internal review. A local review is never SEFAZ proof.
 const reviewRequest={
  ...evA,chaveEvento:"m4d-review-"+suffix,
  tipo:"REGISTRAR_INVESTIGACAO_MANUAL_CI",
  motivo:"Conferencia interna em CI de resultado fiscal inconclusivo",
  referenciaInterna:"CI-investigacao-"+suffix,
  descricaoVerificacao:"Conferimos no ambiente de testes o emissor, venda e a ausencia de protocolo externo."
 };
 const preReview=await diagnosticarFluxoFiscalSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,fluxoId:flowA.id
 });
 assert.equal(preReview.confiavel,true);
 assert.equal(preReview.investigacaoManualNecessaria,true);
 assert.equal(preReview.autorizaNovoEnvio,false);
 await assert.rejects(()=>registrarEventoFiscalSimuladoSomenteSandbox({
  ...evA,chaveEvento:"m4d-consulta-"+suffix,
  tipo:"SIMULAR_CONSULTA_ACEITA",
  motivo:"Consulta manual fictícia confirma estado simulado sem protocolo"
 }),/M4D2_INVESTIGACAO_MANUAL_PREVIA_OBRIGATORIA/);
 await assert.rejects(()=>registrarEventoFiscalSimuladoSomenteSandbox(reviewRequest),
  /M4D_PERMISSAO_FISCAL_INSUFICIENTE/);
 const reviewPermission=await prisma.permissao.upsert({where:{
  codigo:"fiscal.gerenciar"
 },update:{},create:{codigo:"fiscal.gerenciar",nome:"Gerenciar fiscal"}});
 await prisma.cargoPermissao.create({data:{
  cargoId:manager.id,permissaoId:reviewPermission.id
 }});
 await assert.rejects(()=>registrarEventoFiscalSimuladoSomenteSandbox({
  ...reviewRequest,simularFalhaAposGravar:true
 }),/M4D_FALHA_SIMULADA_EVENTO/);
 assert.equal((await diagnosticarFluxoFiscalSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,fluxoId:flowA.id
 })).eventosConferidos,1,"Rejected review must rollback head and event");
 const manualReview=await registrarEventoFiscalSimuladoSomenteSandbox(reviewRequest);
 assert.equal(manualReview.estado,"INDETERMINADA_CI");
 assert.equal(manualReview.transmissaoHabilitada,false);
 assert.equal((await registrarEventoFiscalSimuladoSomenteSandbox(reviewRequest)).reutilizada,true);
 await assert.rejects(()=>registrarEventoFiscalSimuladoSomenteSandbox({
  ...reviewRequest,descricaoVerificacao:"Alteracao indevida do texto de revisao"
 }),/M4D_EVENTO_REPLAY_CONFLITANTE/);
 const postReview=await diagnosticarFluxoFiscalSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,fluxoId:flowA.id
 });
 assert.equal(postReview.confiavel,true);
 assert.equal(postReview.investigacaoManualNecessaria,false);
 assert.equal(postReview.eventosConferidos,2);
 const accepted=await registrarEventoFiscalSimuladoSomenteSandbox({
  ...evA,chaveEvento:"m4d-consulta-"+suffix,
  tipo:"SIMULAR_CONSULTA_ACEITA",
  motivo:"Consulta manual fictícia confirma estado simulado sem protocolo"
 });
 assert.equal(accepted.estado,"ACEITA_SIMULADA_CI");
 await assert.rejects(()=>registrarEventoFiscalSimuladoSomenteSandbox({
  ...evA,chaveEvento:"m4d-cancel-"+suffix,tipo:"SIMULAR_CANCELAMENTO",
  motivo:"Cancelamento fictício para verificação de autorização"
 }),/M4D_PERMISSAO_FISCAL_INSUFICIENTE/);
 await prisma.cargoPermissao.create({data:{
  cargoId:manager.id,permissaoId:cancelFiscal.id
 }});
 const canceled=await registrarEventoFiscalSimuladoSomenteSandbox({
  ...evA,chaveEvento:"m4d-cancel-"+suffix,tipo:"SIMULAR_CANCELAMENTO",
  motivo:"Cancelamento fictício para verificação de autorização"
 });
 assert.equal(canceled.estado,"CANCELADA_SIMULADA_CI");
 assert.equal(canceled.autorizacaoOficial,false);
 await assert.rejects(()=>registrarEventoFiscalSimuladoSomenteSandbox({
  ...evA,chaveEvento:"m4d-cancel-again-"+suffix,tipo:"SIMULAR_CANCELAMENTO"
 }),/M4D_TRANSICAO_NAO_PERMITIDA|M4D_MOTIVO_AUDITAVEL_OBRIGATORIO/);
 // Company B in the SAME comanda must remain isolated in manual contingency.
 const contingency=await registrarEventoFiscalSimuladoSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co2,usuarioId:ids.user,
  fluxoId:flowB.id,chaveEvento:"m4d-contingency-"+suffix,
  tipo:"SUSPENDER_POR_CONTINGENCIA",
  motivo:"Somente CI: manter consulta e revisão manual de contingência"
 });
 assert.equal(contingency.estado,"CONTINGENCIA_REVISAO_CI");
 assert.equal(contingency.exigeConsultaManual,true);
 assert.equal(contingency.transmissaoHabilitada,false);
 assert.equal(await prisma.fluxoFiscalUnificadoCi.count(),2);
 assert.equal(await prisma.eventoFluxoFiscalUnificadoCi.count(),5);
 const verifiedA=await diagnosticarFluxoFiscalSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,fluxoId:flowA.id
 });
 const verifiedB=await diagnosticarFluxoFiscalSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co2,usuarioId:ids.user,fluxoId:flowB.id
 });
 assert.equal(verifiedA.confiavel,true);
 assert.equal(verifiedB.confiavel,true);
 assert.equal(verifiedA.estadoConferido,"CANCELADA_SIMULADA_CI");
 assert.equal(verifiedB.estadoConferido,"CONTINGENCIA_REVISAO_CI");
 assert.equal(verifiedB.investigacaoManualNecessaria,true);
 assert.equal(verifiedA.eventosConferidos,4);
 assert.equal(verifiedB.eventosConferidos,1);
 // Simulated fiscal history cannot be silently edited or skipped.
 const firstFiscalEvent=await prisma.eventoFluxoFiscalUnificadoCi.findFirst({
  where:{fluxoId:flowA.id},orderBy:{sequencia:"asc"}
 });
 await prisma.eventoFluxoFiscalUnificadoCi.update({where:{
  id:firstFiscalEvent.id
 },data:{evidencia:{...firstFiscalEvent.evidencia,
  motivo:"Motivo injetado por agente nao autorizado"
 }}});
 const detected=await diagnosticarFluxoFiscalSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,fluxoId:flowA.id
 });
 assert.equal(detected.confiavel,false);
 assert(detected.pendencias.some(x=>x.startsWith("M4D2_EVENTO_INTEGRO_OBRIGATORIO")));
 await assert.rejects(()=>registrarEventoFiscalSimuladoSomenteSandbox({
  ...evA,chaveEvento:"m4d-cancel-"+suffix,tipo:"SIMULAR_CANCELAMENTO",
  motivo:"Cancelamento fictício para verificação de autorização"
 }),/M4D2_HISTORICO_INTEGRO_OBRIGATORIO/);
 await prisma.eventoFluxoFiscalUnificadoCi.update({where:{
  id:firstFiscalEvent.id
 },data:{evidencia:firstFiscalEvent.evidencia}});
 assert.equal((await diagnosticarFluxoFiscalSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,fluxoId:flowA.id
 })).confiavel,true);
 const originalHead=await prisma.fluxoFiscalUnificadoCi.findUnique({where:{id:flowB.id}});
 await prisma.fluxoFiscalUnificadoCi.update({where:{id:flowB.id},
  data:{integridadeCabeca:"f".repeat(64)}});
 assert.equal((await diagnosticarFluxoFiscalSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co2,usuarioId:ids.user,fluxoId:flowB.id
 })).confiavel,false,"Corrupted head may never be trusted");
 await prisma.fluxoFiscalUnificadoCi.update({where:{id:flowB.id},
  data:{integridadeCabeca:originalHead.integridadeCabeca}});
 await assert.rejects(()=>diagnosticarFluxoFiscalSomenteSandbox({
  organizacaoId:ids.other,empresaId:ids.co1,usuarioId:ids.user,fluxoId:flowA.id
 }),/M4D_ACESSO_ORGANIZACAO_EMISSOR_INVALIDO/);
 assert.equal(await prisma.documentoFiscal.count(),fiscalCountBefore,
  "Simulated acceptance/cancellation may not write legacy DocumentoFiscal");
 assert.deepEqual({
  vendas:await prisma.venda.count(),pagamentos:await prisma.pagamento.count(),
  estoque:await prisma.movimentacaoEstoque.count(),
  caixa:await prisma.movimentacaoCaixa.count()
 },beforeFiscalRead,"Fiscal CI protocol may not mutate sales, payments, stock or cash");

 const existingFiscal=await prisma.documentoFiscal.create({data:{
  empresaId:ids.co1,vendaId:childA.vendaId,
  tipo:"NFE",ambiente:"HOMOLOGACAO",status:"PENDENTE",simulado:true
 }});
 await assert.rejects(()=>prepararVendaFilhaFiscalSomenteSandbox(fiscalInputA),
  /M4C2_DOCUMENTO_JA_EXISTENTE/);
 await prisma.documentoFiscal.delete({where:{id:existingFiscal.id}});
 assert.equal(await prisma.documentoFiscal.count(),fiscalCountBefore);
 assert.deepEqual({
  vendas:await prisma.venda.count(),pagamentos:await prisma.pagamento.count(),
  estoque:await prisma.movimentacaoEstoque.count(),caixa:await prisma.movimentacaoCaixa.count()
 },beforeFiscalRead,"Fiscal M.4C.2 preflight may not mutate sales, stock or cash");

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
 // M.5.5: real manual card installment settlement ON ISOLATED DB ONLY.
 const bank=await prisma.contaFinanceira.create({data:{
  empresaId:ids.co1,nome:"M55 CI bank "+suffix,tipo:"BANCO"
 }});
 const otherBank=await prisma.contaFinanceira.create({data:{
  empresaId:ids.co2,nome:"M55 CI other company bank "+suffix,tipo:"BANCO"
 }});
 const settlement={organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,
  parcelaId:p0.id,dados:{valor:"60.00",contaFinanceiraId:bank.id,
   referenciaExterna:"CI-REPASS-"+suffix,confirmouRepasseExterno:true}};
 await assert.rejects(()=>conciliarParcelaCartaoSomenteSandbox({
  ...settlement,organizacaoId:ids.other
 }),/M55_PARCELA_NAO_ENCONTRADA/);
 await assert.rejects(()=>conciliarParcelaCartaoSomenteSandbox({
  ...settlement,empresaId:ids.co2,dados:{...settlement.dados,contaFinanceiraId:otherBank.id}
 }),/M55_PARCELA_NAO_ENCONTRADA/);
 await assert.rejects(()=>conciliarParcelaCartaoSomenteSandbox({
  ...settlement,dados:{...settlement.dados,valor:"59.00"}
 }),/M55_VALOR_DIVERGENTE/);
 await assert.rejects(()=>conciliarParcelaCartaoSomenteSandbox({
  ...settlement,dados:{...settlement.dados,contaFinanceiraId:otherBank.id}
 }),/M55_CONTA_EMPRESA_INVALIDA/);
 await assert.rejects(()=>conciliarParcelaCartaoSomenteSandbox({
  ...settlement,dados:{...settlement.dados,confirmouRepasseExterno:false}
 }),/M55_CONFIRMACAO_EXTERNA_OBRIGATORIA/);
 const bankCountBefore={
  pagamentos:await prisma.pagamento.count(),caixa:await prisma.movimentacaoCaixa.count(),
  estoque:await prisma.movimentacaoEstoque.count(),fiscal:await prisma.documentoFiscal.count()
 };
 // M.5.6: scoped read-only card receivables report before any settlement.
 const reportCtx={organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,
  comandaId:closingDraft.id};
 // M.5.8: prove live READ-ONLY M.5.7 listing and detail against a real
 // finalized multi-CNPJ sale, not just an empty HTTP fixture.
 const readCtx={organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user};
 const cardCommands=await listarComandasRecebiveisCartaoLeituraM57(readCtx);
 assert(cardCommands.some(x=>x.id===closingDraft.id&&x.status==="FECHADA"));
 const rawCardDetail=await consultarRecebiveisCartaoLeituraM57(reportCtx);
 assert.equal(rawCardDetail.totais.original,"180.00");
 assert.equal(rawCardDetail.totais.pendente,"180.00");
 await assert.rejects(()=>listarComandasRecebiveisCartaoLeituraM57({
  ...readCtx,empresaId:ids.co2
 }),/M57_SEM_ACESSO_FINANCEIRO/);
 await assert.rejects(()=>consultarRecebiveisCartaoLeituraM57({
  ...reportCtx,organizacaoId:ids.other
 }),/M57_SEM_ACESSO_FINANCEIRO/);
 await assert.rejects(()=>consultarRecebiveisCartaoLeituraM57({
  ...reportCtx,comandaId:"m58-nonexistent"
 }),/M57_COMANDA_NAO_ENCONTRADA/);
 await prisma.configuracaoOrganizacao.update({where:{organizacaoId:ids.org},
  data:{pdvUnificadoHabilitado:false}});
 await assert.rejects(()=>listarComandasRecebiveisCartaoLeituraM57(readCtx),
  /M57_PREFERENCIA_DESATIVADA/);
 await prisma.configuracaoOrganizacao.update({where:{organizacaoId:ids.org},
  data:{pdvUnificadoHabilitado:true}});

 const beforeReport=await consultarResumoRecebiveisCartaoSomenteSandbox(reportCtx);
 assert.deepEqual(beforeReport.totais,{original:"180.00",pendente:"180.00",
  conciliadoDeclarado:"0.00",estornado:"0.00"});
 assert.equal(beforeReport.linhas[0].situacao,"AGUARDANDO_REPASSE");
 assert.equal(beforeReport.provaBancariaIndependente,false);
 await assert.rejects(()=>consultarResumoRecebiveisCartaoSomenteSandbox({
  ...reportCtx,empresaId:ids.co2
 }),/M56_SEM_ACESSO_FINANCEIRO/,
  "Operador sem financeiro.gerenciar na empresa B nao pode ver recebiveis");
 // Give permission ONLY temporarily to test that authorized company B gets
 // an empty report; revoke immediately before further financial test steps.
 await prisma.cargoPermissao.create({data:{
  cargoId:cargo.id,permissaoId:financePermission.id
 }});
 const debitOnly=await consultarResumoRecebiveisCartaoSomenteSandbox({
  ...reportCtx,empresaId:ids.co2
 });
 assert.equal(debitOnly.totais.original,"0.00",
  "A conta da outra empresa nao recebe as parcelas deste pagamento");
 await prisma.cargoPermissao.delete({where:{cargoId_permissaoId:{
  cargoId:cargo.id,permissaoId:financePermission.id
 }}});
 await assert.rejects(()=>consultarResumoRecebiveisCartaoSomenteSandbox({
  ...reportCtx,organizacaoId:ids.other
 }),/M56_SEM_ACESSO_FINANCEIRO/);
 await assert.rejects(()=>consultarResumoRecebiveisCartaoSomenteSandbox({
  ...reportCtx,comandaId:"m56-cross-tenant-nonexistent"
 }),/M56_COMANDA_NAO_ENCONTRADA/);

 // M.5.8 cross-check the legacy financial ledger without accidentally counting
 // card REPASSE DECLARADO as approved payment, financial title or bank cash.
 const financialScope={organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,
  escopo:"empresa",dataInicio:"2020-01-01",dataFim:"2099-12-31"};
 const [legacyBefore,flowBefore,pendingBefore,bankBefore]=await Promise.all([
  resumoFinanceiro(financialScope),fluxoFinanceiro(financialScope),
  pendentesConciliacao({empresaId:ids.co1}),listarContas(ids.co1)
 ]);
 const cardPay=lines.find(l=>l.forma==="CARTAO_CREDITO").pagamentoId;
 assert.equal(legacyBefore.faturamento,180,
  "Faturamento reconhece venda FINALIZADA, separadamente de caixa recebido");
 assert.equal(legacyBefore.receitasRealizadas,0,
  "Pagamento PENDENTE de cartão nao e dinheiro em caixa ou banco");
 assert(!flowBefore.some(x=>x.origemId===cardPay),
  "Card PENDENTE cannot enter realized financial flow");
 assert(!pendingBefore.some(x=>x.origemId===cardPay),
  "Card PENDENTE cannot be reconciled as an approved cash entry");
 assert.equal(await prisma.conciliacaoFinanceira.count({where:{empresaId:ids.co1}}),0);
 const settled=await conciliarParcelaCartaoSomenteSandbox(settlement);
 assert.equal(settled.status,"CONCILIADA");
 assert.equal(settled.confirmacaoAutomaticaBanco,false);
 assert.equal(settled.gerouCaixa,false);
 assert.equal(settled.gerouPagamento,false);
 const partialReport=await consultarResumoRecebiveisCartaoSomenteSandbox(reportCtx);
 assert.equal(partialReport.totais.original,"180.00");
 assert.equal(partialReport.totais.conciliadoDeclarado,"60.00");
 assert.equal(partialReport.totais.pendente,"120.00");
 assert.equal(partialReport.linhas[0].situacao,"REPASSE_PARCIAL_DECLARADO");
 assert.equal(partialReport.statusPagamentoAlterado,false);
 const livePartial=await consultarRecebiveisCartaoLeituraM57(reportCtx);
 assert.equal(livePartial.totais.pendente,"120.00");
 assert.equal(livePartial.totais.conciliadoDeclarado,"60.00");
 // M.5.9: preview of a REAL already-declared external card installment.
 // Operator's bank confirmation still is NOT independently verified by PointVet.
 const projected=planejarBaixaCartaoM59({resumo:livePartial,pedido:{
  tipo:"REPASSE_NORMAL",contaFinanceiraId:bank.id,
  referenciaExtrato:"CI-EXTRATO-"+suffix,dataCredito:"2026-10-15",
  parcelaIds:[p0.id],tarifaCartao:"1.20",
  descontoAntecipacao:"0.00",valorLiquidoDeclarado:"58.80",
  confirmouConferenciaExterna:true
 }});
 assert.deepEqual(projected.valores,{
  bruto:"60.00",tarifaCartao:"1.20",
  descontoAntecipacao:"0.00",liquidoDeclarado:"58.80"
 });
 assert.equal(projected.verificacaoBancariaIndependente,false);
 assert.equal(projected.baixaRealExecutada,false);
 assert.equal(projected.gerarCaixa,false);
 assert.equal(projected.registrarConciliacaoFinanceira,false);
 assert.throws(()=>planejarBaixaCartaoM59({resumo:livePartial,pedido:{
  tipo:"REPASSE_NORMAL",contaFinanceiraId:bank.id,
  referenciaExtrato:"CI-EXTRATO-"+suffix,dataCredito:"2026-10-15",
  parcelaIds:[receipts[1].id],tarifaCartao:"0.00",
  descontoAntecipacao:"0.00",valorLiquidoDeclarado:"60.00",
  confirmouConferenciaExterna:true
 }}),/M59_PARCELA_SEM_DECLARACAO/,
 "An unreconciled card installment can never be projected as bank deposit");
 const advance=planejarBaixaCartaoM59({resumo:livePartial,pedido:{
  tipo:"ANTECIPACAO",contaFinanceiraId:bank.id,
  referenciaExtrato:"CI-ANTECIP-"+suffix,dataCredito:"2026-10-15",
  parcelaIds:[p0.id],tarifaCartao:"1.20",
  descontoAntecipacao:"2.50",valorLiquidoDeclarado:"56.30",
  confirmouConferenciaExterna:true
 }});
 assert.equal(advance.valores.liquidoDeclarado,"56.30");
 assert.equal(advance.baixaRealExecutada,false);

 // M.5.10: register an auditable pre-settlement only, NOT bank cash.
 const prePedido={tipo:"REPASSE_NORMAL",contaFinanceiraId:bank.id,
  referenciaExtrato:"CI-M510-EXTRATO-"+suffix,dataCredito:"2026-10-15",
  parcelaIds:[p0.id],tarifaCartao:"1.20",descontoAntecipacao:"0.00",
  valorLiquidoDeclarado:"58.80",confirmouConferenciaExterna:true};
 const preCtx={organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,
  comandaId:closingDraft.id,pedido:prePedido};
 await assert.rejects(()=>registrarPreBaixaCartaoSomenteSandbox({
  ...preCtx,simularFalhaAposRegistro:true
 }),/M510_FALHA_INJETADA_ROLLBACK/);
 assert.equal(await prisma.preparacaoBaixaCartaoManualUnificada.count(),0);
 await assert.rejects(()=>registrarPreBaixaCartaoSomenteSandbox({
  ...preCtx,pedido:{...prePedido,contaFinanceiraId:otherBank.id}
 }),/M510_CONTA_FORA_DA_EMPRESA/);
 const attempts=await Promise.allSettled([
  registrarPreBaixaCartaoSomenteSandbox(preCtx),
  registrarPreBaixaCartaoSomenteSandbox(preCtx)
 ]);
 assert(attempts.some(x=>x.status==="fulfilled"));
 const preRecord=await registrarPreBaixaCartaoSomenteSandbox(preCtx);
 assert.equal(preRecord.reutilizada,true);
 assert.equal(preRecord.valorLiquidoDeclarado,"58.80");
 assert.equal(preRecord.creditouBanco,false);
 const stepsCtx={organizacaoId:ids.org,empresaId:ids.co1,
  usuarioId:ids.user,comandaId:closingDraft.id};
 const firstSteps=await consultarEtapasRepassesM516(stepsCtx);
 assert.equal(firstSteps.preparacoes.length,1);
 assert.equal(firstSteps.preparacoes[0].etapa,"AGUARDANDO_SEGUNDA_CONFERENCIA");
 assert.equal(firstSteps.checkoutDisponivel,false);
 const pendingCharges=discriminarTarifasAntecipacoesM520({
  empresaId:ids.co1,comandaId:closingDraft.id,fluxo:firstSteps
 });
 assert.equal(pendingCharges.preparacoes.bruto,"60.00");
 assert.equal(pendingCharges.preparacoes.tarifasInformadas,"1.20");
 assert.equal(pendingCharges.repassesAtivos.liquidoNoSaldoInterno,"0.00");
 assert.equal(pendingCharges.autorizaCheckout,false);
 const pendingRefund=planejarDevolucaoAposRepasseM521({
  organizacaoId:ids.org,empresaId:ids.co1,comandaId:closingDraft.id,
  fluxo:firstSteps
 });
 assert.equal(pendingRefund.preparacoes[0].podeSimularDevolucao,false);
 assert.throws(()=>simularDevolucaoAposRepasseM521({
  plano:pendingRefund,preparacaoId:preRecord.preparacaoId,
  codigoRevisaoVisto:firstSteps.preparacoes[0].revisaoFinanceira.codigoRevisao,
  valorBrutoDevolucaoProposto:"60.00",confirmouValoresSaoHipoteses:true
 }),/M521_REPASSE_NAO_ELEGIVEL/);


 await assert.rejects(()=>consultarEtapasRepassesM516({
  ...stepsCtx,organizacaoId:ids.other
 }),/M57_SEM_ACESSO_FINANCEIRO/);

 assert.equal(await prisma.preparacaoBaixaCartaoManualUnificada.count(),1);
 assert.equal(await prisma.parcelaPreBaixaCartaoManualUnificada.count(),1);
 assert.equal(await prisma.auditoria.count({where:{
  entidadeId:preRecord.preparacaoId,acao:"PRE_BAIXA_CARTAO_PREPARADA_CI"
 }}),1);
 await assert.rejects(()=>registrarPreBaixaCartaoSomenteSandbox({
  ...preCtx,pedido:{...prePedido,referenciaExtrato:"CI-M510-DUP-"+suffix}
 }),/M510_PARCELA_JA_PREPARADA/);
 await assert.rejects(()=>registrarPreBaixaCartaoSomenteSandbox({
  ...preCtx,pedido:{...prePedido,tarifaCartao:"1.00",
   valorLiquidoDeclarado:"59.00"}
 }),/M510_REFERENCIA_DIVERGENTE/);
 // M.5.11: independent human reviewer for documentary evidence only.
 const reviewerId="review"+suffix;
 await prisma.usuario.create({data:{id:reviewerId,nome:"Independent CI reviewer",
  email:"review-"+suffix+"@ci.invalid",senhaHash:"never-login"}});
 await prisma.usuarioOrganizacao.create({data:{
  usuarioId:reviewerId,organizacaoId:ids.org,papel:"MEMBRO"
 }});
 const reviewEvidence={evidenciaReferencia:"CI-DOC-EXTRATO-"+suffix,
  evidenciaSha256:"c".repeat(64),confirmouConferenciaDocumental:true};
 const reviewCtx={organizacaoId:ids.org,empresaId:ids.co1,
  conferenteId:reviewerId,preparacaoId:preRecord.preparacaoId,
  evidencia:reviewEvidence};
 await assert.rejects(()=>registrarParecerPreBaixaSomenteSandbox({
  ...reviewCtx,conferenteId:ids.user
 }),/M511_SEGREGACAO_DE_FUNCOES/);
 await assert.rejects(()=>registrarParecerPreBaixaSomenteSandbox(reviewCtx),
  /M511_CONFERENTE_SEM_PERMISSAO/);
 await prisma.usuarioEmpresa.create({data:{
  usuarioId:reviewerId,empresaId:ids.co1,cargoId:manager.id
 }});
 await assert.rejects(()=>registrarParecerPreBaixaSomenteSandbox({
  ...reviewCtx,empresaId:ids.co2
 }),/M511_PREPARACAO_NAO_ENCONTRADA/);
 await assert.rejects(()=>registrarParecerPreBaixaSomenteSandbox({
  ...reviewCtx,evidencia:{...reviewEvidence,confirmouConferenciaDocumental:false}
 }),/M511_DECLARACAO_EXPLICITA_OBRIGATORIA/);
 await assert.rejects(()=>registrarParecerPreBaixaSomenteSandbox({
  ...reviewCtx,simularFalhaAposGravacao:true
 }),/M511_ROLLBACK_SIMULADO/);
 assert.equal(await prisma.parecerPreBaixaCartaoManualUnificada.count(),0);
 const reviewed=await Promise.allSettled([
  registrarParecerPreBaixaSomenteSandbox(reviewCtx),
  registrarParecerPreBaixaSomenteSandbox(reviewCtx)
 ]);
 assert(reviewed.some(x=>x.status==="fulfilled"),
  "At least one documentary review must commit atomically");
 const documentaryReview=await registrarParecerPreBaixaSomenteSandbox(reviewCtx);
 assert.equal(documentaryReview.reutilizada,true);
 assert.equal(documentaryReview.comprovacaoBancariaIndependente,false);
 assert.equal(documentaryReview.baixouFinanceiro,false);
 assert.equal(documentaryReview.creditouBanco,false);
 const reviewedSteps=await consultarEtapasRepassesM516(stepsCtx);
 assert.equal(reviewedSteps.preparacoes[0].etapa,
  "SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA");
 assert.equal(reviewedSteps.preparacoes[0].valorLiquido,"58.80");
 const reviewVersion=reviewedSteps.preparacoes[0].revisaoFinanceira;
 assert.equal(reviewVersion.fingerprintPreparacaoEsperado,preRecord.fingerprint);
 assert.equal(reviewVersion.fingerprintParecerEsperado,documentaryReview.fingerprint);
 assert.equal(reviewVersion.contaFinanceiraIdEsperada,bank.id);
 assert.equal(reviewVersion.valorLiquidoEsperado,"58.80");
 assert.equal(reviewVersion.habilitaConfirmacaoReal,false);
 assert.equal(reviewVersion.codigoRevisao.length,64);

 const trainingPlan=planejarIntencoesManuaisM517({
  organizacaoId:ids.org,empresaId:ids.co1,comandaId:closingDraft.id,
  fluxo:reviewedSteps
 });
 assert.equal(trainingPlan.planos[0].operacaoSimulavel,"SIMULAR_CONFIRMACAO");
 assert.equal(trainingPlan.planos[0].revisaoFinanceira.codigoRevisao,reviewVersion.codigoRevisao);
 const dryConfirmation=simularIntencaoManualM517({
  planejamento:trainingPlan,preparacaoId:preRecord.preparacaoId,
  operacao:"SIMULAR_CONFIRMACAO",
  referencia:prePedido.referenciaExtrato,valorLiquidoInformado:"58.80",
  confirmouConsultaExterna:true
 });
 assert.equal(dryConfirmation.modificouConciliacaoFinanceira,false);
 assert.equal(dryConfirmation.permitePublicarCheckout,false);
 assert.equal(await prisma.conciliacaoFinanceira.count({where:{empresaId:ids.co1}}),0,
  "Local manual dry-run cannot post any finance entry");


 assert.equal(await prisma.parecerPreBaixaCartaoManualUnificada.count({
  where:{preparacaoId:preRecord.preparacaoId}
 }),1);
 assert.equal(await prisma.auditoria.count({where:{
  acao:"PRE_BAIXA_CARTAO_CONFERENCIA_DOCUMENTAL_CI",
  entidadeId:documentaryReview.parecerId
 }}),1);
 await assert.rejects(()=>registrarParecerPreBaixaSomenteSandbox({
  ...reviewCtx,evidencia:{...reviewEvidence,evidenciaSha256:"d".repeat(64)}
 }),/M511_PARECER_IMUTAVEL_DIVERGENTE/);
 // M.5.12: re-read every document, parcel, authorization and audit.
 // Consistent INTERNAL documentary trail must still NOT allow bank posting.
 const diagnosisCtx={organizacaoId:ids.org,empresaId:ids.co1,
  usuarioId:ids.user,preparacaoId:preRecord.preparacaoId};
 const goodDiagnosis=await diagnosticarPreBaixaSomenteSandbox(diagnosisCtx);
 assert.equal(goodDiagnosis.integridadeInternaAprovada,true,
  JSON.stringify(goodDiagnosis.pendencias));
 assert.equal(goodDiagnosis.podeExecutarBaixa,false);
 assert.equal(goodDiagnosis.podeCreditarBanco,false);
 assert.equal(goodDiagnosis.podePublicarPdv,false);
 await assert.rejects(()=>diagnosticarPreBaixaSomenteSandbox({
  ...diagnosisCtx,empresaId:ids.co2
 }),/M512_SEM_PERMISSAO_FINANCEIRA/);
 await assert.rejects(()=>diagnosticarPreBaixaSomenteSandbox({
  ...diagnosisCtx,organizacaoId:ids.other
 }),/M512_SEM_PERMISSAO_FINANCEIRA/);
 const oldEvidence="c".repeat(64);
 await prisma.parecerPreBaixaCartaoManualUnificada.update({
  where:{id:documentaryReview.parecerId},data:{evidenciaSha256:"d".repeat(64)}
 });
 const tampered=await diagnosticarPreBaixaSomenteSandbox(diagnosisCtx);
 assert.equal(tampered.integridadeInternaAprovada,false);
 assert(tampered.pendencias.includes("PARECER_OU_SNAPSHOT_DIVERGENTE"));
 assert.equal(tampered.podeExecutarBaixa,false);
 await prisma.parecerPreBaixaCartaoManualUnificada.update({
  where:{id:documentaryReview.parecerId},data:{evidenciaSha256:oldEvidence}
 });
 const restored=await diagnosticarPreBaixaSomenteSandbox(diagnosisCtx);
 assert.equal(restored.integridadeInternaAprovada,true,
  "Restoring the synthetic CI evidence should restore dossier consistency");
 const [legacyAfter,flowAfter,pendingAfter,bankAfter]=await Promise.all([
  resumoFinanceiro(financialScope),fluxoFinanceiro(financialScope),
  pendentesConciliacao({empresaId:ids.co1}),listarContas(ids.co1)
 ]);
 for(const field of ["faturamento","receitasRealizadas","saldoPeriodo",
  "receberAberto","receberVencido"]){
  assert.equal(legacyAfter[field],legacyBefore[field],
   "Manual declared repasse cannot inflate legacy field "+field);
 }
 assert.deepEqual(legacyAfter.formasPagamento,legacyBefore.formasPagamento);
 assert.deepEqual(flowAfter,flowBefore);
 assert.deepEqual(pendingAfter,pendingBefore);
 assert.deepEqual(bankAfter.map(x=>[x.id,x.saldoConciliado]),
  bankBefore.map(x=>[x.id,x.saldoConciliado]));
 assert.equal(await prisma.conciliacaoFinanceira.count({where:{empresaId:ids.co1}}),0,
  "Operator declaration is NOT independent financial reconciliation");
 
 // M.5.13 — operator MANUALLY confirms net amount after checking bank
 // statement outside PointVet. No bank API, payment approval or duplicate sale.
 const manualData={confirmouCreditoNoExtrato:true,
  referenciaExtrato:prePedido.referenciaExtrato,
  fingerprintPreparacaoEsperado:reviewVersion.fingerprintPreparacaoEsperado,
  fingerprintParecerEsperado:reviewVersion.fingerprintParecerEsperado,
  contaFinanceiraIdEsperada:reviewVersion.contaFinanceiraIdEsperada,
  valorLiquidoEsperado:reviewVersion.valorLiquidoEsperado};
 const manualCtx={organizacaoId:ids.org,empresaId:ids.co1,
  usuarioId:ids.user,preparacaoId:preRecord.preparacaoId,dados:manualData};
 await assert.rejects(()=>registrarRepasseCartaoManualSomenteSandbox({
  ...manualCtx,dados:{...manualData,confirmouCreditoNoExtrato:false}
 }),/M513_CONFIRMACAO_MANUAL_EXPLICITA_OBRIGATORIA/);
 await assert.rejects(()=>registrarRepasseCartaoManualSomenteSandbox({
  ...manualCtx,empresaId:ids.co2
 }),/M513_PREPARACAO_NAO_ENCONTRADA/);
 await assert.rejects(()=>registrarRepasseCartaoManualSomenteSandbox({
  ...manualCtx,dados:{...manualData,referenciaExtrato:"CI-WRONG-REFERENCE"}
 }),/M513_REFERENCIA_DIVERGENTE/);
 // M.5.18 stale-client financial preconditions must fail BEFORE DB write.
 await assert.rejects(()=>registrarRepasseCartaoManualSomenteSandbox({
  ...manualCtx,dados:{...manualData,valorLiquidoEsperado:"59.00"}
 }),/M518_VALOR_LIQUIDO_DESATUALIZADO/);
 await assert.rejects(()=>registrarRepasseCartaoManualSomenteSandbox({
  ...manualCtx,dados:{...manualData,fingerprintParecerEsperado:"f".repeat(64)}
 }),/M518_PARECER_OU_DECLARACAO_DESATUALIZADO/);
 await assert.rejects(()=>registrarRepasseCartaoManualSomenteSandbox({
  ...manualCtx,dados:{...manualData,contaFinanceiraIdEsperada:otherBank.id}
 }),/M518_REVISAO_FINANCEIRA_DESATUALIZADA/);
 await assert.rejects(()=>registrarRepasseCartaoManualSomenteSandbox({
  ...manualCtx,simularFalhaAposLancamento:true
 }),/M513_ROLLBACK_INJETADO/);
 assert.equal(await prisma.conciliacaoFinanceira.count({where:{empresaId:ids.co1}}),0);
 const simultaneous=await Promise.allSettled([
  registrarRepasseCartaoManualSomenteSandbox(manualCtx),
  registrarRepasseCartaoManualSomenteSandbox(manualCtx)
 ]);
 assert(simultaneous.some(x=>x.status==="fulfilled"),
  "At least one CI manual repasse operation must commit atomically");
 const manualEntry=await registrarRepasseCartaoManualSomenteSandbox(manualCtx);
 assert.equal(manualEntry.reutilizada,true);
 assert.equal(manualEntry.valorLiquido,"58.80");
 assert.equal(manualEntry.confirmacaoAutomaticaDoBanco,false);
 assert.equal(manualEntry.pagamentoAprovado,false);
 assert.equal(manualEntry.atualizouSaldoConciliadoInterno,true);
 const postedSteps=await consultarEtapasRepassesM516(stepsCtx);
 assert.equal(postedSteps.preparacoes[0].etapa,
  "REPASSE_INTERNO_CONFIRMADO_MANUALMENTE");
 assert.equal(postedSteps.preparacoes[0].confirmacaoManualInterna,true);
 assert.equal(postedSteps.integracaoBancaria,false);
 const chargesAfterPost=discriminarTarifasAntecipacoesM520({
  empresaId:ids.co1,comandaId:closingDraft.id,fluxo:postedSteps
 });
 assert.equal(chargesAfterPost.repassesAtivos.brutoCorrespondente,"60.00");
 assert.equal(chargesAfterPost.repassesAtivos.tarifasInformadas,"1.20");
 assert.equal(chargesAfterPost.repassesAtivos.liquidoNoSaldoInterno,"58.80");
 assert.equal(chargesAfterPost.geraLancamentoContabil,false);
 const activeRefund=planejarDevolucaoAposRepasseM521({
  organizacaoId:ids.org,empresaId:ids.co1,comandaId:closingDraft.id,
  fluxo:postedSteps
 });
 const activeRefundItem=activeRefund.preparacoes[0];
 assert.equal(activeRefundItem.podeSimularDevolucao,true);
 const refundProjection=simularDevolucaoAposRepasseM521({
  plano:activeRefund,preparacaoId:preRecord.preparacaoId,
  codigoRevisaoVisto:activeRefundItem.codigoRevisao,
  valorBrutoDevolucaoProposto:"60.00",
  recuperacaoTarifaHipotetica:"1.20",
  recuperacaoAntecipacaoHipotetica:"0.00",
  confirmouValoresSaoHipoteses:true
 });
 assert.equal(refundProjection.exposicaoHipoteticaSeRecuperacoesOcorrerem,"58.80");
 assert.equal(refundProjection.executouReembolso,false);
 assert.equal(refundProjection.alterouSaldoInterno,false);
 assert.equal(await prisma.conciliacaoFinanceira.count({where:{
  empresaId:ids.co1,origem:"ESTORNO_REPASSE_CARTAO_MANUAL_UNIFICADO"
 }}),0);


 // M.5.22 CI ONLY: human REFUND ATTESTATIONS, NEVER money movement.
 const customerRefundData={
  confirmouDevolucaoExterna:true,
  referenciaExterna:"CI-M522-REFUND-1-"+suffix,
  motivo:"Cliente recebeu devolução externa declarada no CI, não verificada",
  valorBrutoDevolvido:"20.00",saldoRestanteBrutoEsperado:"60.00",
  codigoRevisaoEsperado:postedSteps.preparacoes[0].revisaoFinanceira.codigoRevisao,
  conciliacaoOrigemIdEsperada:manualEntry.conciliacaoId
 };
 const customerRefundCtx={organizacaoId:ids.org,empresaId:ids.co1,
  usuarioId:reviewerId,preparacaoId:preRecord.preparacaoId,
  dados:customerRefundData};
 await assert.rejects(()=>registrarDevolucaoExternaDeclaradaSomenteSandbox({
  ...customerRefundCtx,empresaId:ids.co2
 }),/M522_PREPARACAO_NAO_ENCONTRADA/);
 await assert.rejects(()=>registrarDevolucaoExternaDeclaradaSomenteSandbox({
  ...customerRefundCtx,usuarioId:ids.user
 }),/M522_CONTEXTOS_OU_SEGREGACAO_INVALIDOS/);
 await assert.rejects(()=>registrarDevolucaoExternaDeclaradaSomenteSandbox({
  ...customerRefundCtx,dados:{...customerRefundData,
   codigoRevisaoEsperado:"f".repeat(64)}
 }),/M522_REVISAO_FINANCEIRA_DESATUALIZADA/);
 await assert.rejects(()=>registrarDevolucaoExternaDeclaradaSomenteSandbox({
  ...customerRefundCtx,simularFalhaAposRegistro:true
 }),/M522_ROLLBACK_SIMULADO/);
 assert.equal(await prisma.devolucaoClienteManualUnificada.count({where:{
  preparacaoId:preRecord.preparacaoId
 }}),0);
 const customerRefundConcurrency=await Promise.allSettled([
  registrarDevolucaoExternaDeclaradaSomenteSandbox(customerRefundCtx),
  registrarDevolucaoExternaDeclaradaSomenteSandbox(customerRefundCtx)
 ]);
 assert(customerRefundConcurrency.some(x=>x.status==="fulfilled"),
  "at least one partial refund attestation must persist atomically");
 const firstRefund=await registrarDevolucaoExternaDeclaradaSomenteSandbox(customerRefundCtx);
 assert.equal(firstRefund.registroReutilizado,true);
 assert.equal(firstRefund.saldoBrutoRestante,"40.00");
 assert.equal(firstRefund.transferenciaPeloPointVet,false);
 assert.equal(firstRefund.alterouSaldoConciliado,false);
 assert.equal(firstRefund.emitiuEstornoFiscal,false);
 await assert.rejects(()=>registrarDevolucaoExternaDeclaradaSomenteSandbox({
  ...customerRefundCtx,dados:{...customerRefundData,
   valorBrutoDevolvido:"19.99"}
 }),/M522_REFERENCIA_JA_UTILIZADA_COM_DADOS_DIVERGENTES/);
 await assert.rejects(()=>registrarDevolucaoExternaDeclaradaSomenteSandbox({
  ...customerRefundCtx,dados:{...customerRefundData,
   referenciaExterna:"CI-M522-STALE-"+suffix,
   saldoRestanteBrutoEsperado:"60.00"}
 }),/M522_SALDO_VISUALIZADO_DESATUALIZADO/);
 const secondRefundData={...customerRefundData,
  referenciaExterna:"CI-M522-REFUND-2-"+suffix,
  saldoRestanteBrutoEsperado:"40.00",valorBrutoDevolvido:"40.00"};
 await assert.rejects(()=>registrarDevolucaoExternaDeclaradaSomenteSandbox({
  ...customerRefundCtx,dados:{...secondRefundData,
   valorBrutoDevolvido:"40.01"}
 }),/M522_DEVOLUCAO_SUPERA_RESTANTE/);
 const secondRefund=await registrarDevolucaoExternaDeclaradaSomenteSandbox({
  ...customerRefundCtx,dados:secondRefundData
 });
 assert.equal(secondRefund.saldoBrutoRestante,"0.00");
 assert.equal(await prisma.devolucaoClienteManualUnificada.count({where:{
  preparacaoId:preRecord.preparacaoId
 }}),2);
 assert.equal(await prisma.auditoria.count({where:{
  entidade:"DEVOLUCAO_CLIENTE_MANUAL",
  acao:"DEVOLUCAO_EXTERNA_DECLARADA_CI",
  entidadeId:{in:[firstRefund.id,secondRefund.id]}
 }}),2);
 const replayFirst=await registrarDevolucaoExternaDeclaradaSomenteSandbox(customerRefundCtx);
 assert.equal(replayFirst.registroReutilizado,true);
 assert.equal(replayFirst.saldoBrutoRestante,"0.00");
 assert.equal(await prisma.conciliacaoFinanceira.count({where:{
  empresaId:ids.co1,origem:"REPASSE_CARTAO_MANUAL_UNIFICADO"
 }}),1,"refund attestations do not write ConciliacaoFinanceira");
 await assert.rejects(()=>compensarRepasseCartaoManualSomenteSandbox({
  organizacaoId:ids.org,empresaId:ids.co1,usuarioId:reviewerId,
  conciliacaoId:manualEntry.conciliacaoId,
  dados:{confirmouCorrecaoExterna:true,
   referenciaCorrecao:"CI-M522-CORRECTION-"+suffix,
   motivo:"Revisão de correção após devolução declarada do cliente",
   fingerprintPreparacaoEsperado:preRecord.fingerprint,
   contaFinanceiraIdEsperada:bank.id,
   valorLiquidoEsperado:"58.80",
   lancamentoOriginalIdEsperado:manualEntry.conciliacaoId}
 }),/M514_EXISTE_DEVOLUCAO_CLIENTE_EXIGE_REVISAO/);
 // Disposable CI fixture reset ONLY: no production delete path exists.
 await prisma.auditoria.deleteMany({where:{
  entidade:"DEVOLUCAO_CLIENTE_MANUAL",
  entidadeId:{in:[firstRefund.id,secondRefund.id]}
 }});
 await prisma.devolucaoClienteManualUnificada.deleteMany({where:{
  preparacaoId:preRecord.preparacaoId
 }});
 assert.equal(await prisma.devolucaoClienteManualUnificada.count(),0);
 const postedVersion=postedSteps.preparacoes[0].revisaoFinanceira;
 assert.notEqual(postedVersion.codigoRevisao,reviewVersion.codigoRevisao);
 assert.equal(postedVersion.lancamentoOriginalIdEsperado,manualEntry.conciliacaoId);
 assert.equal(postedVersion.habilitaCorrecaoReal,false);

 const correctionTraining=planejarIntencoesManuaisM517({
  organizacaoId:ids.org,empresaId:ids.co1,comandaId:closingDraft.id,
  fluxo:postedSteps
 });
 assert.equal(correctionTraining.planos[0].operacaoSimulavel,"SIMULAR_CORRECAO");
 assert.equal(simularIntencaoManualM517({
  planejamento:correctionTraining,preparacaoId:preRecord.preparacaoId,
  operacao:"SIMULAR_CORRECAO",referencia:"CI-M517-CORRECAO-"+suffix,
  valorLiquidoInformado:"58.80",confirmouConsultaExterna:true,
  motivo:"Correção simulada por outro responsável financeiro"
 }).modificouConciliacaoFinanceira,false);


 assert.equal(await prisma.conciliacaoFinanceira.count({where:{
  empresaId:ids.co1,origem:"REPASSE_CARTAO_MANUAL_UNIFICADO",
  origemId:preRecord.preparacaoId
 }}),1);
 assert.equal(await prisma.auditoria.count({where:{
  entidade:"CONCILIACAO_FINANCEIRA",entidadeId:manualEntry.conciliacaoId,
  acao:"REPASSE_CARTAO_MANUAL_CONFIRMADO_CI"
 }}),1);
 const bankAfterManual=await listarContas(ids.co1);
 const originalBalance=Number(bankBefore.find(a=>a.id===bank.id).saldoConciliado);
 const newBalance=Number(bankAfterManual.find(a=>a.id===bank.id).saldoConciliado);
 assert.equal(Math.round((newBalance-originalBalance)*100),5880,
  "The internal reconciled account changes by NET 58.80, never gross 60");
 const legacyAfterManual=await resumoFinanceiro(financialScope);
 assert.equal(legacyAfterManual.faturamento,legacyBefore.faturamento,
  "Cannot post the sale a second time as turnover");
 assert.equal(legacyAfterManual.receitasRealizadas,legacyBefore.receitasRealizadas,
  "Internal bank reconciliation is NOT another realized-revenue event");
 assert.deepEqual(await fluxoFinanceiro(financialScope),flowBefore);
 await assert.rejects(()=>desconciliarFinanceiro({
  organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,
  id:manualEntry.conciliacaoId
 }),/REPASSE_CARTAO_MANUAL_EXIGE_REVISAO_FINANCEIRA/,
  "Old generic undo must not delete manual card cash entry");
 await assert.rejects(()=>conciliarFinanceiro({
  organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,
  dados:{contaFinanceiraId:bank.id,
   origem:"REPASSE_CARTAO_MANUAL_UNIFICADO",origemId:preRecord.preparacaoId}
 }),/MOVIMENTO_NAO_ENCONTRADO/,
  "Old generic route must not book the new manual ledger source");
 // M.5.14: second finance operator explicitly corrects the deposit
 // he/she reviewed outside PointVet; debit never means automatic bank refund.
 // M.5.15: before compensating, only one net internal incoming posting.
 const beforeCorrection=await consultarConferenciaManualM515({
  organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,
  comandaId:closingDraft.id
 });
 assert.deepEqual([
  beforeCorrection.resumo.entradaLiquidaDeclarada,
  beforeCorrection.resumo.correcoesLiquidas,
  beforeCorrection.resumo.efeitoLiquidoNoSaldoInterno
 ],["58.80","0.00","58.80"]);
 assert.equal(beforeCorrection.resumo.podeConfirmarPelaInterface,false);
 const correctionData={confirmouCorrecaoExterna:true,
  referenciaCorrecao:"CI-REVERSAL-"+suffix,
  motivo:"Correção documental de repasse verificado manualmente no CI",
  fingerprintPreparacaoEsperado:postedVersion.fingerprintPreparacaoEsperado,
  contaFinanceiraIdEsperada:postedVersion.contaFinanceiraIdEsperada,
  valorLiquidoEsperado:postedVersion.valorLiquidoEsperado,
  lancamentoOriginalIdEsperado:postedVersion.lancamentoOriginalIdEsperado};
 const correctionCtx={organizacaoId:ids.org,empresaId:ids.co1,
  usuarioId:reviewerId,conciliacaoId:manualEntry.conciliacaoId,
  dados:correctionData};
 await assert.rejects(()=>compensarRepasseCartaoManualSomenteSandbox({
  ...correctionCtx,usuarioId:ids.user
 }),/M514_EXIGE_SEGUNDO_OPERADOR/);
 await assert.rejects(()=>compensarRepasseCartaoManualSomenteSandbox({
  ...correctionCtx,dados:{...correctionData,confirmouCorrecaoExterna:false}
 }),/M514_JUSTIFICATIVA_OU_CONFIRMACAO_INVALIDA/);
 await assert.rejects(()=>compensarRepasseCartaoManualSomenteSandbox({
  ...correctionCtx,empresaId:ids.co2
 }),/M514_LANCAMENTO_NAO_ENCONTRADO/);
 await assert.rejects(()=>compensarRepasseCartaoManualSomenteSandbox({
  ...correctionCtx,dados:{...correctionData,lancamentoOriginalIdEsperado:"other-ledger"}
 }),/M518_LANCAMENTO_ORIGINAL_DESATUALIZADO/);
 await assert.rejects(()=>compensarRepasseCartaoManualSomenteSandbox({
  ...correctionCtx,dados:{...correctionData,fingerprintPreparacaoEsperado:"f".repeat(64)}
 }),/M518_REVISAO_FINANCEIRA_DESATUALIZADA/);
 await assert.rejects(()=>compensarRepasseCartaoManualSomenteSandbox({
  ...correctionCtx,dados:{...correctionData,valorLiquidoEsperado:"58.79"}
 }),/M518_VALOR_LIQUIDO_DESATUALIZADO/);
 await assert.rejects(()=>compensarRepasseCartaoManualSomenteSandbox({
  ...correctionCtx,simularFalhaAposDebito:true
 }),/M514_ROLLBACK_INJETADO/);
 assert.equal(await prisma.conciliacaoFinanceira.count({where:{
  origem:"ESTORNO_REPASSE_CARTAO_MANUAL_UNIFICADO"
 }}),0);
 const concurrentCorrections=await Promise.allSettled([
  compensarRepasseCartaoManualSomenteSandbox(correctionCtx),
  compensarRepasseCartaoManualSomenteSandbox(correctionCtx)
 ]);
 assert(concurrentCorrections.some(x=>x.status==="fulfilled"),
  "At least one correction must atomically commit");
 const correction=await compensarRepasseCartaoManualSomenteSandbox(correctionCtx);
 assert.equal(correction.reutilizada,true);
 assert.equal(correction.valor,"58.80");
 assert.equal(correction.direcao,"SAIDA");
 assert.equal(correction.transferenciaBancariaExecutada,false);
 assert.equal(correction.apagouLancamentoOriginal,false);
 const correctedSteps=await consultarEtapasRepassesM516(stepsCtx);
 assert.equal(correctedSteps.preparacoes[0].etapa,
  "CORRECAO_INTERNA_REGISTRADA");
 assert.equal(correctedSteps.preparacoes[0].correcaoInterna,true);
 assert.equal(correctedSteps.confirmacaoDisponivelNaTela,false);
 assert.equal(correctedSteps.provaBancariaIndependente,false);
 await assert.rejects(()=>registrarDevolucaoExternaDeclaradaSomenteSandbox(
  customerRefundCtx
 ),/M522_REPASSE_INTERNO_COMPENSADO/);

 const chargesAfterCorrection=discriminarTarifasAntecipacoesM520({
  empresaId:ids.co1,comandaId:closingDraft.id,fluxo:correctedSteps
 });
 assert.deepEqual(chargesAfterCorrection.movimentosInternos,{
  entradasLiquidas:"58.80",correcoesLiquidas:"58.80",
  efeitoLiquido:"0.00"
 });
 assert.equal(chargesAfterCorrection.repassesAtivos.tarifasInformadas,"0.00");
 assert.equal(chargesAfterCorrection.preparacoes.tarifasInformadas,"1.20");
 assert.equal(chargesAfterCorrection.quantidade.corrigido,1);
 const correctedRefund=planejarDevolucaoAposRepasseM521({
  organizacaoId:ids.org,empresaId:ids.co1,comandaId:closingDraft.id,
  fluxo:correctedSteps
 });
 assert.equal(correctedRefund.preparacoes[0].podeSimularDevolucao,false);
 assert.equal(correctedRefund.preparacoes[0].contralancamentoM514EquivaleAReembolso,false);
 assert.throws(()=>simularDevolucaoAposRepasseM521({
  plano:correctedRefund,preparacaoId:preRecord.preparacaoId,
  codigoRevisaoVisto:correctedRefund.preparacoes[0].codigoRevisao,
  valorBrutoDevolucaoProposto:"60.00",confirmouValoresSaoHipoteses:true
 }),/M521_REPASSE_NAO_ELEGIVEL/);


 assert.notEqual(correctedSteps.preparacoes[0].revisaoFinanceira.codigoRevisao,
  postedVersion.codigoRevisao);
 assert.equal(correctedSteps.preparacoes[0].revisaoFinanceira.habilitaCheckout,false);

 const afterCorrectionPlan=planejarIntencoesManuaisM517({
  organizacaoId:ids.org,empresaId:ids.co1,comandaId:closingDraft.id,
  fluxo:correctedSteps
 });
 assert.equal(afterCorrectionPlan.planos[0].operacaoSimulavel,null);
 assert.throws(()=>simularIntencaoManualM517({
  planejamento:afterCorrectionPlan,preparacaoId:preRecord.preparacaoId,
  operacao:"SIMULAR_CORRECAO",referencia:"CI-M517-REPEATED-"+suffix,
  valorLiquidoInformado:"58.80",confirmouConsultaExterna:true,
  motivo:"Repasse corrigido não pode ser corrigido novamente"
 }),/M517_OPERACAO_INDISPONIVEL/);


 assert.equal(await prisma.conciliacaoFinanceira.count({where:{
  origem:"REPASSE_CARTAO_MANUAL_UNIFICADO",origemId:preRecord.preparacaoId
 }}),1,"Original confirmation remains immutable");
 assert.equal(await prisma.conciliacaoFinanceira.count({where:{
  origem:"ESTORNO_REPASSE_CARTAO_MANUAL_UNIFICADO",
  origemId:manualEntry.conciliacaoId
 }}),1,"One and only one compensating debit");
 assert.equal(await prisma.auditoria.count({where:{
  entidadeId:correction.id,acao:"REPASSE_CARTAO_MANUAL_COMPENSADO_CI"
 }}),1);
 assert.equal(Number((await listarContas(ids.co1)).find(x=>x.id===bank.id).saldoConciliado),
  originalBalance,"Compensation returns internal balance to its baseline");
 await assert.rejects(()=>compensarRepasseCartaoManualSomenteSandbox({
  ...correctionCtx,dados:{...correctionData,referenciaCorrecao:"CI-ALTERED-"+suffix}
 }),/M514_REPLAY_DIVERGENTE/);
 await assert.rejects(()=>registrarRepasseCartaoManualSomenteSandbox(manualCtx),
  /M513_REPASSE_COMPENSADO/,"Cannot silently reactivate a compensated deposit");
 await assert.rejects(()=>desconciliarFinanceiro({
  organizacaoId:ids.org,empresaId:ids.co1,usuarioId:reviewerId,
  id:correction.id
 }),/REPASSE_CARTAO_MANUAL_EXIGE_REVISAO_FINANCEIRA/);
 const movements=await listarHistoricoRepasseCartaoM514({
  organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,
  comandaId:closingDraft.id
 });
 assert.equal(movements.length,2);
 assert(movements.some(x=>x.tipo==="REPASSE_CONFIRMADO_MANUALMENTE"&&x.possuiCorrecao));
 assert(movements.some(x=>x.tipo==="CORRECAO_MANUAL"&&x.direcao==="SAIDA"));
 // M.5.15 must not conflate a full reversal with a new negative sale.
 const afterCorrection=await consultarConferenciaManualM515({
  organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,
  comandaId:closingDraft.id
 });
 assert.deepEqual([
  afterCorrection.resumo.entradaLiquidaDeclarada,
  afterCorrection.resumo.correcoesLiquidas,
  afterCorrection.resumo.efeitoLiquidoNoSaldoInterno
 ],["58.80","58.80","0.00"]);
 assert.equal(afterCorrection.movimentos.length,2);
 assert.equal(afterCorrection.resumo.ehSaldoBancarioReal,false);
 assert.equal(afterCorrection.resumo.executarCheckout,false);
 await assert.rejects(()=>consultarConferenciaManualM515({
  organizacaoId:ids.other,empresaId:ids.co1,usuarioId:ids.user,
  comandaId:closingDraft.id
 }),/M57_SEM_ACESSO_FINANCEIRO/);

 await assert.rejects(()=>listarHistoricoRepasseCartaoM514({
  organizacaoId:ids.other,empresaId:ids.co1,usuarioId:ids.user,
  comandaId:closingDraft.id
 }),/M57_SEM_ACESSO_FINANCEIRO/);
 // CI-only regression for a mistakenly-approved entire card payment:
 // even that must never create a second gross bank reconciliation.
 const creditPaymentId=lines.find(x=>x.forma==="CARTAO_CREDITO").pagamentoId;
 await prisma.pagamento.update({where:{id:creditPaymentId},data:{
  status:"APROVADO",pagoEm:new Date("2026-10-15T12:00:00Z")
 }});
 await assert.rejects(()=>conciliarFinanceiro({
  organizacaoId:ids.org,empresaId:ids.co1,usuarioId:ids.user,
  dados:{contaFinanceiraId:bank.id,
   origem:"PAGAMENTO_VENDA",origemId:creditPaymentId}
 }),/CARTAO_UNIFICADO_REPASSE_MANUAL_SEPARADO/);
 await prisma.pagamento.update({where:{id:creditPaymentId},data:{
  status:"PENDENTE",pagoEm:null
 }});
 // The original net credit AND its compensating debit remain immutable.
 assert.equal(await prisma.conciliacaoFinanceira.count({where:{
  empresaId:ids.co1
 }}),2);


 assert.equal((await prisma.pagamento.findUnique({where:{id:lines.find(
  l=>l.forma==="CARTAO_CREDITO").pagamentoId}})).status,"PENDENTE",
  "Nao reconhecer pagamento inteiro enquanto houver parcelas pendentes");

 assert.equal((await conciliarParcelaCartaoSomenteSandbox(settlement)).reutilizada,true);
 await assert.rejects(()=>conciliarParcelaCartaoSomenteSandbox({
  ...settlement,dados:{...settlement.dados,referenciaExterna:"CI-DIFFERENT-"+suffix}
 }),/M55_REPLAY_DIVERGENTE/);
 assert.equal(await prisma.auditoria.count({where:{
  entidade:"ParcelaRecebivelManualUnificado",entidadeId:p0.id,
  acao:"REPASSE_CARTAO_CONCILIADO_MANUAL_CI"
 }}),1);
 assert.deepEqual({
  pagamentos:await prisma.pagamento.count(),caixa:await prisma.movimentacaoCaixa.count(),
  estoque:await prisma.movimentacaoEstoque.count(),fiscal:await prisma.documentoFiscal.count()
 },bankCountBefore);
 // A prepared external repasse MUST block legacy reversal pending human review.
 await assert.rejects(()=>estornarFechamentoManualSomenteSandbox(reverseCtx),
  /M3C_PRE_BAIXA_EXIGE_REVISAO/);
 // CI fixture reset ONLY: exercises the legacy reversal path for pending card
 // installments in the next block; NEVER provide a real un-reconcile operation.
 await prisma.$transaction([
  prisma.auditoria.deleteMany({where:{
   entidade:"ParcelaRecebivelManualUnificado",entidadeId:p0.id,
   acao:"REPASSE_CARTAO_CONCILIADO_MANUAL_CI"
  }}),
  prisma.parcelaRecebivelManualUnificado.update({where:{id:p0.id},
   data:{status:"AGUARDANDO_REPASSE",conciliadoEm:null}})
 ]);
 // Remove ONLY synthetic M.5.14 compensation from the disposable CI DB;
 // real records are immutable and have no delete endpoint.
 await prisma.auditoria.deleteMany({where:{
  entidadeId:correction.id,acao:"REPASSE_CARTAO_MANUAL_COMPENSADO_CI"
 }});
 await prisma.conciliacaoFinanceira.delete({where:{id:correction.id}});
 // CI-ONLY: synthetic manual bank-ledger cleanup before the separate
 // legacy reversal test; there is NO HTTP delete or undo for real operators.
 await prisma.auditoria.deleteMany({where:{
  entidade:"CONCILIACAO_FINANCEIRA",entidadeId:manualEntry.conciliacaoId,
  acao:"REPASSE_CARTAO_MANUAL_CONFIRMADO_CI"
 }});
 await prisma.conciliacaoFinanceira.delete({where:{id:manualEntry.conciliacaoId}});
 assert.equal(await prisma.conciliacaoFinanceira.count({where:{empresaId:ids.co1}}),0);
 // M.5.11 CI FIXTURE CLEANUP ONLY: the real review has no delete API.
 await prisma.auditoria.deleteMany({where:{
  acao:"PRE_BAIXA_CARTAO_CONFERENCIA_DOCUMENTAL_CI",
  entidadeId:documentaryReview.parecerId
 }});
 await prisma.parecerPreBaixaCartaoManualUnificada.delete({
  where:{id:documentaryReview.parecerId}
 });
 // M.5.10 CI TEST FIXTURE CLEANUP ONLY. Real pre-settlements have no
 // delete/undo endpoint. Do not apply this reset in a real environment.
 await assert.rejects(()=>estornarFechamentoManualSomenteSandbox(reverseCtx),
  /M3C_PRE_BAIXA_EXIGE_REVISAO/);
 await prisma.parcelaPreBaixaCartaoManualUnificada.deleteMany({
  where:{preparacaoId:preRecord.preparacaoId}
 });
 await prisma.auditoria.deleteMany({where:{
  acao:"PRE_BAIXA_CARTAO_PREPARADA_CI",entidadeId:preRecord.preparacaoId
 }});
 await prisma.preparacaoBaixaCartaoManualUnificada.delete({
  where:{id:preRecord.preparacaoId}
 });
 assert.equal(await prisma.preparacaoBaixaCartaoManualUnificada.count(),0);
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
 const reverseReport=await consultarResumoRecebiveisCartaoSomenteSandbox(reportCtx);
 assert.equal(reverseReport.totais.estornado,"180.00");
 assert.equal(reverseReport.totais.pendente,"0.00");
 assert.equal(reverseReport.totais.conciliadoDeclarado,"0.00");
 assert.equal(reverseReport.linhas[0].situacao,"ESTORNADO");
 assert.throws(()=>planejarBaixaCartaoM59({resumo:reverseReport,pedido:{
  tipo:"REPASSE_NORMAL",contaFinanceiraId:bank.id,
  referenciaExtrato:"CI-EXTRATO-"+suffix,dataCredito:"2026-10-15",
  parcelaIds:[p0.id],tarifaCartao:"1.20",
  descontoAntecipacao:"0.00",valorLiquidoDeclarado:"58.80",
  confirmouConferenciaExterna:true
 }}),/M59_LINHA_INVALIDA/,
 "Reversed card installments must not regain bank revenue by preview");

 const liveReversed=await consultarRecebiveisCartaoLeituraM57(reportCtx);
 assert.equal(liveReversed.totais.estornado,"180.00");
 assert((await listarComandasRecebiveisCartaoLeituraM57(readCtx)).some(
  x=>x.id===closingDraft.id&&x.status==="CANCELADA"),
  "Read-only panel must display reversed company card operation");
 const reversedFinancial=await resumoFinanceiro(financialScope);
 assert.equal(reversedFinancial.faturamento,0,
  "Reversed sale must not remain in finalized turnover");
 assert.equal(reversedFinancial.receitasRealizadas,legacyBefore.receitasRealizadas,
  "Card still never became an approved cash receipt");
 assert.equal(await prisma.conciliacaoFinanceira.count({where:{empresaId:ids.co1}}),0);


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
