/** Behavioral integration tests against a disposable CI PostgreSQL database.
 * Includes cross-company draft, price recalculation, authorization and stale revision.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import {salvarRascunho,listarRascunhos,simularComanda,conferirPreFechamento,planejarFechamento,reservarOperacoesFechamento,consultarReservaFechamento,cancelarReservaFechamento} from "../src/modules/pdv/pdv-unificado.service.js";
import {conferenciaAlocacaoSchema,conferirAlocacaoFechamento,diagnosticarRecuperacaoFechamento,prepararExecucaoUnificada,consultarPreparacaoUnificada} from "../src/modules/pdv/pdv-unificado-preparacao.service.js";
import {criarVendasFilhasSomenteSandbox} from "../src/modules/pdv/pdv-unificado-venda-sandbox.service.js";
const suffix=Date.now().toString(36);
const ids={org:"org"+suffix,other:"other"+suffix,client:"cli"+suffix,user:"usr"+suffix,co1:"c1"+suffix,co2:"c2"+suffix,pet:null,it1:"i1"+suffix,it2:"i2"+suffix};
test("cross-company saving respects prices, access, rollback and version",async()=>{
 await prisma.organizacao.create({data:{id:ids.org,slug:"test-"+suffix,nome:"Organização CI"}});
 await prisma.organizacao.create({data:{id:ids.other,slug:"outside-"+suffix,nome:"Outra organização"}});
 await prisma.usuario.create({data:{id:ids.user,nome:"Tester",email:suffix+"@ci.invalid",senhaHash:"not-a-login"}});
 await prisma.cliente.create({data:{id:ids.client,organizacaoId:ids.org,nome:"Tutor de teste"}});
 await prisma.empresa.createMany({data:[
  {id:ids.co1,organizacaoId:ids.org,cnpj:"CI-1-"+suffix,nomeFantasia:"Loja",razaoSocial:"Loja CI",tipo:"LOJA_CONSULTORIO"},
  {id:ids.co2,organizacaoId:ids.org,cnpj:"CI-2-"+suffix,nomeFantasia:"Estética",razaoSocial:"Estética CI",tipo:"BANHO_TOSA"}
 ]});
 const permission=await prisma.permissao.upsert({where:{codigo:"pdv.acessar"},update:{},create:{codigo:"pdv.acessar",nome:"Acessar PDV"}});
 const cancelPermission=await prisma.permissao.upsert({where:{codigo:"pdv.cancelar_venda"},update:{},create:{codigo:"pdv.cancelar_venda",nome:"Cancelar venda"}});
 const manager=await prisma.cargo.create({data:{empresaId:ids.co1,nome:"Gestor CI",permissoes:{create:[{permissaoId:permission.id},{permissaoId:cancelPermission.id}]}}});
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
});
