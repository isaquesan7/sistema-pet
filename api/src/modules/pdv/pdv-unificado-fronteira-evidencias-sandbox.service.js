/** PointVet M.5.31 — preview ONLY, with M.5.30/29 sandbox authorization. */
import {avaliarMinutaCustodiaSomenteSandbox}
 from "./pdv-unificado-minuta-custodia-sandbox.service.js";
import {planejarFronteiraEvidenciasM531}
 from "./pdv-unificado-fronteira-evidencias.contract.js";

export async function consultarFronteiraEvidenciasSomenteSandbox(args={}){
 if(!args||typeof args!=="object"||Array.isArray(args)||
    Object.keys(args).length!==3||
    !["contexto","minuta","proposta"].every(k=>Object.hasOwn(args,k)))
  throw Error("M531_ENTRADA_NAO_MINIMIZADA");
 // The M.5.30 -> M.5.29 chain checks NODE_ENV, sandbox flag, disposable
 // DB name/URL, tenant/CNPJ permissions and dossier/reviewer audit integrity.
 const minuta=await avaliarMinutaCustodiaSomenteSandbox({
  contexto:args.contexto,minuta:args.minuta
 });
 return planejarFronteiraEvidenciasM531({minuta,proposta:args.proposta});
}
