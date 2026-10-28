/** M.5.71 — regressao real no PostgreSQL descartavel: um CNPJ jamais
 * recebe itens, vendas ou comandas vazias abertos apenas no outro.
 * Nao usar Pet King DEV, staging ou producao neste teste. */
import {test} from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import {criarComanda,listarComandas,buscarComanda} from "../src/modules/pdv/pdv.service.js";

test("PDV legado ve somente o escopo de sua empresa mesmo dentro da organizacao",async()=>{
 const suffix=Date.now().toString(36);
 const org="escopo-org-"+suffix, co1="escopo-co1-"+suffix,co2="escopo-co2-"+suffix;
 const cliente="escopo-cli-"+suffix;
 const cnpj1=("91"+String(Date.now()).slice(-12)).padStart(14,"0");
 const cnpj2=("92"+String(Date.now()).slice(-12)).padStart(14,"0");
 const criadas=[];
 const petsCi=[];
 const especiesCi=[];
 try{
  await prisma.organizacao.create({data:{id:org,slug:"escopo-"+suffix,nome:"Org CNPJ CI"}});
  await prisma.empresa.createMany({data:[
   {id:co1,organizacaoId:org,cnpj:cnpj1,nomeFantasia:"Consultorio",razaoSocial:"Consultorio CI",tipo:"LOJA_CONSULTORIO"},
   {id:co2,organizacaoId:org,cnpj:cnpj2,nomeFantasia:"Estetica",razaoSocial:"Estetica CI",tipo:"BANHO_TOSA"},
  ]});
  await prisma.cliente.create({data:{id:cliente,organizacaoId:org,nome:"Tutor de isolamento"}});
  const a=await criarComanda({organizacaoId:org,empresaId:co1,dados:{clienteId:cliente}});
  const b=await criarComanda({organizacaoId:org,empresaId:co2,dados:{clienteId:null}});
  criadas.push(a.id,b.id);
  assert.equal(a.empresaOrigemId,co1);
  assert.equal(b.empresaOrigemId,co2);
  assert.deepEqual((await listarComandas({organizacaoId:org,empresaId:co1})).map(x=>x.id),[a.id]);
  assert.deepEqual((await listarComandas({organizacaoId:org,empresaId:co2})).map(x=>x.id),[b.id]);
  assert.equal((await buscarComanda({organizacaoId:org,empresaId:co1,id:a.id})).id,a.id);
  await assert.rejects(()=>buscarComanda({organizacaoId:org,empresaId:co1,id:b.id}),/COMANDA_NAO_ENCONTRADA/);
  await assert.rejects(()=>buscarComanda({organizacaoId:org,empresaId:co2,id:a.id}),/COMANDA_NAO_ENCONTRADA/);

  const item1="escopo-item1-"+suffix,item2="escopo-item2-"+suffix;
  await prisma.itemCatalogo.createMany({data:[
    {id:item1,empresaId:co1,nome:"Produto unidade A",tipo:"PRODUTO",precoVenda:"10.00"},
    {id:item2,empresaId:co2,nome:"Produto unidade B",tipo:"PRODUTO",precoVenda:"20.00"},
  ]});
  await prisma.comandaItem.createMany({data:[
    {comandaId:a.id,empresaId:co1,itemCatalogoId:item1,descricao:"Produto unidade A",quantidade:1,valorUnitario:"10.00",valorTotal:"10.00"},
    {comandaId:a.id,empresaId:co2,itemCatalogoId:item2,descricao:"Produto unidade B",quantidade:1,valorUnitario:"20.00",valorTotal:"20.00"},
  ]});
  // M.5.72: fixture sintetica da comanda mista encontrada no preflight
  // comercial: duas empresas da mesma organizacao, itens de ambas,
  // vinculos clinicos/esteticos e nenhuma venda registrada.
  const especie=await prisma.especie.create({data:{organizacaoId:org,nome:"Canino CI"}});
  especiesCi.push(especie.id);
  const pet=await prisma.pet.create({data:{clienteId:cliente,especieId:especie.id,nome:"Pet sintético"}});
  petsCi.push(pet.id);
  await prisma.atendimentoClinico.create({data:{empresaId:co1,clienteId:cliente,petId:pet.id,comandaId:a.id}});
  await prisma.ordemServicoBanhoTosa.create({data:{empresaId:co2,clienteId:cliente,petId:pet.id,comandaId:a.id}});
  assert.equal(await prisma.venda.count({where:{comandaId:a.id}}),0);
  assert.equal(await prisma.atendimentoClinico.count({where:{comandaId:a.id,empresaId:co1}}),1);
  assert.equal(await prisma.ordemServicoBanhoTosa.count({where:{comandaId:a.id,empresaId:co2}}),1);
  // A origem tem papel de ancora para comanda vazia; quando ha itens
  // de dois CNPJs, a visibilidade nao deve depender de escolher um.
  await prisma.comanda.update({where:{id:a.id},data:{empresaOrigemId:null}});
  assert.ok((await listarComandas({organizacaoId:org,empresaId:co1})).some(c=>c.id===a.id));
  assert.ok((await listarComandas({organizacaoId:org,empresaId:co2})).some(c=>c.id===a.id));
  await prisma.comanda.update({where:{id:a.id},data:{empresaOrigemId:co1}});
  // Verificacoes anteriores da fixture de isolamento seguem apos isso.
  const list1=await listarComandas({organizacaoId:org,empresaId:co1});
  const list2=await listarComandas({organizacaoId:org,empresaId:co2});
  assert.equal(list1.find(x=>x.id===a.id).itens.length,1);
  assert.equal(list1.find(x=>x.id===a.id).itens[0].empresaId,co1);
  assert.equal(list2.find(x=>x.id===a.id).itens.length,1);
  assert.equal(list2.find(x=>x.id===a.id).itens[0].empresaId,co2);
  const detail=await buscarComanda({organizacaoId:org,empresaId:co2,id:a.id});
  assert.deepEqual(detail.itens.map(x=>x.empresaId),[co2]);
  assert.equal(detail.vendas.length,0);
  await assert.rejects(()=>buscarComanda({organizacaoId:"org-externa",empresaId:co1,id:a.id}),/COMANDA_NAO_ENCONTRADA/);
 }finally{
  if(criadas.length)await prisma.atendimentoClinico.deleteMany({where:{comandaId:{in:criadas}}});
  if(criadas.length)await prisma.ordemServicoBanhoTosa.deleteMany({where:{comandaId:{in:criadas}}});
  if(petsCi.length)await prisma.pet.deleteMany({where:{id:{in:petsCi}}});
  if(especiesCi.length)await prisma.especie.deleteMany({where:{id:{in:especiesCi}}});
  if(criadas.length)await prisma.comandaItem.deleteMany({where:{comandaId:{in:criadas}}});
  if(criadas.length)await prisma.comanda.deleteMany({where:{id:{in:criadas}}});
  await prisma.itemCatalogo.deleteMany({where:{empresaId:{in:[co1,co2]}}});
  await prisma.cliente.deleteMany({where:{id:cliente}});
  await prisma.empresa.deleteMany({where:{id:{in:[co1,co2]}}});
  await prisma.organizacao.deleteMany({where:{id:org}});
 }
});
