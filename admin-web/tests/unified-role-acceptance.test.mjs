/** M.5.63: a evidência vem da API viva; rejeita sessão obsoleta e dados de outro tenant. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildUnifiedRoleAcceptanceMatrix} from "../src/lib/unifiedRoleAcceptance.js";

const org={id:"pet-king-test",nome:"Organização fictícia"};
const selectedCompany={id:"loja"};
const staleSession=[
 {id:"loja",organizacaoId:org.id,nomeFantasia:"Loja teste",permissoes:["pdv.acessar","pdv.cancelar_venda"]},
 {id:"banho",organizacaoId:org.id,nomeFantasia:"Banho teste",permissoes:[]},
 {id:"outro",organizacaoId:"outro-tenant",nomeFantasia:"Outro tenant",permissoes:["pdv.acessar","pdv.cancelar_venda"]}
];
const server={
 contextoAcesso:{organizacaoId:org.id,empresaId:"loja"},
 perfilAcesso:{papelOrganizacao:"MEMBRO",superAdmin:false},
 permissoesEmpresas:[
  {id:"loja",nomeFantasia:"Loja teste",cnpj:"00.000.000/0001-00",pdvAcessar:true,pdvCancelarVenda:false},
  {id:"banho",nomeFantasia:"Banho teste",cnpj:"00.000.000/0002-00",pdvAcessar:true,pdvCancelarVenda:true}
 ],
 checkoutUnificadoDisponivel:false,estornoUnificadoDisponivel:true
};

test("atendente vê somente permissões atuais da API, não as permissões obsoletas da sessão",()=>{
 const state=buildUnifiedRoleAcceptanceMatrix({
  user:{nome:"Atendente teste",superAdmin:true,empresas:staleSession},
  organization:org,selectedCompany,availability:server
 });
 assert.equal(state.verified,true);
 assert.equal(state.platformAdmin,false,"A API é autoridade também para o perfil de plataforma");
 assert.equal(state.organizationRole,"MEMBRO");
 assert.equal(state.companies.length,2);
 assert.equal(state.companies.some(c=>c.id==="outro"),false,"Outro tenant da sessão nunca é copiado");
 assert.equal(state.companies.find(c=>c.id==="loja").canAccess,true);
 assert.equal(state.companies.find(c=>c.id==="loja").canCancel,false);
 assert.equal(state.companies.find(c=>c.id==="banho").canCancel,true);
 assert.equal(state.companies.find(c=>c.id==="loja").selected,true);
 assert.equal(state.checkoutAvailable,false);
 assert.equal(state.reversalAvailable,true);
});

test("superadmin sinalizado pela API e gates restritos à empresa selecionada",()=>{
 const state=buildUnifiedRoleAcceptanceMatrix({
  user:{nome:"Admin teste",superAdmin:false,empresas:staleSession},
  organization:org,selectedCompany,
  availability:{...server,perfilAcesso:{papelOrganizacao:"ADMINISTRADOR",superAdmin:true}}
 });
 assert.equal(state.platformAdmin,true);
 assert.equal(state.organizationRole,"ADMINISTRADOR");
 assert.equal(state.companies.find(c=>c.id==="loja").selected,true);
});

test("falha fechada em resposta antiga, sem dados ou com organização/CNPJ divergentes",()=>{
 const args={user:{empresas:staleSession},organization:org,selectedCompany};
 for(const availability of [
  undefined,
  {checkoutUnificadoDisponivel:true,estornoUnificadoDisponivel:true},
  {...server,contextoAcesso:{organizacaoId:"outro-tenant",empresaId:"loja"}},
  {...server,contextoAcesso:{organizacaoId:org.id,empresaId:"banho"}},
  {...server,permissoesEmpresas:null}
 ]){
  const state=buildUnifiedRoleAcceptanceMatrix({...args,availability});
  assert.equal(state.verified,false);
  assert.equal(state.platformAdmin,null);
  assert.deepEqual(state.companies,[]);
  assert.equal(state.checkoutAvailable,null);
  assert.equal(state.reversalAvailable,null);
 }
 assert.equal(buildUnifiedRoleAcceptanceMatrix({...args,organization:null,availability:server}).verified,false);
});

test("painel de homologação é somente leitura, faz refresh GET e não se auto-habilita em produção",()=>{
 const panel=readFileSync(new URL("../src/components/UnifiedRoleAcceptancePanel.jsx",import.meta.url),"utf8");
 const page=readFileSync(new URL("../src/pages/UnifiedPdvPreviewPage.jsx",import.meta.url),"utf8");
 const settings=readFileSync(new URL("../src/pages/SettingsPage.jsx",import.meta.url),"utf8");
 assert.match(panel,/if\(!POINTVET_IS_STAGING\)return null/);
 assert.match(panel,/buildUnifiedRoleAcceptanceMatrix/);
 assert.match(panel,/NÃO prova autorização/);
 assert.match(panel,/Atualizar permissões da API/);
 assert.doesNotMatch(panel,/api\.(post|put|patch|delete)\(/);
 assert.doesNotMatch(page,/UnifiedRoleAcceptancePanel/);
 assert.match(settings,/POINTVET_IS_STAGING&&hasPermission\("pdv.acessar"\)/);
 assert.match(settings,/queryKey:\["pdv-role-acceptance-settings",organizationId,companyId\]/);
 assert.match(settings,/<UnifiedRoleAcceptancePanel availability=\{!query.isFetching&&!query.isError\?query.data:null\}/);
 assert.match(settings,/onRefresh=\{\(\)=>query.refetch\(\)\}/);
});
