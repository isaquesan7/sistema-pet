/** PointVet M.4C.1 — disposable PostgreSQL 16 fiscal segmentation + topology. */
import {test} from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import {salvarRascunho} from "../src/modules/pdv/pdv-unificado.service.js";
import {planejarFiscalRascunhoUnificadoSomenteSandbox} from "../src/modules/fiscal/fiscal-unificado-planejamento-sandbox.service.js";

const suf=Date.now().toString(36);
const id=s=>s+suf;
test("M.4C issuer, mixed product/service, multiunit CNPJ, permissions, fail-closed fiscal review",async()=>{
 const org=id("orgf"),outside=id("orgx"),actor=id("usrf"),
  client=id("clif"),co1=id("cmpa"),co2=id("cmpb"),coOther=id("cmpx"),
  itemProduct=id("catp"),itemService=id("cats"),itemAnother=id("catb");
 await prisma.organizacao.createMany({data:[
  {id:org,slug:id("fiscal-ci-"),nome:"CI Fiscal"},
  {id:outside,slug:id("fiscal-outside-"),nome:"CI Fora"}
 ]});
 await prisma.usuario.create({data:{
  id:actor,nome:"CI Fiscal Operator",email:id("fiscal-ci-")+"@ci.invalid",senhaHash:"no-login"
 }});
 await prisma.cliente.create({data:{id:client,organizacaoId:org,nome:"Cliente CI Fiscal"}});
 await prisma.empresa.createMany({data:[
  {id:co1,organizacaoId:org,tipo:"LOJA_CONSULTORIO",razaoSocial:"Empresa 1 CI",
   nomeFantasia:"Loja 1",cnpj:"34567890123456",estado:"BA",cidade:"Salvador"},
  {id:co2,organizacaoId:org,tipo:"BANHO_TOSA",razaoSocial:"Empresa 2 CI",
   nomeFantasia:"Loja 2",cnpj:"45678901234567",estado:"BA",cidade:"Salvador"},
  {id:coOther,organizacaoId:outside,tipo:"OUTRA",razaoSocial:"Empresa outra",
   nomeFantasia:"Outra",cnpj:"56789012345678",estado:"BA",cidade:"Salvador"}
 ]});
 const permP=await prisma.permissao.upsert({
  where:{codigo:"pdv.acessar"},update:{},create:{codigo:"pdv.acessar",nome:"PDV"}
 });
 const permF=await prisma.permissao.upsert({
  where:{codigo:"fiscal.visualizar"},update:{},create:{codigo:"fiscal.visualizar",nome:"Fiscal leitura"}
 });
 const c1=await prisma.cargo.create({data:{empresaId:co1,nome:"Gestor fiscal CI",
  permissoes:{create:[{permissaoId:permP.id},{permissaoId:permF.id}]}}});
 const c2=await prisma.cargo.create({data:{empresaId:co2,nome:"Gestor fiscal CI",
  permissoes:{create:[{permissaoId:permP.id},{permissaoId:permF.id}]}}});
 await prisma.usuarioEmpresa.createMany({data:[
  {usuarioId:actor,empresaId:co1,cargoId:c1.id},
  {usuarioId:actor,empresaId:co2,cargoId:c2.id}
 ]});
 await prisma.itemCatalogo.createMany({data:[
  {id:itemProduct,empresaId:co1,nome:"Ração CI",tipo:"PRODUTO",precoVenda:"100.00"},
  {id:itemService,empresaId:co1,nome:"Consulta CI",tipo:"SERVICO",precoVenda:"40.00"},
  {id:itemAnother,empresaId:co2,nome:"Banho CI",tipo:"SERVICO",precoVenda:"60.00"}
 ]});
 await prisma.configuracaoFiscalEmpresa.createMany({data:[
  {empresaId:co1,regime:"SIMPLES_NACIONAL",ambiente:"HOMOLOGACAO",
   provedorFiscal:"CI_NAO_CONECTADO",serieNfe:"1",serieNfce:"2",
   serieNfse:"3",codigoMunicipioIbge:"2927408"},
  {empresaId:co2,regime:"SIMPLES_NACIONAL",ambiente:"HOMOLOGACAO",
   provedorFiscal:"CI_NAO_CONECTADO",serieNfse:"1",codigoMunicipioIbge:"2927408"}
 ]});
 await prisma.configuracaoFiscalItem.createMany({data:[
  {itemCatalogoId:itemProduct,ncm:"23091000",cfop:"5102",origemMercadoria:"0",cstCsosn:"102"},
  {itemCatalogoId:itemService,codigoServicoMunicipal:"TESTE"},
  {itemCatalogoId:itemAnother,codigoServicoMunicipal:"TESTE"}
 ]});
 // Two operational sites MAY have the same hypothetical issuer CNPJ in this
 // future model. No second Empresa is created with that CNPJ.
 const issuer=await prisma.entidadeFiscal.create({data:{
  organizacaoId:org,cnpj:"34567890123456",razaoSocial:"Empresa 1 CI"
 }});
 const unit=await prisma.unidadeOperacional.create({data:{
  organizacaoId:org,entidadeFiscalId:issuer.id,
  empresaLegadaId:co1,codigo:"MATRIZ",nome:"Loja Principal"
 }});
 const extension=await prisma.unidadeOperacional.create({data:{
  organizacaoId:org,entidadeFiscalId:issuer.id,codigo:"ANEXO",nome:"Unidade Anexa"
 }});
 assert.equal((await prisma.unidadeOperacional.count({
  where:{entidadeFiscalId:issuer.id}
 })),2);
 assert.equal(extension.empresaLegadaId,null);
 assert.equal(await prisma.empresa.count({where:{cnpj:issuer.cnpj}}),1);
 await assert.rejects(()=>prisma.unidadeOperacional.create({data:{
  organizacaoId:org,entidadeFiscalId:issuer.id,
  empresaLegadaId:co1,codigo:"OUTRA",nome:"Duplicada"
 }}),e=>e.code==="P2002");
 await assert.rejects(()=>prisma.unidadeOperacional.create({data:{
  organizacaoId:org,entidadeFiscalId:issuer.id,codigo:"ANEXO",nome:"Duplicada"
 }}),e=>e.code==="P2002");
 const args={organizacaoId:org,usuarioId:actor,empresaId:co1,
  clienteId:client,itens:[
   {empresaId:co1,itemCatalogoId:itemProduct,quantidade:1},
   {empresaId:co1,itemCatalogoId:itemService,quantidade:1},
   {empresaId:co2,itemCatalogoId:itemAnother,quantidade:1}
  ]};
 const draft=await salvarRascunho(args);
 const inp={organizacaoId:org,usuarioId:actor,empresaId:co1,
  comandaId:draft.id,versao:draft.versao};
 const before={
  venda:await prisma.venda.count(),pagamento:await prisma.pagamento.count(),
  fiscal:await prisma.documentoFiscal.count(),
  caixa:await prisma.movimentacaoCaixa.count(),
  estoque:await prisma.movimentacaoEstoque.count()
 };
 const plan=await planejarFiscalRascunhoUnificadoSomenteSandbox(inp);
 assert.equal(plan.modo,"PLANO_FISCAL_RASCUNHO_NAO_EXECUTAVEL");
 assert.equal(plan.numeroEmpresas,2);
 assert.equal(plan.numeroGrupos,3);
 assert.equal(plan.total,"200.00");
 assert.equal(plan.todasClassificacoesCompletas,true);
 assert.equal(plan.emissaoHabilitada,false);
 assert.equal(plan.documentoEmitido,false);
 assert.equal(plan.gerouVenda,false);
 const prod=plan.grupos.find(g=>g.empresaId===co1&&g.classe==="PRODUTO");
 const service1=plan.grupos.find(g=>g.empresaId===co1&&g.classe==="SERVICO");
 const service2=plan.grupos.find(g=>g.empresaId===co2&&g.classe==="SERVICO");
 assert.equal(prod.total,"100.00");
 assert.deepEqual(prod.documentosPossiveis,["NFE","NFCE"]);
 assert.equal(prod.topologiaVinculo,"COMPATIVEL_CI");
 assert.equal(prod.entidadeFiscalId,issuer.id);
 assert.deepEqual(service1.documentosPossiveis,["NFSE"]);
 assert.equal(service1.total,"40.00");
 assert.equal(service2.total,"60.00");
 assert.equal(service2.topologiaVinculo,"PENDENTE_MIGRACAO");
 assert.equal(plan.grupos.every(g=>g.emissaoHabilitada===false),true);
 assert.deepEqual((await planejarFiscalRascunhoUnificadoSomenteSandbox(inp)).grupos,
  plan.grupos);
 // Fiscal rights of EACH issuer are mandatory; current company is not enough.
 await prisma.cargoPermissao.delete({where:{cargoId_permissaoId:{
  cargoId:c2.id,permissaoId:permF.id
 }}});
 await assert.rejects(()=>planejarFiscalRascunhoUnificadoSomenteSandbox(inp),
  /M4C_PERMISSAO_FISCAL_EMPRESA_INSUFICIENTE/);
 await prisma.cargoPermissao.create({data:{cargoId:c2.id,permissaoId:permF.id}});
 await assert.rejects(()=>planejarFiscalRascunhoUnificadoSomenteSandbox({
  ...inp,organizacaoId:outside
 }),/M4C_RASCUNHO_NAO_ENCONTRADO/);
 await assert.rejects(()=>planejarFiscalRascunhoUnificadoSomenteSandbox({
  ...inp,empresaId:coOther
 }),/M4C_EMPRESA_SELECIONADA_DIVERGENTE/);
 await assert.rejects(()=>planejarFiscalRascunhoUnificadoSomenteSandbox({
  ...inp,versao:2
 }),/M4C_VERSAO_DESATUALIZADA/);
 const changed=await prisma.itemCatalogo.update({where:{id:itemProduct},
  data:{precoVenda:"110.00"}});
 const priceReview=await planejarFiscalRascunhoUnificadoSomenteSandbox(inp);
 assert(priceReview.grupos.some(g=>g.pendencias.some(p=>p.codigo==="PRECO_CATALOGO_ALTERADO")));
 assert.equal(priceReview.emissaoHabilitada,false);
 await prisma.itemCatalogo.update({where:{id:itemProduct},data:{precoVenda:"100.00"}});
 await prisma.configuracaoFiscalItem.update({where:{itemCatalogoId:itemAnother},
  data:{codigoServicoMunicipal:null}});
 const codeReview=await planejarFiscalRascunhoUnificadoSomenteSandbox(inp);
 assert(codeReview.grupos.some(g=>g.pendencias.some(p=>p.codigo==="CODIGO_SERVICO_MUNICIPAL_AUSENTE")));
 await prisma.configuracaoFiscalItem.update({where:{itemCatalogoId:itemAnother},
  data:{codigoServicoMunicipal:"TESTE"}});
 const otherFiscal=await prisma.entidadeFiscal.create({data:{
  organizacaoId:org,cnpj:"12345678901234",razaoSocial:"Issuer mismatch"
 }});
 await prisma.unidadeOperacional.update({where:{id:unit.id},
  data:{entidadeFiscalId:otherFiscal.id}});
 const topologyReview=await planejarFiscalRascunhoUnificadoSomenteSandbox(inp);
 assert(topologyReview.grupos.find(g=>g.empresaId===co1).pendencias.some(
  p=>p.codigo==="TOPOLOGIA_FISCAL_DIVERGENTE"
 ));
 await prisma.unidadeOperacional.update({where:{id:unit.id},
  data:{entidadeFiscalId:issuer.id}});
 const invoiceRows=await prisma.documentoFiscal.count();
 assert.equal(invoiceRows,before.fiscal);
 assert.deepEqual({
  venda:await prisma.venda.count(),pagamento:await prisma.pagamento.count(),
  fiscal:await prisma.documentoFiscal.count(),
  caixa:await prisma.movimentacaoCaixa.count(),
  estoque:await prisma.movimentacaoEstoque.count()
 },before,"Fiscal preflight is read-only: never issue, sell or settle");
});
