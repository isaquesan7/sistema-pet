/** M.5.62: pure contract for human-acceptance visibility, no server writes. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildUnifiedRoleAcceptanceMatrix} from "../src/lib/unifiedRoleAcceptance.js";

const org={id:"pet-king-test",nome:"Organização fictícia"};
const companies=[
 {id:"loja",organizacaoId:org.id,nomeFantasia:"Loja teste",cnpj:"00.000.000/0001-00",permissoes:["pdv.acessar"]},
 {id:"banho",organizacaoId:org.id,nomeFantasia:"Banho teste",cnpj:"00.000.000/0002-00",permissoes:["pdv.acessar","pdv.cancelar_venda"]},
 {id:"outro",organizacaoId:"outro-tenant",nomeFantasia:"Outro tenant",permissoes:["pdv.acessar","pdv.cancelar_venda"]}
];

test("atendente apresenta permissões independentes por empresa e oculta outro tenant",()=>{
 const state=buildUnifiedRoleAcceptanceMatrix({user:{nome:"Atendente teste",empresas:companies},organization:org,selectedCompany:companies[0]});
 assert.equal(state.platformAdmin,false);
 assert.equal(state.companies.length,2);
 assert.equal(state.companies.find(c=>c.id==="loja").canAccess,true);
 assert.equal(state.companies.find(c=>c.id==="loja").canCancel,false);
 assert.equal(state.companies.find(c=>c.id==="banho").canCancel,true);
 assert.equal(state.companies.find(c=>c.id==="loja").selected,true);
 assert.equal(state.checkoutAvailable,null);
 assert.equal(state.reversalAvailable,null);
});

test("superadmin sinalizado, disponibilidade somente da empresa selecionada",()=>{
 const state=buildUnifiedRoleAcceptanceMatrix({user:{nome:"Admin teste",superAdmin:true,empresas:companies},organization:org,selectedCompany:companies[1],availability:{checkoutUnificadoDisponivel:false,estornoUnificadoDisponivel:true}});
 assert.equal(state.platformAdmin,true);
 assert.equal(state.companies.find(c=>c.id==="banho").selected,true);
 assert.equal(state.checkoutAvailable,false);
 assert.equal(state.reversalAvailable,true);
});

test("não inventa permissões na ausência de sessão ou organização",()=>{
 const state=buildUnifiedRoleAcceptanceMatrix({user:{empresas:companies},organization:null,availability:{checkoutUnificadoDisponivel:false}});
 assert.deepEqual(state.companies,[]);
 assert.equal(state.reversalAvailable,false);
});

test("painel de homologação é somente leitura e não se auto-habilita em produção",()=>{
 const panel=readFileSync(new URL("../src/components/UnifiedRoleAcceptancePanel.jsx",import.meta.url),"utf8");
 const page=readFileSync(new URL("../src/pages/UnifiedPdvPreviewPage.jsx",import.meta.url),"utf8");
 assert.match(panel,/if\(!POINTVET_IS_STAGING\)return null/);
 assert.match(panel,/buildUnifiedRoleAcceptanceMatrix/);
 assert.match(panel,/NÃO prova autorização/);
 assert.doesNotMatch(panel,/api\.(post|put|patch|delete)\(/);
 assert.match(page,/UnifiedRoleAcceptancePanel/);
});
