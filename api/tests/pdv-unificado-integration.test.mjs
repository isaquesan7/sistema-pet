/** Behavioral integration tests against a disposable CI PostgreSQL database.
 * Includes cross-company draft, price recalculation, authorization and stale revision.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import {salvarRascunho,listarRascunhos,simularComanda,conferirPreFechamento,planejarFechamento,reservarOperacoesFechamento,consultarReservaFechamento,cancelarReservaFechamento} from "../src/modules/pdv/pdv-unificado.service.js";
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
 await prisma.cargoPermissao.delete({where:{cargoId_permissaoId:{cargoId:cargo.id,permissaoId:cancelPermission.id}}});
 await assert.rejects(()=>cancelarReservaFechamento({...reservationArgs,motivo:"Deve bloquear cancelamento parcial"}),/CANCELAMENTO_SEM_PERMISSAO/);
 assert.equal((await consultarReservaFechamento(reservationArgs)).status,"RESERVADA");
 await prisma.cargoPermissao.create({data:{cargoId:cargo.id,permissaoId:cancelPermission.id}});
 const cancelled=await cancelarReservaFechamento({...reservationArgs,motivo:"Revisão de itens no teste isolado"});
 assert.equal(cancelled.canceladoPorId,ids.user);
 assert.equal(cancelled.status,"CANCELADA");
 assert(cancelled.operacoes.every(x=>x.status==="CANCELADA"));
 assert.equal((await cancelarReservaFechamento({...reservationArgs,motivo:"Repetição segura"})).status,"CANCELADA");
 await assert.rejects(()=>reservarOperacoesFechamento(reservationArgs),/RESERVA_CANCELADA/);
 const afterCancel=await salvarRascunho(args,{id:reservedDraft.id,versao:1});
 assert.equal(afterCancel.versao,2);
 assert.equal(await prisma.reservaOperacaoUnificada.count({where:{reservaId:cancelled.id}}),2);

 await prisma.itemCatalogo.update({where:{id:ids.it2},data:{precoVenda:"75.00"}});
 const changed=await conferirPreFechamento({...args,id:draft.id,versao:1});
 assert(changed.pendencias.some(i=>i.codigo==="PRECO_ALTERADO"));
 await assert.rejects(()=>planejarFechamento({...args,id:draft.id,versao:1}),/PRE_FECHAMENTO_COM_PENDENCIAS/);
 await prisma.itemCatalogo.update({where:{id:ids.it2},data:{precoVenda:"70.00"}});
 const entries=await listarRascunhos(args);
 assert(entries.some(x=>x.id===draft.id));
 assert.equal(await prisma.venda.count(),0,"Draft must not create sales");
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
