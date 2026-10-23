/**
 * PointVet M.5.4 — triagem declarativa de evidências de homologação.
 * PURE: não consulta URLs, bancos, Railway, backups ou dados de clientes.
 * Evidências declaradas jamais autorizam deploy, restore ou canário.
 */
import {createHash} from "node:crypto";
const SHA=/^[a-f0-9]{40}$/;
const simple=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const SENSITIVE=/(password|senha|token|secret|authorization|private.?key|database.?url|connection.?string|dsn|cookie|credential|access.?key)/i;
const required=[
  "infraSegregada","tlsApi","tlsAdmin","tlsPortal","dnsDedicado",
  "emailSink","webhooksDesativados","dadosSinteticos","smokeHttpReadOnly",
  "authTenantIsolado","observabilidadeAlertas","backupRealAutorizado",
  "restoreRealEmStaging","rtoRpoMedidos","migrationsRevisadas",
  "rollbackReleaseStaging","rollbackFlagsStaging","revisaoLgpd",
  "aprovacaoHumanaIndependente"
];
function noSecrets(value,depth=0){
 if(depth>6)throw Error("M54_EVIDENCIA_EXCESSIVA");
 if(Array.isArray(value)){if(value.length>100)throw Error("M54_EVIDENCIA_EXCESSIVA");value.forEach(v=>noSecrets(v,depth+1));return}
 if(simple(value)){for(const [key,v] of Object.entries(value)){
  if(SENSITIVE.test(key))throw Error("M54_CREDENCIAIS_PROIBIDAS");
  noSecrets(v,depth+1);
 }}
 if(typeof value==="string"&&(/:\/\/[^/@\s]+:[^/@\s]+@/.test(value)||/-----BEGIN .*PRIVATE KEY-----/.test(value)))
  throw Error("M54_CREDENCIAIS_PROIBIDAS");
}
export function avaliarEvidenciasStagingM54(input){
 if(!simple(input))throw Error("M54_ENTRADA_INVALIDA");
 noSecrets(input);
 const problemas=[];
 if(input.fase!=="M5_4_HOMOLOGACAO_REAL")problemas.push("FASE_INVALIDA");
 if(!SHA.test(input.commitSha||""))problemas.push("SHA_CANDIDATO_INVALIDO");
 if(!SHA.test(input.shaAnterior||"")||input.shaAnterior===input.commitSha)problemas.push("SHA_ANTERIOR_INVALIDO");
 if(!simple(input.evidencias))problemas.push("EVIDENCIAS_AUSENTES");
 for(const key of required){
  const e=input.evidencias?.[key];
  if(!simple(e)||e.status!=="VERIFICADO"||typeof e.referencia!=="string"||
    !/^[A-Za-z0-9][A-Za-z0-9_./:#-]{7,199}$/.test(e.referencia)||
    typeof e.revisor!=="string"||!/^[A-Za-z0-9_.-]{3,80}$/.test(e.revisor))
   problemas.push("EVIDENCIA_PENDENTE_"+key);
 }
 // Mesmo evidência completa pode ser apenas autodeclaração: revisão externa obrigatória.
 const bloqueios=[...new Set(problemas)].sort();
 const fingerprint=createHash("sha256").update(JSON.stringify({
  fase:input.fase,commitSha:input.commitSha,shaAnterior:input.shaAnterior,
  evidencias:required.map(k=>[k,input.evidencias?.[k]?.status||null,input.evidencias?.[k]?.referencia||null])
 })).digest("hex");
 return Object.freeze({
  fase:"M5_4_HOMOLOGACAO_REAL",fingerprint,checklistDeclaradoCompleto:bloqueios.length===0,
  bloqueios:Object.freeze(bloqueios),evidenciasConferidasExternamente:false,
  ambienteStagingValidado:false,backupRealRestauradoConfirmado:false,
  autorizarProducao:false,executarDeploy:false,executarRestore:false,
  executarMigration:false,executarRollback:false,habilitarCanario:false,
  proximaAcao:bloqueios.length?"REUNIR_EVIDENCIAS":"REVISAO_EXTERNA_E_AUTORIZACAO_EXPRESSA"
 });
}
