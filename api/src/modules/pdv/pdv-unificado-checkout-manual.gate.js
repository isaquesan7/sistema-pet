/** A preferência de UI nunca basta para ligar o checkout de gestão. */
export function empresaManualAutorizada(empresaId){
 return Boolean(empresaId&&String(process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS||"")
  .split(",").some(id=>id.trim()===empresaId));
}
export function checkoutManualHabilitado(organizacao,empresaId){
 const permitidas=new Set(String(process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS||"")
  .split(",").map(id=>id.trim()).filter(Boolean));
 return process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED==="1"&&
  Boolean(organizacao?.configuracao?.pdvUnificadoHabilitado)&&
  Boolean(organizacao?.id&&permitidas.has(organizacao.id))&&
  empresaManualAutorizada(empresaId);
}

/** M.5.56 — autorização independente e fechada por padrão para ESTORNAR
 * vendas já registradas quando o kill switch de novas vendas está OFF.
 * As allowlists de contingência são próprias: habilitar estorno NUNCA
 * habilita checkout nem aproveita CNPJs de um piloto anterior.
 */
export function empresaEstornoContingenciaAutorizada(empresaId){
 return Boolean(empresaId&&String(process.env.POINTVET_UNIFIED_MANUAL_REVERSAL_COMPANY_IDS||"")
  .split(",").some(id=>id.trim()===empresaId));
}
export function estornoContingenciaHabilitado(organizacao,empresaId){
 const permitidas=new Set(String(process.env.POINTVET_UNIFIED_MANUAL_REVERSAL_ORG_IDS||"")
  .split(",").map(id=>id.trim()).filter(Boolean));
 return process.env.POINTVET_UNIFIED_MANUAL_REVERSAL_ENABLED==="1"&&
  Boolean(organizacao?.configuracao?.pdvUnificadoHabilitado)&&
  Boolean(organizacao?.id&&permitidas.has(organizacao.id))&&
  empresaEstornoContingenciaAutorizada(empresaId);
}
export function estornoManualHabilitado(organizacao,empresaId){
 return checkoutManualHabilitado(organizacao,empresaId)||
  estornoContingenciaHabilitado(organizacao,empresaId);
}
