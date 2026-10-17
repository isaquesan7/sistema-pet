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
