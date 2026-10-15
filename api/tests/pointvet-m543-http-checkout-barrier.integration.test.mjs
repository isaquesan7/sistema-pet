/**
 * PointVet M.5.4.3 — HTTP integration test of pre-publication checkout barriers.
 * Disposable PG + localhost only. No checkout, fiscal emission, real payments,
 * SMTP, Railway, external DNS or webhooks. Explicit production fail-closed guards.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";

const CI_URL="postgresql://pointvet_ci:pointvet_ci_only@localhost:5432/pointvet_unified_ci";
function guard(){
 if(process.env.GITHUB_ACTIONS!=="true"||process.env.NODE_ENV!=="test"||
   process.env.POINTVET_UNIFIED_SALES_SANDBOX!=="1"||process.env.DATABASE_URL!==CI_URL)
  throw Error("M543_APENAS_CI_POSTGRES_DESCARTAVEL");
}
async function economicCounts(){
 const [vendas,pagamentos,caixa,estoque,fiscal,creditos,reservas]=await Promise.all([
  prisma.venda.count(),prisma.pagamento.count(),prisma.movimentacaoCaixa.count(),
  prisma.movimentacaoEstoque.count(),prisma.documentoFiscal.count(),
  prisma.creditoClienteMovimento.count(),prisma.reservaFechamentoUnificado.count()
 ]);
 return {vendas,pagamentos,caixa,estoque,fiscal,creditos,reservas};
}

test("M.5.4.3 real Express denies unapproved HTTP checkout and cross-tenant access",async t=>{
 guard();
 const db=await prisma.$queryRawUnsafe("SELECT current_database() AS db, current_user AS actor");
 assert.equal(db[0].db,"pointvet_unified_ci");
 assert.equal(db[0].actor,"pointvet_ci");
 // Deliberately separate synthetic organizations and company grants.
 const suffix=Date.now().toString(36)+"-"+process.pid.toString(36);
 const orgA="m543-org-a-"+suffix,orgB="m543-org-b-"+suffix;
 const companyA="m543-company-a-"+suffix,companyB="m543-company-b-"+suffix;
 const user="m543-user-"+suffix;
 const previousSecret=process.env.JWT_ACCESS_SECRET;
 process.env.JWT_ACCESS_SECRET="pointvet-ci-only-never-a-production-secret";
 t.after(()=>{
  if(previousSecret===undefined)delete process.env.JWT_ACCESS_SECRET;
  else process.env.JWT_ACCESS_SECRET=previousSecret;
 });
 await prisma.organizacao.createMany({data:[
  {id:orgA,slug:"m543-org-a-"+suffix,nome:"M543 synthetic A"},
  {id:orgB,slug:"m543-org-b-"+suffix,nome:"M543 synthetic B"}
 ]});
 await prisma.configuracaoOrganizacao.createMany({data:[
  {organizacaoId:orgA,pdvUnificadoHabilitado:true},
  {organizacaoId:orgB,pdvUnificadoHabilitado:true}
 ]});
 await prisma.moduloOrganizacao.createMany({data:[
  {organizacaoId:orgA,modulo:"PDV",contratado:true,habilitado:true},
  {organizacaoId:orgB,modulo:"PDV",contratado:true,habilitado:true}
 ]});
 const plan=await prisma.planoSaaS.create({data:{
  slug:"m543-plan-"+suffix,nome:"M543 CI isolated",precoMensal:"0",precoAnual:"0"
 }});
 await prisma.assinaturaSaaS.createMany({data:[
  {organizacaoId:orgA,planoId:plan.id,status:"ATIVA"},
  {organizacaoId:orgB,planoId:plan.id,status:"ATIVA"}
 ]});
 await prisma.empresa.createMany({data:[
  {id:companyA,organizacaoId:orgA,cnpj:"77"+String(Date.now()).slice(-12),nomeFantasia:"A",razaoSocial:"A synthetic",tipo:"LOJA_CONSULTORIO"},
  {id:companyB,organizacaoId:orgB,cnpj:"66"+String(Date.now()).slice(-12),nomeFantasia:"B",razaoSocial:"B synthetic",tipo:"LOJA_CONSULTORIO"}
 ]});
 await prisma.usuario.create({data:{id:user,nome:"M543 synthetic user",email:"m543-"+suffix+"@ci.invalid",senhaHash:"no-login"}});
 await prisma.usuarioOrganizacao.create({data:{usuarioId:user,organizacaoId:orgA,papel:"ADMINISTRADOR"}});
 const permission=await prisma.permissao.upsert({where:{codigo:"pdv.acessar"},update:{},create:{codigo:"pdv.acessar",nome:"Acessar PDV"}});
 const role=await prisma.cargo.create({data:{empresaId:companyA,nome:"M543 operator",
  permissoes:{create:[{permissaoId:permission.id}]}}});
 await prisma.usuarioEmpresa.create({data:{usuarioId:user,empresaId:companyA,cargoId:role.id}});
 const token=jwt.sign({sub:user},process.env.JWT_ACCESS_SECRET,{expiresIn:"5m"});
 const invalidToken=jwt.sign({sub:"m543-missing-"+suffix},process.env.JWT_ACCESS_SECRET,{expiresIn:"5m"});
 const server=await new Promise((resolve,reject)=>{
  const listener=app.listen(0,"127.0.0.1",()=>resolve(listener));
  listener.once("error",reject);
 });
 t.after(()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
 assert.equal(server.address().address,"127.0.0.1");
 const base="http://127.0.0.1:"+server.address().port;
 const before=await economicCounts();
 async function request(method,path,status,opts={}){
  const response=await fetch(base+path,{
   method,redirect:"manual",signal:AbortSignal.timeout(8000),
   headers:{accept:"application/json",...(opts.token?{authorization:"Bearer "+opts.token}:{}),
    ...(opts.company?{"x-empresa-id":opts.company}:{}),
    ...(method==="POST"?{"content-type":"application/json"}:{})},
   ...(method==="POST"?{body:JSON.stringify(opts.body??{})}:{})
  });
  assert.equal(response.status,status,method+" "+path);
  assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  assert.match(response.headers.get("content-type")||"",/application\/json/);
  const data=await response.json();
  assert.equal(data.success,status===200,method+" "+path);
  return data;
 }
 const protectedRoutes=[
  ["GET","/api/pdv-unificado/disponibilidade"],
  ["GET","/api/pdv-unificado/rascunhos"],
  ["GET","/api/pdv-unificado/recebiveis-cartao/comandas"],
  ["GET","/api/pdv-unificado/recebiveis-cartao/comandas/dummy"],
  ["GET","/api/pdv-unificado/recebiveis-cartao/comandas/dummy/lancamentos"],
  ["GET","/api/pdv-unificado/recebiveis-cartao/comandas/dummy/conferencia"],
  ["GET","/api/pdv-unificado/recebiveis-cartao/comandas/dummy/etapas"],
  ["GET","/api/pdv-unificado/recebiveis-cartao/comandas/dummy/discriminacao"],
  ["GET","/api/pdv-unificado/recebiveis-cartao/comandas/dummy/devolucao-previa"],
  ["GET","/api/pdv-unificado/recebiveis-cartao/comandas/dummy/simulacao-manual"],
  ["POST","/api/pdv-unificado/simulacao"],
  ["POST","/api/pdv-unificado/rascunhos"],
  ["POST","/api/pdv-unificado/rascunhos/dummy/reservar"],
  ["POST","/api/pdv-unificado/rascunhos/dummy/cancelar-reserva"],
  ["POST","/api/pdv-unificado/rascunhos/dummy/preparacao-execucao"]
 ];
 for(const [method,path] of protectedRoutes){
  await request(method,path,401);
  await request(method,path,401,{token:invalidToken,company:companyA});
 }
 await request("GET","/api/pdv-unificado/disponibilidade",400,{token});
 await request("GET","/api/pdv-unificado/disponibilidade",403,{token,company:companyB});
 const avail=await request("GET","/api/pdv-unificado/disponibilidade",200,{token,company:companyA});
 assert.equal(avail.dados.preferenciaUnificado,true);
 assert.equal(avail.dados.checkoutUnificadoDisponivel,false);
 assert.equal(avail.dados.modoEfetivo,"INDIVIDUAL");
 assert.deepEqual(avail.dados.empresasAcessiveis.map(e=>e.id),[companyA]);
 // M.5.7 — Financeiro module AND company-specific finance permission
 // required for the read-only receivables panel. No write route is allowed.
 const cardList="/api/pdv-unificado/recebiveis-cartao/comandas";
 await request("GET",cardList,403,{token,company:companyA});
 await prisma.moduloOrganizacao.create({data:{
  organizacaoId:orgA,modulo:"FINANCEIRO",contratado:true,habilitado:true
 }});
 await request("GET",cardList,403,{token,company:companyA});
 const financePerm=await prisma.permissao.upsert({where:{codigo:"financeiro.gerenciar"},
  update:{},create:{codigo:"financeiro.gerenciar",nome:"Gerenciar financeiro"}
 });
 await prisma.cargoPermissao.create({data:{cargoId:role.id,permissaoId:financePerm.id}});
 const empty=await request("GET",cardList,200,{token,company:companyA});
 assert.deepEqual(empty.dados,[],"No card receivables for a synthetic company without sales");
 await request("GET",cardList+"/m57-missing",404,{token,company:companyA});
 await request("GET",cardList+"/m57-missing/lancamentos",404,{token,company:companyA});
 await request("GET",cardList+"/m57-missing/conferencia",404,{token,company:companyA});
 await request("GET",cardList+"/m57-missing/etapas",404,{token,company:companyA});
 await request("GET",cardList+"/m57-missing/discriminacao",404,{token,company:companyA});
 await request("GET",cardList+"/m57-missing/devolucao-previa",404,{token,company:companyA});
 await request("GET",cardList+"/%3Fbad/devolucao-previa",400,{token,company:companyA});
 await request("POST",cardList+"/m57-missing/devolucao-previa",404,{token,company:companyA});
 await request("PATCH",cardList+"/m57-missing/devolucao-previa",404,{token,company:companyA});
 await request("GET",cardList+"/%3Fbad/discriminacao",400,{token,company:companyA});
 await request("POST",cardList+"/m57-missing/discriminacao",404,{token,company:companyA});
 await request("GET",cardList+"/m57-missing/simulacao-manual",404,{token,company:companyA});
 await request("GET",cardList+"/%3Fbad/simulacao-manual",400,{token,company:companyA});
 await request("POST",cardList+"/m57-missing/simulacao-manual",404,{token,company:companyA});
 await request("GET",cardList+"/%3Fbad/etapas",400,{token,company:companyA});
 await request("POST",cardList+"/m57-missing/etapas",404,{token,company:companyA});
 await request("GET",cardList+"/%3Fbad/conferencia",400,{token,company:companyA});
 await request("POST",cardList+"/m57-missing/conferencia",404,{token,company:companyA});
 await request("GET",cardList+"/%3Fbad/lancamentos",400,{token,company:companyA});
 await request("POST",cardList+"/m57-missing/lancamentos",404,{token,company:companyA});
 await request("GET",cardList+"/%3Fbad",400,{token,company:companyA});
 await request("POST",cardList+"/m57-missing",404,{token,company:companyA});
 await request("GET",cardList,403,{token,company:companyB});
 await request("GET",cardList+"/m57-missing/lancamentos",403,{token,company:companyB});
 await request("GET",cardList+"/m57-missing/conferencia",403,{token,company:companyB});
 await request("GET",cardList+"/m57-missing/etapas",403,{token,company:companyB});
 await request("GET",cardList+"/m57-missing/discriminacao",403,{token,company:companyB});
 await request("GET",cardList+"/m57-missing/devolucao-previa",403,{token,company:companyB});
 await request("GET",cardList+"/m57-missing/simulacao-manual",403,{token,company:companyB});
 await prisma.cargoPermissao.delete({where:{cargoId_permissaoId:{
  cargoId:role.id,permissaoId:financePerm.id
 }}});
 await request("GET",cardList,403,{token,company:companyA});
 await prisma.cargoPermissao.create({data:{cargoId:role.id,permissaoId:financePerm.id}});
 // The preview is allowed, but no executable checkout route may exist yet.
 for(const path of ["/api/pdv-unificado/checkout","/api/pdv-unificado/finalizar",
  "/api/pdv-unificado/rascunhos/dummy/executar",
  "/api/pdv-unificado/pagamentos"]){
  await request("POST",path,404,{token,company:companyA});
 }
 // Revoking the optional preview preference must not enable a fallback checkout.
 await prisma.configuracaoOrganizacao.update({
  where:{organizacaoId:orgA},data:{pdvUnificadoHabilitado:false}
 });
 const disabled=await request("GET","/api/pdv-unificado/disponibilidade",200,{token,company:companyA});
 assert.equal(disabled.dados.preferenciaUnificado,false);
 assert.equal(disabled.dados.checkoutUnificadoDisponivel,false);
 await request("GET","/api/pdv-unificado/recebiveis-cartao/comandas",403,{token,company:companyA});
 await request("GET","/api/pdv-unificado/recebiveis-cartao/comandas/m57-missing/lancamentos",403,{token,company:companyA});
 await request("GET","/api/pdv-unificado/recebiveis-cartao/comandas/m57-missing/conferencia",403,{token,company:companyA});
 await request("GET","/api/pdv-unificado/recebiveis-cartao/comandas/m57-missing/etapas",403,{token,company:companyA});
 await request("GET","/api/pdv-unificado/recebiveis-cartao/comandas/m57-missing/discriminacao",403,{token,company:companyA});
 await request("GET","/api/pdv-unificado/recebiveis-cartao/comandas/m57-missing/devolucao-previa",403,{token,company:companyA});
 await request("GET","/api/pdv-unificado/recebiveis-cartao/comandas/m57-missing/simulacao-manual",403,{token,company:companyA});
 await request("GET","/api/pdv-unificado/rascunhos",403,{token,company:companyA});
 await request("POST","/api/pdv-unificado/simulacao",403,{token,company:companyA});
 await request("POST","/api/pdv-unificado/rascunhos",403,{token,company:companyA});
 const after=await economicCounts();
 assert.deepEqual(after,before,"HTTP release guard must not change economic/fiscal records");
});
