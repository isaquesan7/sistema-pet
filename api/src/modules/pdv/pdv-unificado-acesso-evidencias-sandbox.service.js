/** PointVet M.5.32 — never authenticates a person or issues access tokens. */
import {consultarFronteiraEvidenciasSomenteSandbox}
 from "./pdv-unificado-fronteira-evidencias-sandbox.service.js";
import {simularAcessoEvidenciaM532}
 from "./pdv-unificado-acesso-evidencias.contract.js";

export async function consultarDecisaoAcessoEvidenciaSomenteSandbox(args={}){
 if(!args||typeof args!=="object"||Array.isArray(args)||
    Object.keys(args).length!==4||
    !["contexto","minuta","proposta","solicitacao"].every(k=>Object.hasOwn(args,k)))
  throw Error("M532_ENTRADA_NAO_MINIMIZADA");
 // M.5.31 -> M.5.30 -> M.5.29 restrict to disposable test PostgreSQL,
 // tenant/CNPJ/comanda authorizations, dossier SHA and audit integrity.
 const fronteira=await consultarFronteiraEvidenciasSomenteSandbox({
  contexto:args.contexto,minuta:args.minuta,proposta:args.proposta
 });
 return simularAcessoEvidenciaM532({fronteira,solicitacao:args.solicitacao});
}
