/** Pure release checklist never performs deployment or certifies fiscal compliance. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {avaliarProntidaoM5,CAMPOS_CHECKLIST_M5} from
 "../src/modules/plataforma/pointvet-m5-publicacao.contract.js";
const base={organizacaoId:"tenant-ci",empresaIds:["firm-one","firm-two"],
 commitSha:"a".repeat(40),ambiente:"STAGING"};
test("M5 cannot substitute disposable CI restore for actual staging restore",()=>{
 const result=avaliarProntidaoM5({...base,evidencias:{
  ciCommitValidado:true,restauracaoCiDescartavel:true
 }});
 assert(result.pendencias.includes("RESTORE_BACKUP_REAL_EM_STAGING"));
 assert(result.pendencias.includes("ROLLBACK_DEPLOY_STAGING"));
 assert(result.pendencias.includes("CERTIFICADO_HTTPS_DOMINIO"));
 assert.equal(result.publicacaoAutorizada,false);
 assert.equal(result.executarMigrationsProducao,false);
});
test("M5 complete self-attestation still never authorizes release",()=>{
 const result=avaliarProntidaoM5({...base,evidencias:Object.fromEntries(
  CAMPOS_CHECKLIST_M5.map(x=>[x.campo,true])
 )});
 assert.equal(result.checklistCompletoDeclarado,true);
 assert.equal(result.evidenciaExternaAutenticada,false);
 assert.equal(result.publicacaoAutorizada,false);
 assert.equal(result.executarDeploy,false);
 assert.equal(result.emitirNotaFiscalReal,false);
 assert.equal(result.habilitarPdvUnificadoProducao,false);
});
test("M5 strict identities, stage, TLS and independent issuer risks",()=>{
 for(const input of [
  {...base,organizacaoId:""},
  {...base,empresaIds:["firm-one","firm-one"]},
  {...base,empresaIds:[]}
 ])assert.throws(()=>avaliarProntidaoM5(input),/M5_IDENTIDADE/);
 const reasons=avaliarProntidaoM5({...base,ambiente:"PRODUCAO",risco:{
  gatewayOuMaquininhaAtiva:true,creditoClienteNoCheckout:true,
  emissaoFiscalNaoHomologada:true,unidadesExtrasComCaixaEstoqueAtivos:true
 }}).pendencias;
 for(const reason of ["STAGING_NAO_VERIFICADO","GATEWAY_TEf_INDEVIDAMENTE_ATIVO",
  "CREDITO_CLIENTE_ATIVO","EMISSAO_FISCAL_NAO_HOMOLOGADA",
  "MULTIUNIDADE_NAO_HOMOLOGADA"])
  assert(reasons.includes(reason));
});
