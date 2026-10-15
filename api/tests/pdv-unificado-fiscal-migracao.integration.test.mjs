/** PointVet M.4C.3 — assisted fiscal linking, rollback and tenant guards on PG16 CI. */
import {test} from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import {
 planejarVinculoFiscalLegadoSomenteSandbox,
 vincularEmpresaLegadaSomenteSandbox,
 reverterVinculoFiscalLegadoSomenteSandbox
} from "../src/modules/fiscal/fiscal-unidades-migracao-sandbox.service.js";
const suffix=Date.now().toString(36);
const ID=x=>x+suffix;
test("M.4C.3: supervised fiscal migration, reversible link, replay, rollbacks and isolation",async()=>{
 const org=ID("m43-org-"),other=ID("m43-out-"),co=ID("m43-company-"),
  otherCompany=ID("m43-foreign-"),user=ID("m43-manager-"),tutor=ID("m43-customer-");
 await prisma.organizacao.createMany({data:[
  {id:org,slug:ID("m43-org-slug-"),nome:"Fiscal topology CI"},
  {id:other,slug:ID("m43-other-slug-"),nome:"Unrelated organization"}
 ]});
 await prisma.empresa.createMany({data:[
  {id:co,organizacaoId:org,razaoSocial:"Empresa Exemplo LTDA",
   nomeFantasia:"Loja Principal",cnpj:"10101010101010",
   cidade:"Salvador",estado:"BA",tipo:"LOJA_CONSULTORIO"},
  {id:otherCompany,organizacaoId:other,razaoSocial:"Outra LTDA",
   nomeFantasia:"Loja Externa",cnpj:"20202020202020",
   cidade:"Salvador",estado:"BA",tipo:"OUTRA"}
 ]});
 await prisma.usuario.create({data:{
  id:user,nome:"Administrador fiscal CI",email:ID("m43-")+"@ci.invalid",
  senhaHash:"not-a-login"
 }});
 await prisma.usuarioOrganizacao.create({data:{
  usuarioId:user,organizacaoId:org,papel:"ADMINISTRADOR"
 }});
 const perm=await prisma.permissao.upsert({where:{codigo:"fiscal.gerenciar"},
  update:{},create:{codigo:"fiscal.gerenciar",nome:"Gerenciar fiscal"}});
 const cargo=await prisma.cargo.create({data:{
  empresaId:co,nome:"Gestor M4C3 CI",
  permissoes:{create:[{permissaoId:perm.id}]}
 }});
 await prisma.usuarioEmpresa.create({data:{
  usuarioId:user,empresaId:co,cargoId:cargo.id
 }});
 await prisma.configuracaoFiscalEmpresa.create({data:{
  empresaId:co,regime:"SIMPLES_NACIONAL",
  ambiente:"HOMOLOGACAO",provedorFiscal:"CI_NAO_TRANSMITIR"
 }});
 await prisma.cliente.create({data:{id:tutor,organizacaoId:org,nome:"Tutor CI"}});
 const existingSale=await prisma.venda.create({data:{
  empresaId:co,clienteId:tutor,usuarioId:user,status:"FINALIZADA",
  subtotal:"10.00",valorTotal:"10.00"
 }});
 const existingDocument=await prisma.documentoFiscal.create({data:{
  empresaId:co,vendaId:existingSale.id,tipo:"NFE",status:"PENDENTE",
  ambiente:"HOMOLOGACAO",simulado:true
 }});
 const otherEntity=await prisma.entidadeFiscal.create({data:{
  organizacaoId:other,cnpj:"20202020202020",razaoSocial:"Outra LTDA"
 }});
 const baseline={
  empresa:await prisma.empresa.findUnique({where:{id:co}}),
  sale:await prisma.venda.findUnique({where:{id:existingSale.id}}),
  fiscal:await prisma.documentoFiscal.findUnique({where:{id:existingDocument.id}}),
  vendas:await prisma.venda.count(),pagamentos:await prisma.pagamento.count(),
  estoque:await prisma.movimentacaoEstoque.count(),
  caixa:await prisma.movimentacaoCaixa.count()
 };
 const base={organizacaoId:org,empresaId:co,usuarioId:user};
 const request={...base,codigo:"MATRIZ",solicitacaoId:ID("m43-request-")};
 const preview=await planejarVinculoFiscalLegadoSomenteSandbox(base);
 assert.equal(preview.historico.documentos,1);
 assert.equal(preview.historico.vendas,1);
 assert.equal(preview.jaVinculada,false);
 assert.equal(preview.cnpjConfirmadoNaReceitaFederal,false);
 assert.equal(preview.fiscalHabilitado,false);
 const payload={...request,fingerprint:preview.fingerprint};
 // No organization manager = no migration even with company fiscal role.
 await prisma.usuarioOrganizacao.update({where:{
  usuarioId_organizacaoId:{usuarioId:user,organizacaoId:org}
 },data:{papel:"MEMBRO"}});
 await assert.rejects(()=>vincularEmpresaLegadaSomenteSandbox(payload),
  /M4C3_GESTOR_DA_ORGANIZACAO_OBRIGATORIO/);
 await prisma.usuarioOrganizacao.update({where:{
  usuarioId_organizacaoId:{usuarioId:user,organizacaoId:org}
 },data:{papel:"ADMINISTRADOR"}});
 await prisma.cargoPermissao.delete({where:{cargoId_permissaoId:{
  cargoId:cargo.id,permissaoId:perm.id
 }}});
 await assert.rejects(()=>vincularEmpresaLegadaSomenteSandbox(payload),
  /M4C3_PERMISSAO_FISCAL_GERENCIAR_OBRIGATORIA/);
 await prisma.cargoPermissao.create({data:{cargoId:cargo.id,permissaoId:perm.id}});
 await assert.rejects(()=>vincularEmpresaLegadaSomenteSandbox({
  ...payload,organizacaoId:other
 }),/M4C3_GESTOR_DA_ORGANIZACAO_OBRIGATORIO/);
 await assert.rejects(()=>vincularEmpresaLegadaSomenteSandbox({
  ...payload,empresaId:otherCompany
 }),/M4C3_GESTOR_DA_ORGANIZACAO_OBRIGATORIO|M4C3_PERMISSAO_FISCAL_GERENCIAR_OBRIGATORIA/);
 await prisma.empresa.update({where:{id:co},data:{nomeFantasia:"Nome Alterado"}});
 await assert.rejects(()=>vincularEmpresaLegadaSomenteSandbox(payload),
  /M4C3_ORIGEM_ALTERADA_DESDE_REVISAO/);
 await prisma.empresa.update({where:{id:co},data:{nomeFantasia:"Loja Principal"}});
 // The test itself edited this legacy Empresa to invalidate the old preview,
 // so refresh the baseline AFTER that deliberate updateAt change. The migration
 // and its reversal must not alter anything from this settled baseline.
 baseline.empresa=await prisma.empresa.findUnique({where:{id:co}});
 const fresh=await planejarVinculoFiscalLegadoSomenteSandbox(base);
 const approved={...request,fingerprint:fresh.fingerprint};
 const disabled=process.env.POINTVET_UNIFIED_SALES_SANDBOX;
 process.env.POINTVET_UNIFIED_SALES_SANDBOX="0";
 await assert.rejects(()=>vincularEmpresaLegadaSomenteSandbox(approved),
  /EXECUCAO_SANDBOX_DESABILITADA/);
 process.env.POINTVET_UNIFIED_SALES_SANDBOX=disabled;
 await assert.rejects(()=>vincularEmpresaLegadaSomenteSandbox({
  ...approved,simularFalhaAposVinculo:true
 }),/M4C3_FALHA_SIMULADA_VINCULO/);
 assert.equal(await prisma.entidadeFiscal.count({where:{
  organizacaoId:org,cnpj:baseline.empresa.cnpj
 }}),0,"Issuer must roll back");
 assert.equal(await prisma.unidadeOperacional.count({where:{
  empresaLegadaId:co
 }}),0,"Link must roll back");
 assert.equal(await prisma.auditoria.count({where:{
  acao:"M4C3_VINCULO_FISCAL_LEGADO_CI",empresaId:co
 }}),0,"Audit must roll back");
 const racing=await Promise.allSettled([
  vincularEmpresaLegadaSomenteSandbox(approved),
  vincularEmpresaLegadaSomenteSandbox(approved)
 ]);
 assert(racing.some(x=>x.status==="fulfilled"),racing.map(
  x=>x.reason?.message||x.status).join(" | "));
 const linked=await vincularEmpresaLegadaSomenteSandbox(approved);
 assert.equal(linked.reutilizado,true);
 assert.equal(linked.estado,"VINCULADA");
 assert.equal(linked.snapshot.historico.vendas,1);
 assert.equal(linked.snapshot.historico.documentos,1);
 assert.equal(linked.emissaoFiscalHabilitada,false);
 assert.equal(linked.alterouEmpresaLegada,false);
 assert.equal(await prisma.entidadeFiscal.count({where:{
  organizacaoId:org,cnpj:baseline.empresa.cnpj
 }}),1);
 assert.equal(await prisma.unidadeOperacional.count({where:{
  empresaLegadaId:co
 }}),1);
 assert.equal(await prisma.auditoria.count({where:{
  acao:"M4C3_VINCULO_FISCAL_LEGADO_CI",empresaId:co
 }}),1);
 await assert.rejects(()=>vincularEmpresaLegadaSomenteSandbox({
  ...approved,solicitacaoId:ID("m43-different-")
 }),/M4C3_REPETICAO_DIVERGENTE/);
 await assert.rejects(()=>vincularEmpresaLegadaSomenteSandbox({
  ...approved,codigo:"FILIAL"
 }),/M4C3_REPETICAO_DIVERGENTE/);
 const extraUnit=await prisma.unidadeOperacional.create({data:{
  organizacaoId:org,entidadeFiscalId:linked.entidadeFiscalId,
  codigo:"ANEXO",nome:"Anexo conceitual CI"
 }});
 await assert.rejects(()=>prisma.unidadeOperacional.create({data:{
  organizacaoId:org,entidadeFiscalId:otherEntity.id,
  codigo:"EVASAO",nome:"Cross-tenant"
 }}),e=>e.code==="P2003");
 const reverse={...base,solicitacaoId:ID("m43-revert-"),
  motivo:"Revisão fiscal da topologia da empresa legada"};
 await assert.rejects(()=>reverterVinculoFiscalLegadoSomenteSandbox({
  ...reverse,simularFalhaAposVinculo:true
 }),/M4C3_FALHA_SIMULADA_REVERSAO/);
 assert.equal((await prisma.unidadeOperacional.findUnique({
  where:{id:linked.unidadeOperacionalId}
 })).empresaLegadaId,co,"Rollback of failed reversal must preserve link");
 assert.equal(await prisma.auditoria.count({where:{
  acao:"M4C3_REVERSAO_LOGICA_FISCAL_CI",empresaId:co
 }}),0);
 const detached=await reverterVinculoFiscalLegadoSomenteSandbox(reverse);
 assert.equal(detached.estado,"DESVINCULADA_LOGICAMENTE");
 assert.equal(detached.emissaoFiscalHabilitada,false);
 assert.equal((await reverterVinculoFiscalLegadoSomenteSandbox(reverse)).reutilizado,true);
 await assert.rejects(()=>reverterVinculoFiscalLegadoSomenteSandbox({
  ...reverse,motivo:"Motivo alternativo de reversão indevida"
 }),/M4C3_REVERSAO_REPETICAO_DIVERGENTE/);
 await assert.rejects(()=>vincularEmpresaLegadaSomenteSandbox(approved),
  /M4C3_JA_REVERTIDA_REQUER_REVISAO_MANUAL/);
 const originalUnit=await prisma.unidadeOperacional.findUnique({
  where:{id:linked.unidadeOperacionalId}
 });
 assert.equal(originalUnit.empresaLegadaId,null);
 assert.equal(originalUnit.ativa,false);
 assert.equal((await prisma.unidadeOperacional.findUnique({
  where:{id:extraUnit.id}
 })).ativa,true,"Independent unit must remain");
 assert.equal(await prisma.auditoria.count({where:{
  acao:"M4C3_REVERSAO_LOGICA_FISCAL_CI",empresaId:co
 }}),1);
 const history=await planejarVinculoFiscalLegadoSomenteSandbox(base);
 assert.equal(history.jaVinculada,false);
 assert.equal(history.historicoMigracao.reversaoLogica,true);
 assert.deepEqual(await prisma.empresa.findUnique({where:{id:co}}),
  baseline.empresa,"Empresa not mutated");
 assert.deepEqual(await prisma.venda.findUnique({where:{id:existingSale.id}}),
  baseline.sale,"Sale untouched");
 assert.deepEqual(await prisma.documentoFiscal.findUnique({
  where:{id:existingDocument.id}
 }),baseline.fiscal,"Fiscal history untouched");
 assert.equal(await prisma.venda.count(),baseline.vendas);
 assert.equal(await prisma.pagamento.count(),baseline.pagamentos);
 assert.equal(await prisma.movimentacaoEstoque.count(),baseline.estoque);
 assert.equal(await prisma.movimentacaoCaixa.count(),baseline.caixa);
});
