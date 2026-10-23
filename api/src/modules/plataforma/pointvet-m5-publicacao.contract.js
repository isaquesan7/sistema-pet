/**
 * PointVet M.5.1 — PURE PRE-RELEASE REVIEW CHECKLIST, never deployment.
 * Input is UNSIGNED SELF-ATTESTATION, not external proof. Does not query
 * Railway, Hostinger, GitHub Actions, PostgreSQL or fiscal authorities.
 * CI green or a disposable backup drill MUST NOT greenlight production.
 */
const CHECKS=Object.freeze([
 ["ciCommitValidado","CI_APROVADO_PARA_COMMIT_EXATO"],
 ["stagingSeparadoDeProducao","STAGING_TOTALMENTE_SEPARADO"],
 ["backupRealVerificadoEmStaging","RESTORE_BACKUP_REAL_EM_STAGING"],
 ["checksumBackupConferido","CHECKSUM_BACKUP_REAL"],
 ["migracoesPrismaVerificadasStaging","MIGRACOES_STAGING"],
 ["rollbackDeployEnsaiado","ROLLBACK_DEPLOY_STAGING"],
 ["rollbackDeDadosAvaliados","ESTRATEGIA_ROLLBACK_DADOS"],
 ["smokeApiPdvPortalAprovado","SMOKE_API_PDV_PORTAL"],
 ["tlsDominioValido","CERTIFICADO_HTTPS_DOMINIO"],
 ["backupsContinuosConfirmados","BACKUPS_CONTINUOS"],
 ["alertasEmailBackupTestados","ALERTAS_BACKUP_EMAIL"],
 ["metricasEAlertasTestados","OBSERVABILIDADE_E_ALERTAS"],
 ["matrizFiscalRevisada","CONFORMIDADE_FISCAL_CNPJ_UF_MUNICIPIO"],
 ["contasEPermissoesAuditadas","ACESSOS_TENANT_E_EMPRESA"],
 ["aceiteExplicitoDaOrganizacao","ACEITE_TENANT_CANARIO"],
 ["responsavelRollbackDesignado","RESPONSAVEL_PELA_REVERSAO"],
 ["janelaCanarioAprovada","JANELA_CANARIO"]
]);
const fail=msg=>{throw Error(msg);};
const isId=x=>typeof x==="string"&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,119}$/.test(x);
/**
 * No real approvals are granted by this pure contract.
 * It can ONLY declare whether a review packet is complete.
 */
export function avaliarProntidaoM5({
 organizacaoId,empresaIds,commitSha,ambiente,evidencias={},risco={}
}={}){
 if(!isId(organizacaoId)||!Array.isArray(empresaIds)||
    empresaIds.length===0||empresaIds.length>25||
    empresaIds.some(x=>!isId(x))||
    new Set(empresaIds).size!==empresaIds.length)
  fail("M5_IDENTIDADE_ORGANIZACAO_EMPRESAS_INVALIDA");
 const motivos=[];
 if(!/^[a-f0-9]{40}$/.test(commitSha||""))motivos.push("COMMIT_SHA_EXATO_OBRIGATORIO");
 if(ambiente!=="STAGING")motivos.push("STAGING_NAO_VERIFICADO");
 if(!evidencias||typeof evidencias!=="object"||Array.isArray(evidencias))
  fail("M5_EVIDENCIAS_INVALIDAS");
 for(const [field,code] of CHECKS)if(evidencias[field]!==true)motivos.push(code);
 if(risco.gatewayOuMaquininhaAtiva===true)motivos.push("GATEWAY_TEf_INDEVIDAMENTE_ATIVO");
 if(risco.creditoClienteNoCheckout===true)motivos.push("CREDITO_CLIENTE_ATIVO");
 if(risco.emissaoFiscalNaoHomologada===true)motivos.push("EMISSAO_FISCAL_NAO_HOMOLOGADA");
 if(risco.unidadesExtrasComCaixaEstoqueAtivos===true)
  motivos.push("MULTIUNIDADE_NAO_HOMOLOGADA");
 const pendencias=[...new Set(motivos)].sort();
 return {
  fase:"M5_REVISAO_PREPUBLICACAO",
  organizacaoId,empresaIds:[...empresaIds].sort(),commitSha:commitSha||null,
  ambienteRequerido:"STAGING",pendencias,
  checklistCompletoDeclarado:pendencias.length===0,
  evidenciaExternaAutenticada:false,
  requerConferenciaHumanaDosRelatorios:true,
  publicacaoAutorizada:false,
  executarDeploy:false,
  executarMigrationsProducao:false,
  habilitarPdvUnificadoProducao:false,
  habilitarCreditoCliente:false,
  integrarMaquininha:false,
  emitirNotaFiscalReal:false
 };
}
export const CAMPOS_CHECKLIST_M5=CHECKS.map(([field,code])=>({campo:field,codigo:code}));
