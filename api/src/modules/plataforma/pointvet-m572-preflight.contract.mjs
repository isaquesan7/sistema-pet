/** PointVet M.5.72 — contrato de auditoria PREVIA comercial, somente leitura.
 * A informacao de projeto/servico e declarada pelo operador; nunca equivale a
 * prova de identidade do banco nem concede permissao de migrar/publicar.
 */
import {parseDbConnection} from "./pointvet-m571-dr-guard.contract.mjs";

export const POINTVET_PROD_PROJECT_ID="aab52927-a8c1-4158-80bf-bd22af504e72";
export const POINTVET_PROD_SERVICE_ID="4b4bf25e-83d1-4e4e-80a7-198bdbf03d99";
export const POINTVET_PROD_LOCAL_PORT=55434;
const deny=msg=>{throw Error("POINTVET_M572_AUDIT_BLOCKED: "+msg);};

export function planProductionReadOnlyAudit({url,projectId,serviceId}={}){
 if(projectId!==POINTVET_PROD_PROJECT_ID||serviceId!==POINTVET_PROD_SERVICE_ID)
  deny("identificadores declarados nao correspondem ao PostgreSQL comercial");
 const db=parseDbConnection(url);
 if(!["127.0.0.1","localhost"].includes(db.hostname)||db.port!==POINTVET_PROD_LOCAL_PORT)
  deny("exige tunel privado exclusivo da producao na porta 55434");
 return {db,readOnlyRequired:true,identityVerified:false,deployAuthorized:false};
}
const isCount=n=>Number.isSafeInteger(n)&&n>=0;
export function assessProductionReadOnlyAudit(r){
 if(!r||typeof r!=="object"||Array.isArray(r))deny("resposta SQL ausente");
 const fields=["totalComandas","orphanComandas","crossTenantItems","crossTenantSales",
  "crossTenantClinical","crossTenantBath","multiCompanyComandas","openComandasWithoutCompanyReference",
  "unfinishedMigrations","completedMigrations"];
 if(fields.some(k=>!isCount(r[k]))||
    typeof r.readOnly!=="boolean"||
    typeof r.alreadyHasComandaOrganizacao!=="boolean"||
    typeof r.alreadyHasComandaEmpresaOrigem!=="boolean")
  deny("resultado SQL inesperado");
 const blockers=[];
 if(!r.readOnly)blockers.push("origem nao confirmou modo somente leitura");
 if(r.orphanComandas>0)blockers.push("comandas sem tutor/organizacao derivavel: migracao abortaria");
 for(const k of ["crossTenantItems","crossTenantSales","crossTenantClinical","crossTenantBath"])
  if(r[k]>0)blockers.push(k+": vinculo cruzado de organizacao/CNPJ");
 if(r.multiCompanyComandas>0)blockers.push("comandas legadas com mais de um CNPJ: inferencia automatica exige revisao");
 if(r.openComandasWithoutCompanyReference>0)blockers.push("comandas abertas sem CNPJ derivavel: validar visibilidade antes da migracao");
 if(r.unfinishedMigrations>0)blockers.push("migrations Prisma interrompidas");
 if(r.alreadyHasComandaOrganizacao||r.alreadyHasComandaEmpresaOrigem)
  blockers.push("schema de comandas ja alterado; requer conciliacao com migration history");
 return {gate:blockers.length?"POINTVET_M572_PROD_PREFLIGHT_BLOCKED":
  "POINTVET_M572_PROD_PREFLIGHT_DATA_CONSISTENT",
  auditedReadOnly:true,
  commercialDeploymentAuthorized:false,
  projectIdentityIndependentlyVerified:false,
  counts:Object.fromEntries(fields.map(k=>[k,r[k]])),
  blockers};
}

/** Classificacao de falhas psql sem ecoar stderr, SQL, URL ou credenciais.
 * O SQLSTATE e um codigo estatico de 5 caracteres emitido pelo Postgres.
 * Nunca atribui sucesso ou autorizacao de publicar.
 */
export function summarizePsqlAuditFailure({errorCode,status,signal,stderr}={}){
 const raw=typeof stderr==="string"?stderr.slice(0,32768):"";
 if(errorCode==="ENOENT")return "PSQL_NAO_ENCONTRADO";
 if(errorCode==="ETIMEDOUT"||signal==="SIGTERM")return "TIMEOUT_LOCAL";
 const state=raw.match(/(?:ERROR|FATAL|PANIC):\s*([A-Z0-9]{5}):/i)?.[1]?.toUpperCase();
 const states={
  "42P01":"TABELA_AUSENTE","42703":"COLUNA_AUSENTE",
  "42883":"FUNCAO_OU_TIPO_INCOMPATIVEL","42601":"SINTAXE_SQL",
  "42501":"PERMISSAO_SQL","28P01":"AUTENTICACAO","28000":"AUTENTICACAO",
  "3D000":"BANCO_AUSENTE","57014":"TIMEOUT_SQL",
  "25006":"OPERACAO_ESCRITA_BLOQUEADA"
 };
 if(state)return "SQLSTATE_"+state+"_"+(states[state]||"ERRO_POSTGRES");
 if(/password authentication failed|fe_sendauth|authentication failed/i.test(raw))
  return "AUTENTICACAO";
 if(/connection refused|could not connect|connection to server.*failed|no route to host|connection timed out|server closed the connection/i.test(raw))
  return "TUNEL_OU_REDE";
 if(/ssl|tls|certificate/i.test(raw))return "TLS_CONEXAO";
 if(/relation .* does not exist|undefined table/i.test(raw))return "TABELA_AUSENTE";
 if(/column .* does not exist|undefined column/i.test(raw))return "COLUNA_AUSENTE";
 if(/permission denied/i.test(raw))return "PERMISSAO_SQL";
 if(errorCode)return "PROCESSO_PSQL_FALHOU";
 if(Number.isInteger(status)&&status!==0)return "PSQL_STATUS_NAO_ZERO";
 return "FALHA_DESCONHECIDA";
}
