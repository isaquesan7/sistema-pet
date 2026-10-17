/**
 * M.5.4.1 — revisão offline de manifesto de evidências de staging.
 * Apenas metadados sanitizados. Nenhuma conexão externa, nenhuma autorização
 * automática de deploy, backup, migração, rollback ou canário.
 */
import {createHash} from "node:crypto";
import {avaliarEvidenciasStagingM54} from "./pointvet-m54-evidencias.contract.js";
const SHA=/^[a-f0-9]{40}$/;
const SAFE=/^[A-Za-z0-9][A-Za-z0-9_./:#-]{7,199}$/;
const ID=/^[A-Za-z0-9_.-]{3,80}$/;
const KEY=/^[a-zA-Z][a-zA-Z0-9]{2,80}$/;
const isObj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const requiredKinds=Object.freeze({
 infraSegregada:"INFRA",tlsApi:"TLS",tlsAdmin:"TLS",tlsPortal:"TLS",
 dnsDedicado:"DNS",emailSink:"EMAIL",webhooksDesativados:"WEBHOOK",
 dadosSinteticos:"DADOS",smokeHttpReadOnly:"HTTP",
 authTenantIsolado:"SEGURANCA",observabilidadeAlertas:"OBSERVABILIDADE",
 backupRealAutorizado:"BACKUP",restoreRealEmStaging:"RESTORE",
 rtoRpoMedidos:"RECUPERACAO",migrationsRevisadas:"MIGRACAO",
 rollbackReleaseStaging:"ROLLBACK",rollbackFlagsStaging:"ROLLBACK",
 revisaoLgpd:"LGPD",aprovacaoHumanaIndependente:"APROVACAO"
});
const freeze=o=>Object.freeze(o);
export function revisarManifestoStagingM541(input){
 const base=avaliarEvidenciasStagingM54(input);
 const pending=[...base.bloqueios];
 if(!isObj(input.proveniencia))pending.push("PROVENIENCIA_AUSENTE");
 const keys=Object.keys(requiredKinds);
 // Unknown evidence keys are not silently accepted as a sign-off.
 if(isObj(input.evidencias)){
  for(const key of Object.keys(input.evidencias))
   if(!Object.hasOwn(requiredKinds,key))pending.push("EVIDENCIA_DESCONHECIDA");
 }
 for(const key of keys){
  const p=input.proveniencia?.[key];
  if(!isObj(p)||p.tipo!==requiredKinds[key]||!SAFE.test(p.referencia||"")||
     !ID.test(p.coletor||"")||!ID.test(p.revisor||"")||
     p.coletor===p.revisor||!SHA.test(p.commitSha||"")||
     p.commitSha!==input.commitSha||
     !/^[a-f0-9]{64}$/.test(p.sha256||"")||
     p.referencia!==input.evidencias?.[key]?.referencia||
     p.revisor!==input.evidencias?.[key]?.revisor)
   pending.push("PROVENIENCIA_INVALIDA_"+key);
 }
 if(isObj(input.proveniencia)){
  for(const key of Object.keys(input.proveniencia)){
   if(!Object.hasOwn(requiredKinds,key)||!KEY.test(key))
    pending.push("PROVENIENCIA_DESCONHECIDA");
  }
 }
 // Purposely do not return untrusted descriptions/identifiers and never infer
 // that externally supplied hashes constitute independently checked evidence.
 const bloqueios=freeze([...new Set(pending)].sort());
 const resumo=freeze({
  fase:"M5_4_1_AUDITORIA_OFFLINE",commitSha:input.commitSha||null,
  checklistDeclaradoCompleto:base.checklistDeclaradoCompleto,
  metadadosConsistentes:bloqueios.length===0,bloqueios,
  resumoSha256:createHash("sha256").update(JSON.stringify({
   base:base.fingerprint,bloqueios,
   evidencias:keys.map(k=>[k,input.proveniencia?.[k]?.tipo||null,
    input.proveniencia?.[k]?.sha256||null])
  })).digest("hex"),
  evidenciasVerificadasExternamente:false,stagingValidado:false,
  autorizacaoProducao:false,executarDeploy:false,executarRestore:false,
  executarMigration:false,executarRollback:false,habilitarCanario:false
 });
 return resumo;
}
