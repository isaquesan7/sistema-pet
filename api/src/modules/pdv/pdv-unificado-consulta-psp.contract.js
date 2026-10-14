/**
 * PointVet PDV Unificado 20.2.4B.2B.2B — contrato neutro de consulta de status PSP.
 *
 * Pure function: does not use network, DB, secrets, cash, inventory, fiscal or
 * payment APIs. A matched response is ONLY a correlated technical observation.
 * Real provider authenticity, webhook verification and settlement are unimplemented.
 */
export const STATUS_CONSULTA_PSP=Object.freeze([
 "NAO_ENCONTRADA","PENDENTE","AUTORIZADA","CAPTURADA",
 "LIQUIDADA","RECUSADA","CANCELADA","ESTORNADA","DESCONHECIDA"
]);

const cnpj=/^[0-9]{14}$/;
const nome=/^[a-zA-Z0-9:_-]{1,120}$/;
function fail(codigo){throw Error(codigo)}
function requiredId(value){return typeof value==="string"&&nome.test(value)}
function money(value){return Number.isSafeInteger(value)&&value>0}
function validateRequest(r){
 if(!r||typeof r!=="object"||Array.isArray(r)||
    !requiredId(r.provedor)||!requiredId(r.empresaId)||
    !cnpj.test(r.cnpj??"")||!requiredId(r.recebedorRef)||
    !requiredId(r.chaveIdempotencia)||!money(r.valorCentavos)||
    r.moeda!=="BRL")fail("PSP_CONSULTA_REQUISICAO_INVALIDA");
}
/**
 * Fail-closed correlator. Never infers safe retry from "not found" because a
 * provider's eventual consistency can hide a charge that succeeded remotely.
 * All statuses, including LIQUIDADA, remain unauthenticated until a real PSP
 * adapter has provider-specific signature/transport and external reconciliation.
 */
export function correlacionarConsultaPsp({esperado,resposta}){
 validateRequest(esperado);
 if(!resposta||typeof resposta!=="object"||Array.isArray(resposta)||
    !requiredId(resposta.provedor)||!requiredId(resposta.empresaId)||
    !cnpj.test(resposta.cnpj??"")||!requiredId(resposta.recebedorRef)||
    !requiredId(resposta.chaveIdempotencia)||!money(resposta.valorCentavos)||
    resposta.moeda!=="BRL"||!STATUS_CONSULTA_PSP.includes(resposta.status)||
    !requiredId(resposta.referenciaTransacao))
   fail("PSP_CONSULTA_RESPOSTA_INVALIDA");
 if(resposta.provedor!==esperado.provedor)fail("PSP_PROVEDOR_DIVERGENTE");
 if(resposta.empresaId!==esperado.empresaId||
    resposta.cnpj!==esperado.cnpj||
    resposta.recebedorRef!==esperado.recebedorRef)
   fail("PSP_RECEBEDOR_DIVERGENTE");
 if(resposta.chaveIdempotencia!==esperado.chaveIdempotencia)
   fail("PSP_CHAVE_DIVERGENTE");
 if(resposta.valorCentavos!==esperado.valorCentavos||
    resposta.moeda!==esperado.moeda)fail("PSP_VALOR_DIVERGENTE");
 return {
  statusObservado:resposta.status,referenciaTransacao:resposta.referenciaTransacao,
  correspondencia:true,resultadoVerificadoPorPsp:false,
  liquidacaoConfirmada:false,podeReenviar:false,podeFinalizarVenda:false,
  proximaAcao:"AGUARDAR_CONCILIACAO_PSP_OFICIAL",
  observacao:"Resposta correlacionada, mas sem autenticação e prova de liquidação do PSP escolhido."
 };
}
/** Define explicit hard blockers for a real PSP integration. */
export function validarCapacidadesPsp({provedor,consultaIdempotente,assinaturaVerificavel,
 recebedoresSeparados,estornoPorRecebedor,consultaAntesDeRetry}={}){
 if(!requiredId(provedor))throw Error("PSP_PROVEDOR_NAO_DEFINIDO");
 const faltantes=[];
 for(const [key,value] of Object.entries({
  consultaIdempotente,assinaturaVerificavel,recebedoresSeparados,
  estornoPorRecebedor,consultaAntesDeRetry
 }))if(value!==true)faltantes.push(key);
 return {provedor,prontoParaHomologacaoFinanceira:false,
  contratoParaTesteCompleto:faltantes.length===0,
  faltantes,checkoutHabilitado:false};
}
