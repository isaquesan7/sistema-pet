/**
 * PointVet M.5.4.4 — explicitly invoked HTTPS-only staging probe.
 * Read only. Example:
 * POINTVET_STAGE_COMMIT_SHA=<40 hex> POINTVET_STAGE_API=https://api.staging-domain...
 * POINTVET_STAGE_ADMIN=https://admin.staging-domain...
 * POINTVET_STAGE_PORTAL=https://portal.staging-domain...
 * POINTVET_STAGING_SMOKE_CONFIRM=STAGING_READONLY_APPROVED
 * node scripts/pointvet-staging-readonly-smoke.mjs --run-readonly
 *
 * NEVER run automatically in CI, staging deploy hooks or production.
 */
import {executarSmokeStagingM544} from "../src/modules/plataforma/pointvet-m544-staging-smoke.contract.js";
if(process.argv.length!==3||process.argv[2]!=="--run-readonly")
 throw Error("M544_EXECUCAO_MANUAL_OBRIGATORIA");
const result=await executarSmokeStagingM544({
 commitSha:process.env.POINTVET_STAGE_COMMIT_SHA,
 api:process.env.POINTVET_STAGE_API,
 admin:process.env.POINTVET_STAGE_ADMIN,
 portal:process.env.POINTVET_STAGE_PORTAL
},{confirmacao:process.env.POINTVET_STAGING_SMOKE_CONFIRM});
console.log(JSON.stringify(result,null,2));
