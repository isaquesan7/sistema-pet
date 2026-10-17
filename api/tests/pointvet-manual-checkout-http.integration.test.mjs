/** Checkout REAL de gestão manual, mas exercitado SOMENTE no PostgreSQL CI.
 * Nenhum pagamento externo, fiscal, balança, hardware ou deploy.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import {salvarRascunho,reservarOperacoesFechamento} from "../src/modules/pdv/pdv-unificado.service.js";
import {prepararExecucaoUnificada} from "../src/modules/pdv/pdv-unificado-preparacao.service.js";

const CI_URL="postgresql://pointvet_ci:pointvet_ci_only@localhost:5432/pointvet_unified_ci";
test("checkout manual HTTP: dois CNPJs, 333 g, pagamentos mistos, replay e rollback",async t=>{
 if(process.env.GITHUB_ACTIONS!=="true"||process.env.NODE_ENV!=="test"||
    process.env.POINTVET_UNIFIED_SALES_SANDBOX!=="1"||process.env.DATABASE_URL!==CI_URL)
  throw Error("CHECKOUT_HTTP_SOMENTE_CI_DESCARTAVEL");
 const db=await prisma.$queryRaw`SELECT current_database() AS nome, current_user AS usuario`;
 assert.equal(db[0].nome,"pointvet_unified_ci");
 assert.equal(db[0].usuario,"pointvet_ci");
 const suffix=Date.now().toString(36)+process.pid.toString(36);
 const org="chk-org-"+suffix,store="chk-store-"+suffix,service="chk-service-"+suffix;
 const seller="chk-user-"+suffix,limited="chk-limited-"+suffix,client="chk-client-"+suffix;
 const productId="chk-prod-"+suffix,itemId="chk-item-"+suffix,serviceId="chk-svc-"+suffix;
 const old={secret:process.env.JWT_ACCESS_SECRET,enabled:process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED,
  allowed:process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS,
  companies:process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS};
 process.env.JWT_ACCESS_SECRET="checkout-ci-synthetic-only-never-production";
 delete process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED;
 delete process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS;
 delete process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS;
 t.after(()=>{
  for(const [key,value] of [["JWT_ACCESS_SECRET",old.secret],
   ["POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED",old.enabled],
   ["POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS",old.allowed],
   ["POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS",old.companies]]){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 });
 await prisma.organizacao.create({data:{id:org,slug:org,nome:"Checkout manual CI"}});
 await prisma.configuracaoOrganizacao.create({data:{organizacaoId:org,pdvUnificadoHabilitado:true}});
 await prisma.moduloOrganizacao.create({data:{organizacaoId:org,modulo:"PDV",contratado:true,habilitado:true}});
 const plan=await prisma.planoSaaS.create({data:{slug:"chk-plan-"+suffix,nome:"Checkout CI",precoMensal:"0",precoAnual:"0"}});
 await prisma.assinaturaSaaS.create({data:{organizacaoId:org,planoId:plan.id,status:"ATIVA"}});
 await prisma.empresa.createMany({data:[
  {id:store,organizacaoId:org,cnpj:"55"+String(Date.now()).slice(-12),nomeFantasia:"Pet Shop CI",razaoSocial:"Pet Shop CI",tipo:"LOJA_CONSULTORIO"},
  {id:service,organizacaoId:org,cnpj:"44"+String(Date.now()).slice(-12),nomeFantasia:"Estetica CI",razaoSocial:"Estetica CI",tipo:"BANHO_TOSA"}
 ]});
 await prisma.usuario.createMany({data:[
  {id:seller,nome:"Caixa autorizado CI",email:seller+"@ci.invalid",senhaHash:"inutil"},
  {id:limited,nome:"Caixa limitado CI",email:limited+"@ci.invalid",senhaHash:"inutil"}
 ]});
 await prisma.usuarioOrganizacao.createMany({data:[
  {usuarioId:seller,organizacaoId:org,papel:"ADMINISTRADOR"},
  {usuarioId:limited,organizacaoId:org,papel:"MEMBRO"}
 ]});
 const permission=await prisma.permissao.upsert({where:{codigo:"pdv.acessar"},update:{},create:{codigo:"pdv.acessar",nome:"Acessar PDV"}});
 const cancelPermission=await prisma.permissao.upsert({where:{codigo:"pdv.cancelar_venda"},update:{},create:{codigo:"pdv.cancelar_venda",nome:"Cancelar venda"}});
 const roleStore=await prisma.cargo.create({data:{empresaId:store,nome:"Caixa CI",permissoes:{create:[{permissaoId:permission.id},{permissaoId:cancelPermission.id}]}}});
 const roleService=await prisma.cargo.create({data:{empresaId:service,nome:"Caixa Estetica CI",permissoes:{create:[{permissaoId:permission.id}]}}});
 await prisma.usuarioEmpresa.createMany({data:[
  {usuarioId:seller,empresaId:store,cargoId:roleStore.id},
  {usuarioId:seller,empresaId:service,cargoId:roleService.id},
  {usuarioId:limited,empresaId:store,cargoId:roleStore.id}
 ]});
 await prisma.cliente.create({data:{id:client,organizacaoId:org,nome:"Tutor CI"}});
 await prisma.itemCatalogo.createMany({data:[
  {id:itemId,empresaId:store,nome:"Racao Adulto Granel",tipo:"PRODUTO",precoVenda:"15.00"},
  {id:serviceId,empresaId:service,nome:"Servico Manual",tipo:"SERVICO",precoVenda:"10.00"}
 ]});
 const product=await prisma.produto.create({data:{id:productId,itemId,unidade:"QUILOGRAMA",controlaEstoque:true,controlaLote:true}});
 await prisma.estoqueSaldo.create({data:{produtoId:product.id,quantidade:"1.000"}});
 const lot=await prisma.loteProduto.create({data:{produtoId:product.id,numeroLote:"CI-"+suffix,quantidadeAtual:"1.000"}});
 const cashStore=await prisma.caixa.create({data:{empresaId:store,nome:"Caixa Pet CI"}});
 const cashService=await prisma.caixa.create({data:{empresaId:service,nome:"Caixa Estetica CI"}});
 const sessionStore=await prisma.sessaoCaixa.create({data:{caixaId:cashStore.id,usuarioAberturaId:seller}});
 const sessionService=await prisma.sessaoCaixa.create({data:{caixaId:cashService.id,usuarioAberturaId:seller}});
 const auth=jwt.sign({sub:seller},process.env.JWT_ACCESS_SECRET,{expiresIn:"10m"});
 const limitedAuth=jwt.sign({sub:limited},process.env.JWT_ACCESS_SECRET,{expiresIn:"10m"});
 const server=await new Promise((resolve,reject)=>{
  const s=app.listen(0,"127.0.0.1",()=>resolve(s));s.once("error",reject);
 });
 t.after(()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve())));
 const base=`http://127.0.0.1:${server.address().port}`;
 async function request(method,path,status,body=null,token=auth){
  const response=await fetch(base+path,{method,redirect:"manual",signal:AbortSignal.timeout(12000),
   headers:{authorization:"Bearer "+token,"x-empresa-id":store,accept:"application/json",
    ...(method==="POST"?{"content-type":"application/json"}:{})},
   ...(method==="POST"?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  assert.equal(response.status,status,`${method} ${path}: ${JSON.stringify(result)}`);
  assert.equal(result.success,status===200||status===201);
  return result;
 }
 const args={organizacaoId:org,usuarioId:seller,empresaId:store,clienteId:client,
  itens:[{empresaId:store,itemCatalogoId:itemId,quantidade:0.333},
   {empresaId:service,itemCatalogoId:serviceId,quantidade:1}]};
 const draft=await salvarRascunho(args);
 assert.equal(draft.total,"15.00");
 const ctx={...args,id:draft.id,versao:1};
 await reservarOperacoesFechamento(ctx);
 await prepararExecucaoUnificada({...ctx,dados:{versao:1,alocacoes:[
  {empresaId:store,sessaoCaixaId:sessionStore.id,pagamentos:[
   {forma:"DINHEIRO",valorCentavos:300},{forma:"PIX",valorCentavos:200}]},
  {empresaId:service,sessaoCaixaId:sessionService.id,pagamentos:[
   {forma:"TRANSFERENCIA",valorCentavos:1000}]}
 ]}});
 const endpoint=`/api/pdv-unificado/rascunhos/${draft.id}/fechar-manual`;
 const body={versao:1,alocacoes:[
  {empresaId:store,sessaoCaixaId:sessionStore.id,pagamentos:[
   {forma:"DINHEIRO",valorCentavos:300,confirmadoPeloAtendente:true,referencia:"Caixa conferido"},
   {forma:"PIX",valorCentavos:200,confirmadoPeloAtendente:true,referencia:"PIX externo"}]},
  {empresaId:service,sessaoCaixaId:sessionService.id,pagamentos:[
   {forma:"TRANSFERENCIA",valorCentavos:1000,confirmadoPeloAtendente:true}]}
 ]};
 const before={sales:await prisma.venda.count(),pay:await prisma.pagamento.count(),
  fiscal:await prisma.documentoFiscal.count(),stock:await prisma.movimentacaoEstoque.count()};
 await request("POST",endpoint,401,body,"");
 await request("POST",endpoint,403,body);
 process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED="1";
 await request("POST",endpoint,403,body);
 process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS="outra-organizacao";
 await request("POST",endpoint,403,body);
 assert.equal((await request("GET","/api/pdv-unificado/disponibilidade",200)).dados.checkoutUnificadoDisponivel,false);
 process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS=org;
 await request("POST",endpoint,403,body);
 process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS=store;
 assert.equal((await request("GET","/api/pdv-unificado/disponibilidade",200)).dados.checkoutUnificadoDisponivel,true);
 await request("POST",endpoint,403,body);
 process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS=store+","+service;
 await request("POST",endpoint,403,body,limitedAuth);
 await request("POST",endpoint,400,{...body,alocacoes:[{...body.alocacoes[0],pagamentos:[
  {...body.alocacoes[0].pagamentos[0],confirmadoPeloAtendente:false},body.alocacoes[0].pagamentos[1]
 ]},body.alocacoes[1]]});
 assert.equal(await prisma.venda.count(),before.sales);
 const committed=await request("POST",endpoint,201,body);
 assert.equal(committed.dados.vendas.length,2);
 assert.equal(committed.dados.pagamentosCriados,3);
 assert.equal(committed.dados.emissaoFiscal,false);
 assert.equal(await prisma.pagamento.count(),before.pay+3);
 assert.equal(await prisma.venda.count(),before.sales+2);
 assert.equal(await prisma.documentoFiscal.count(),before.fiscal);
 assert.equal(await prisma.movimentacaoEstoque.count(),before.stock+1);
 assert.equal(Number((await prisma.estoqueSaldo.findUnique({where:{produtoId:product.id}})).quantidade),0.667);
 assert.equal(Number((await prisma.loteProduto.findUnique({where:{id:lot.id}})).quantidadeAtual),0.667);
 const ownSale=committed.dados.vendas.find(v=>v.empresaId===store);
 await request("POST",`/api/pdv/vendas/${ownSale.vendaId}/cancelar`,409,{
  motivo:"A comanda multiempresa exige estorno integral"
 });
 const replay=await request("POST",endpoint,200,body);
 assert.equal(replay.dados.reutilizada,true);
 assert.equal(replay.dados.estoqueMovimentado,false);
 await request("POST",endpoint,409,{...body,alocacoes:[{...body.alocacoes[0],pagamentos:[
  {...body.alocacoes[0].pagamentos[0],referencia:"Diferente"},body.alocacoes[0].pagamentos[1]
 ]},body.alocacoes[1]]});
 assert.equal(await prisma.pagamento.count(),before.pay+3);
 assert.equal(await prisma.documentoFiscal.count(),before.fiscal);
 // Uma segunda comanda maior que o saldo falha na baixa e desfaz registro e vendas.
 const shortageDraft=await salvarRascunho({...args,itens:[{
  empresaId:store,itemCatalogoId:itemId,quantidade:0.900
 }]});
 const shortageCtx={...args,id:shortageDraft.id,versao:1};
 await reservarOperacoesFechamento(shortageCtx);
 await prepararExecucaoUnificada({...shortageCtx,dados:{versao:1,alocacoes:[{
  empresaId:store,sessaoCaixaId:sessionStore.id,pagamentos:[{forma:"PIX",valorCentavos:1350}]
 }]}});
 const shortageReserve=await prisma.reservaFechamentoUnificado.findUnique({
  where:{comandaId_versaoRascunho:{comandaId:shortageDraft.id,versaoRascunho:1}}
 });
 await request("POST",`/api/pdv-unificado/rascunhos/${shortageDraft.id}/fechar-manual`,409,{
  versao:1,alocacoes:[{empresaId:store,sessaoCaixaId:sessionStore.id,pagamentos:[
   {forma:"PIX",valorCentavos:1350,confirmadoPeloAtendente:true}]}]
 });
 assert.equal(await prisma.registroRecebimentoManualUnificado.count({where:{reservaId:shortageReserve.id}}),0);
 assert.equal(await prisma.venda.count(),before.sales+2);
 assert.equal(await prisma.pagamento.count(),before.pay+3);
 assert.equal(Number((await prisma.estoqueSaldo.findUnique({where:{produtoId:product.id}})).quantidade),0.667);
});
