/** Behavioral integration tests against a disposable CI PostgreSQL database.
 * Includes cross-company draft, price recalculation, authorization and stale revision.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import {salvarRascunho,listarRascunhos,simularComanda} from "../src/modules/pdv/pdv-unificado.service.js";
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
 const cargo=await prisma.cargo.create({data:{empresaId:ids.co2,nome:"Operador CI",permissoes:{create:{permissaoId:permission.id}}}});
 await prisma.usuarioEmpresa.createMany({data:[{usuarioId:ids.user,empresaId:ids.co1},{usuarioId:ids.user,empresaId:ids.co2,cargoId:cargo.id}]});
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
 const entries=await listarRascunhos(args);
 assert(entries.some(x=>x.id===draft.id));
 assert.equal(await prisma.venda.count(),0,"Draft must not create sales");
 assert.equal(await prisma.pagamento.count(),0,"Draft must not create payments");
 const updated=await salvarRascunho({...args,itens:[{empresaId:ids.co1,itemCatalogoId:ids.it1,quantidade:2}]},{id:draft.id,versao:1});
 assert.equal(updated.total,"360.00");
 assert.equal(updated.versao,2);
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
