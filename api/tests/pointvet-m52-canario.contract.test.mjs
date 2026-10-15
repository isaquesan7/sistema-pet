import {test} from "node:test";
import assert from "node:assert/strict";
import {avaliarSaudeCanarioM52} from "../src/modules/plataforma/pointvet-m52-canario.contract.js";
const safe=()=>({
 organizacaoId:"pet-king-ci",empresas:["co-alpha"],commitSha:"b".repeat(40),
 configuracao:{somenteLeitura:true,pdvUnificadoAtivo:false,fiscalRealAtivo:false,
  creditoNoCheckout:false,pspOuTefAtivo:false,emailRealAtivo:false,
  outrasOrganizacoesAtivas:false},
 observacao:{httpRequests:200,windowMinutes:30,http5xx:0,apiP95Ms:350,
  backupAgeHours:2,webhooksExternos:0,vendasDuplicadas:0,acessosEntreTenants:0,
  estoqueInconsistente:0,caixaDivergente:0,fiscalNaoEsperado:0,
  falhasAlertasCriticos:0}
});
test("M5.2 healthy observations still never promote or deploy",()=>{
 const report=avaliarSaudeCanarioM52(safe());
 assert.equal(report.amostraDeclaradaSuficiente,true);
 assert.equal(report.observacaoAutenticadaPorFontesExternas,false);
 assert.equal(report.publicacaoAutorizada,false);
 assert.equal(report.alterarFeatureFlag,false);
 assert.equal(report.expandirCanario,false);
 assert.equal(report.rollbackAutomatico,false);
});
test("M5.2 each critical zero-tolerance metric stops canary",()=>{
 for(const field of ["webhooksExternos","vendasDuplicadas","acessosEntreTenants",
   "estoqueInconsistente","caixaDivergente","fiscalNaoEsperado","falhasAlertasCriticos"]){
  const v=safe();v.observacao[field]=1;
  const r=avaliarSaudeCanarioM52(v);
  assert.equal(r.interromperEInvestigar,true,field);
  assert.equal(r.publicacaoAutorizada,false);
 }
});
test("M5.2 minimum sample, 5xx ratio, p95, stale backups, unauthorized flags stop canary",()=>{
 const v=safe();v.observacao.httpRequests=10;v.observacao.windowMinutes=5;
 v.observacao.http5xx=3;v.observacao.apiP95Ms=2000;
 v.observacao.backupAgeHours=50;
 v.configuracao.pspOuTefAtivo=true;v.configuracao.pdvUnificadoAtivo=true;
 const r=avaliarSaudeCanarioM52(v);
 for(const code of ["MIN_HTTP_REQUESTS","MIN_OBSERVATION_WINDOW_MINUTES",
  "HTTP_5XX_ACIMA_DO_LIMITE","LATENCIA_P95_ACIMA_DO_LIMITE",
  "BACKUP_FORA_DA_JANELA","GATEWAY_OU_TEF_ATIVADO","PDV_UNIFICADO_ATIVADO"])
  assert(r.impedimentos.includes(code),code);
});
test("M5.2 malformed metrics are always fail closed",()=>{
 for(const value of [undefined,NaN,Infinity,-1,0.2]){
  const v=safe();v.observacao.vendasDuplicadas=value;
  assert(avaliarSaudeCanarioM52(v).impedimentos.includes("DUPLICIDADE_DE_VENDAS"));
 }
 for(const x of [null,NaN,-1,Infinity]){
  const v=safe();v.observacao.apiP95Ms=x;
  assert(avaliarSaudeCanarioM52(v).impedimentos.includes("LATENCIA_P95_ACIMA_DO_LIMITE"));
 }
});
