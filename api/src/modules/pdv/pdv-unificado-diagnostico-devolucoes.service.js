/**
 * PointVet M.5.24 — READ-ONLY evidence/fiscal gap diagnostic from already
 * authorized M.5.16/M.5.23 snapshots. Independent snapshots are compared and
 * mismatches return 409; no output may authorize settlement/refund.
 */
import {consultarEtapasRepassesM516}
 from "./pdv-unificado-fluxo-operacional.service.js";
import {consultarHistoricoDevolucoesM523}
 from "./pdv-unificado-devolucoes-historico.service.js";
import {diagnosticarDivergenciasDevolucoesM524}
 from "./pdv-unificado-diagnostico-devolucoes.contract.js";
export async function consultarDiagnosticoDevolucoesM524({
 organizacaoId,empresaId,usuarioId,comandaId
}={}){
 // Both calls enforce M.5.7: tenant, active staff, FINANCEIRO, PDV, opt-in.
 // Sequential to avoid overloading the connection pool in CI/production.
 const fluxo=await consultarEtapasRepassesM516({
  organizacaoId,empresaId,usuarioId,comandaId
 });
 const historico=await consultarHistoricoDevolucoesM523({
  organizacaoId,empresaId,usuarioId,comandaId
 });
 return diagnosticarDivergenciasDevolucoesM524({
  organizacaoId,empresaId,comandaId,fluxo,historico
 });
}
