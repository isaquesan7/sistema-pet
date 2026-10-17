/**
 * PointVet M.5.30 — sandbox-only wrapper for approval DRAFT evaluation.
 * M.5.29 enforces CI DB and finance/tenant/opt-in authorization; no writes.
 */
import {consultarPlanoCustodiaDevolucoesSomenteSandbox}
 from "./pdv-unificado-custodia-devolucoes-sandbox.service.js";
import {avaliarMinutaCustodiaM530}
 from "./pdv-unificado-minuta-custodia.contract.js";

export async function avaliarMinutaCustodiaSomenteSandbox(args={}){
 if(!args||typeof args!=="object"||Array.isArray(args)||
    Object.keys(args).length!==2||!Object.hasOwn(args,"contexto")||
    !Object.hasOwn(args,"minuta"))
  throw Error("M530_ENTRADA_NAO_MINIMIZADA");
 // No endpoint, no upload parser, no storage, no tax/bank integration.
 const plano=await consultarPlanoCustodiaDevolucoesSomenteSandbox(args.contexto);
 return avaliarMinutaCustodiaM530({plano,minuta:args.minuta});
}
