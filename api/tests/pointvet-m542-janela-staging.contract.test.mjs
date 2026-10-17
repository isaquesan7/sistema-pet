import {test} from "node:test";
import assert from "node:assert/strict";
import {avaliarJanelaStagingM542} from "../src/modules/plataforma/pointvet-m542-janela-staging.contract.js";
const tipos={infraSegregada:"INFRA",tlsApi:"TLS",tlsAdmin:"TLS",tlsPortal:"TLS",dnsDedicado:"DNS",emailSink:"EMAIL",webhooksDesativados:"WEBHOOK",dadosSinteticos:"DADOS",smokeHttpReadOnly:"HTTP",authTenantIsolado:"SEGURANCA",observabilidadeAlertas:"OBSERVABILIDADE",backupRealAutorizado:"BACKUP",restoreRealEmStaging:"RESTORE",rtoRpoMedidos:"RECUPERACAO",migrationsRevisadas:"MIGRACAO",rollbackReleaseStaging:"ROLLBACK",rollbackFlagsStaging:"ROLLBACK",revisaoLgpd:"LGPD",aprovacaoHumanaIndependente:"APROVACAO"};
const flags=["stagingSegregado","somenteDadosSinteticos","emailSink","webhooksExternosDesligados","fiscalRealDesligado","pspDesligado","pdvUnificadoDesligado","creditoCheckoutDesligado","semDadosPetKing","semMudancasDnsProducao"];
function base(){
 const commitSha="a".repeat(40),evidencias={},proveniencia={};let i=0;
 for(const [k,tipo] of Object.entries(tipos)){
  const referencia="proof-"+String(i++).padStart(3,"0");
  evidencias[k]={status:"VERIFICADO",referencia,revisor:"auditor"};
  proveniencia[k]={tipo,referencia,revisor:"auditor",coletor:"operator",commitSha,sha256:"f".repeat(64)};
 }
 return {fase:"M5_4_HOMOLOGACAO_REAL",commitSha,shaAnterior:"b".repeat(40),evidencias,proveniencia,
  janela:{scope:"STAGING_SINTETICO_SEM_PRODUCAO",responsavel:"operator",aprovador:"auditor",
  commitSha,ticketMudanca:"change-001",planoInterrupcao:"stop-001",...Object.fromEntries(flags.map(k=>[k,true]))}};
}
test("M5.4.2 completa ainda nao autoriza deploy nem producao",()=>{
 const x=avaliarJanelaStagingM542(base());
 assert.equal(x.validacaoDeclarativaCompleta,true);assert.deepEqual(x.impedimentos,[]);
 for(const k of ["aprovacaoExternaVerificada","ambienteRealInspecionado","stagingOperacional","executarDeploy","executarMigration","executarRestore","executarRollback","habilitarCanario","autorizarProducao"])assert.equal(x[k],false,k);
});
test("M5.4.2 separacao de funcoes, flags e commit obrigatorios",()=>{
 const x=base();x.janela.aprovador=x.janela.responsavel;x.janela.pspDesligado=false;x.janela.commitSha=x.shaAnterior;
 const r=avaliarJanelaStagingM542(x);
 assert(r.impedimentos.includes("SEGREGACAO_DE_FUNCOES_INVALIDA"));
 assert(r.impedimentos.includes("CONDICAO_INSEGURA_pspDesligado"));
 assert(r.impedimentos.includes("COMMIT_NAO_FIXADO"));
});
test("M5.4.2 nao aceita autorizacao de restore real, canario ou producao",()=>{
 const x=base();x.janela.restoreRealAutorizado=true;x.janela.canarioAutorizado=true;
 assert(avaliarJanelaStagingM542(x).impedimentos.includes("ESCOPO_EXCEDE_STAGING_SINTETICO"));
});
test("M5.4.2 bloqueia segredo inclusive em ticket",()=>{
 const x=base();x.janela.token="secret";assert.throws(()=>avaliarJanelaStagingM542(x),/CREDENCIAIS_PROIBIDAS/);
});
