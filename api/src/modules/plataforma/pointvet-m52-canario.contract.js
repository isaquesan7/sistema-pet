/**
 * PointVet M.5.2 — CANARY HEALTH REVIEW (PURE and fail closed).
 * Self-reported metrics are NOT telemetry fetched from Railway, Grafana,
 * PostgreSQL or providers. This never flips a feature flag or deploys.
 */
import {createHash} from "node:crypto";
const fail=x=>{throw Error(x);};
const normal=x=>typeof x==="string"?x.trim():"";
const isCounter=x=>Number.isSafeInteger(x)&&x>=0;
const isMillis=x=>Number.isFinite(x)&&x>=0&&x<=600000;
const METRICS=Object.freeze([
 ["httpRequests",100,"MIN_HTTP_REQUESTS"],
 ["windowMinutes",15,"MIN_OBSERVATION_WINDOW_MINUTES"]
]);
export const LIMITES_CANARIO_M52=Object.freeze({
 minHttpRequests:100,
 minWindowMinutes:15,
 maxErrorRatePct:0.5,
 maxP95Ms:1200,
 maxBackupAgeHours:26,
 maxWebhookOutbound:0,
 maxSalesDuplicated:0,
 maxCrossTenantAccess:0,
 maxStockInconsistencies:0,
 maxCashDifferences:0,
 maxUnexpectedFiscalEvents:0,
 maxCriticalAlertFailures:0
});
export function avaliarSaudeCanarioM52({
 organizacaoId,empresas,commitSha,observacao={},configuracao={}
}={}){
 if(!/^[a-z0-9][a-z0-9._:-]{2,119}$/i.test(normal(organizacaoId))||
    !Array.isArray(empresas)||!empresas.length||
    empresas.some(x=>typeof x!=="string"||x.length<3)||
    new Set(empresas).size!==empresas.length||
    !/^[a-f0-9]{40}$/.test(normal(commitSha)))
  fail("M52_CANARIO_IDENTIDADE_INVALIDA");
 const errors=[];
 if(!observacao||typeof observacao!=="object"||Array.isArray(observacao))
  fail("M52_CANARIO_OBSERVACAO_INVALIDA");
 if(!configuracao||typeof configuracao!=="object"||Array.isArray(configuracao))
  fail("M52_CANARIO_CONFIG_INVALIDA");
 for(const [metric,min,code] of METRICS){
  if(!Number.isSafeInteger(observacao[metric])||observacao[metric]<min)
   errors.push(code);
 }
 if(!isCounter(observacao.http5xx)||
    !isCounter(observacao.httpRequests)||observacao.http5xx>observacao.httpRequests)
  errors.push("ERROS_HTTP_INVALIDOS");
 else if(observacao.httpRequests>0&&observacao.http5xx*100/
          observacao.httpRequests>LIMITES_CANARIO_M52.maxErrorRatePct)
  errors.push("HTTP_5XX_ACIMA_DO_LIMITE");
 if(!isMillis(observacao.apiP95Ms)||
    observacao.apiP95Ms>LIMITES_CANARIO_M52.maxP95Ms)
  errors.push("LATENCIA_P95_ACIMA_DO_LIMITE");
 if(!Number.isFinite(observacao.backupAgeHours)||
    observacao.backupAgeHours<0||
    observacao.backupAgeHours>LIMITES_CANARIO_M52.maxBackupAgeHours)
  errors.push("BACKUP_FORA_DA_JANELA");
 for(const [field,code] of [
  ["webhooksExternos","WEBHOOK_EXTERNO_DETECTADO"],
  ["vendasDuplicadas","DUPLICIDADE_DE_VENDAS"],
  ["acessosEntreTenants","QUEBRA_ISOLAMENTO_TENANT"],
  ["estoqueInconsistente","INCONSISTENCIA_ESTOQUE"],
  ["caixaDivergente","DIVERGENCIA_CAIXA"],
  ["fiscalNaoEsperado","EFEITO_FISCAL_NAO_PREVISTO"],
  ["falhasAlertasCriticos","ALERTAS_CRITICOS_FALHARAM"]
 ])if(!isCounter(observacao[field])||observacao[field]>0)
  errors.push(code);
 if(configuracao.somenteLeitura!==true)errors.push("CANARIO_NAO_READ_ONLY");
 if(configuracao.pdvUnificadoAtivo!==false)errors.push("PDV_UNIFICADO_ATIVADO");
 if(configuracao.fiscalRealAtivo!==false)errors.push("FISCAL_REAL_ATIVADO");
 if(configuracao.creditoNoCheckout!==false)errors.push("CREDITO_CLIENTE_ATIVADO");
 if(configuracao.pspOuTefAtivo!==false)errors.push("GATEWAY_OU_TEF_ATIVADO");
 if(configuracao.emailRealAtivo!==false)errors.push("EMAIL_REAL_ATIVADO");
 if(configuracao.outrasOrganizacoesAtivas!==false)errors.push("OUTRAS_ORGANIZACOES_EXPOSTAS");
 const blockers=[...new Set(errors)].sort();
 const manifest={organizacaoId,empresas:[...empresas].sort(),commitSha,
  impedimentos:blockers};
 return Object.freeze({
  fase:"M5_2_REVISAO_CANARIO",
  ...manifest,
  amostraDeclaradaSuficiente:blockers.length===0,
  observacaoAutenticadaPorFontesExternas:false,
  sinaisDeParada:blockers,
  interromperEInvestigar:blockers.length>0,
  statusHumanizado:blockers.length?"PAUSAR_AVALIAR":"AGUARDAR_APROVACAO_HUMANA",
  revisaoResponsavelObrigatoria:true,
  rollbackAutomatico:false,
  alterarFeatureFlag:false,
  expandirCanario:false,
  executarDeploy:false,
  emitirFiscal:false,
  integracaoMaquininha:false,
  publicacaoAutorizada:false,
  fingerprint: createHash("sha256").update(JSON.stringify(manifest)).digest("hex")
 });
}
