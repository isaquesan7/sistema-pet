/** M.5.3 rollback gate is not a rollback executor. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {avaliarRollbackStagingM53,ITENS_ROLLBACK_M53} from "../src/modules/plataforma/pointvet-m53-rollback.contract.js";
const base=()=>({
 organizacaoId:"tenant-pet-king-ci",empresaIds:["loja-alpha","consultorio-beta"],
 commitCandidato:"a".repeat(40),commitAnterior:"b".repeat(40),
 evidencias:Object.fromEntries(ITENS_ROLLBACK_M53.map(x=>[x.campo,true])),
 sinaisParada:[],canarioAberto:false
});
test("M.5.3 even full user-provided evidence cannot launch deployment or rollback",()=>{
 const x=avaliarRollbackStagingM53(base());
 assert.equal(x.checklistCompletoDeclarado,true);
 assert.equal(x.evidenciaExternaVerificada,false);
 for(const field of ["operacaoRollbackExecutada","alterarFlag","executarDeploy",
  "executarRollback","executarMigration","autorizarProducao",
  "restauracaoRealExecutada","alterarCaixaOuEstoque"])
  assert.equal(x[field],false);
 assert.equal(x.recomendacao,"SUBMETER_APROVACAO_HUMANA");
});
test("M.5.3 blocks accidental irreversible migration and missing real restore",()=>{
 const x=base();x.evidencias.migracoesCompativeisComRollback=false;
 x.evidencias.restauracaoBackupRealEnsaiada=false;
 const r=avaliarRollbackStagingM53(x);
 assert(r.impedimentos.includes("MIGRACAO_NAO_COMPATIVEL_COM_ROLLBACK"));
 assert(r.impedimentos.includes("BACKUP_REAL_NAO_RESTAURADO_STAGING"));
 assert.equal(r.recomendacao,"BLOQUEAR_PUBLICACAO");
});
test("M.5.3 stops and investigates security or financial canary incident",()=>{
 const x=base();x.sinaisParada=["QUEBRA_ISOLAMENTO_TENANT","DUPLICIDADE_DE_VENDAS"];
 const r=avaliarRollbackStagingM53(x);
 assert.equal(r.recomendacao,"PARAR_E_INVESTIGAR");
 assert.equal(r.executarRollback,false,"no automatic destructive rollback");
 assert.equal(r.executarDeploy,false);
});
test("M.5.3 rejects missing distinct release SHAs and tenant ambiguity",()=>{
 for(const x of [
  {...base(),commitAnterior:"a".repeat(40)},
  {...base(),commitAnterior:"bad"},
  {...base(),empresaIds:["loja-alpha","loja-alpha"]},
  {...base(),organizacaoId:""}
 ])assert.throws(()=>avaliarRollbackStagingM53(x),/M53_IDENTIDADE/);
});
