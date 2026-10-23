/** Regras compartilhadas de quantidade do PDV.
 * Serviço: somente unidades inteiras >= 1. Produto a granel conserva frações.
 * A API deve validar novamente: estas verificações são proteção de interface.
 */
export function isValidPdvQuantity(tipo, quantidade) {
 const number = Number(quantidade);
 return Number.isFinite(number) && number >= (tipo === "SERVICO" ? 1 : 0.001)
  && (tipo !== "SERVICO" || Number.isSafeInteger(number));
}
export function normalizePdvQuantity(tipo, quantidade, previous=1) {
 const value = Number(quantidade);
 if (tipo === "SERVICO") return Number.isSafeInteger(value) && value >= 1 ? value : previous;
 return Number.isFinite(value) && value >= 0.001 ? Math.round(value*1000)/1000 : previous;
}
export function stepPdvQuantity(tipo, quantidade, difference) {
 const start = normalizePdvQuantity(tipo, quantidade, 1);
 return normalizePdvQuantity(tipo,Math.max(tipo === "SERVICO" ? 1 : 0.001,start+difference),start);
}
