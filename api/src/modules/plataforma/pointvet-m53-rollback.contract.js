/**
 * PointVet M.5.3 — PURE staged rollback readiness, no executable rollback.
 * A green paper checklist NEVER authorizes deployment / migrations / deletion.
 */
import {createHash} from "node:crypto";
const SHA=/^[a-f0-9]{40}$/;
const ID=/^[a-z0-9][a-z0-9._:-]{2,119}$/i;
const CHECKS=Object.freeze([
 ["referenciaDeployAnteriorValidada","RELEASE_ANTERIOR_NAO_VALIDADA"],
 ["imagemDeployAnteriorDisponivel","IMAGEM_ANTERIOR_NAO_DISPONIVEL"],
 ["featureFlagTenantDesligavel","FLAG_POR_TENANT_NAO_REVERSIVEL"],
 ["migracoesCompativeisComRollback","MIGRACAO_NAO_COMPATIVEL_COM_ROLLBACK"],
 ["historicoPrismaRevisado","MIGRACOES_SEM_REVISAO"],
 ["restauracaoBackupRealEnsaiada","BACKUP_REAL_NAO_RESTAURADO_STAGING"],
 ["planoRecuperacaoDadosAprovado","PLANO_DADOS_NAO_APROVADO"],
 ["semPagamentosFiscalExterno","EFEITOS_EXTERNOS_NAO_ISOLADOS"],
 ["contasAutorizadasRevisadas","USUARIOS_NAO_REVISADOS"],
 ["operadorReversaoDesignado","OPERADOR_REVERSAO_NAO_DESIGNADO"],
 ["canarioRestritoAoTenant","CANARIO_EXPOE_OUTROS_TENANTS"],
 ["alertasMonitorados","ALERTAS_SEM_MONITORAMENTO"]
]);
const invalid=code=>{throw Error(code);};
const isObj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
export const ITENS_ROLLBACK_M53=CHECKS.map(([campo,codigo])=>Object.freeze({campo,codigo}));
export function avaliarRollbackStagingM53({
 organizacaoId,empresaIds,commitCandidato,commitAnterior,
 evidencias={},sinaisParada=[],canarioAberto=false
}={}){
 if(!ID.test(organizacaoId||"")||!Array.isArray(empresaIds)||
    !empresaIds.length||empresaIds.length>25||
    empresaIds.some(x=>typeof x!=="string"||!ID.test(x))||
    new Set(empresaIds).size!==empresaIds.length||
    !SHA.test(commitCandidato||"")||
    !SHA.test(commitAnterior||"")||
    commitCandidato===commitAnterior)
  invalid("M53_IDENTIDADE_OU_REFERENCIAS_INVALIDAS");
 if(!isObj(evidencias)||!Array.isArray(sinaisParada)||
    sinaisParada.some(x=>typeof x!=="string"||!ID.test(x)))
  invalid("M53_EVIDENCIAS_OU_SINAIS_INVALIDOS");
 const pending=CHECKS.filter(([campo])=>evidencias[campo]!==true).map(([,codigo])=>codigo);
 if(canarioAberto!==false)pending.push("CANARIO_JA_ABERTO_SEM_APROVACAO");
 const dangers=[...new Set(sinaisParada)].sort();
 if(dangers.length)pending.push("INCIDENTES_CANARIO_EXIGEM_PAUSA_E_INVESTIGACAO");
 const impedimentos=[...new Set(pending)].sort();
 return Object.freeze({
  fase:"M5_3_ROLLBACK_PROJETADO_CI",
  organizacaoId,empresaIds:[...empresaIds].sort(),
  commitCandidato,commitAnterior,
  impedimentos,sinaisParada:dangers,
  checklistCompletoDeclarado:impedimentos.length===0,
  evidenciaExternaVerificada:false,
  recomendacao:dangers.length?"PARAR_E_INVESTIGAR":
   impedimentos.length?"BLOQUEAR_PUBLICACAO":"SUBMETER_APROVACAO_HUMANA",
  operacaoRollbackExecutada:false,
  restauracaoRealExecutada:false,
  alterarFlag:false,
  executarDeploy:false,
  executarRollback:false,
  executarMigration:false,
  autorizarProducao:false,
  emitirFiscal:false,
  alterarCaixaOuEstoque:false,
  fingerprint:createHash("sha256").update(JSON.stringify({
   organizacaoId,empresaIds:[...empresaIds].sort(),commitCandidato,
   commitAnterior,impedimentos,sinaisParada:dangers
  })).digest("hex")
 });
}
