/**
 * PointVet M.4D.1 — pure simulated fiscal state contract.
 * NO live SEFAZ/prefeitura provider, XML, tax calculation or official outcome.
 * An uncertain response requires explicit investigation; never auto-resend.
 */
export const ESTADOS_FISCAIS_CI=Object.freeze({
 PREPARADA:"PREPARADA_CI",
 INDETERMINADA:"INDETERMINADA_CI",
 REJEITADA:"REJEITADA_CI",
 ACEITA_SIMULADA:"ACEITA_SIMULADA_CI",
 CANCELADA_SIMULADA:"CANCELADA_SIMULADA_CI",
 CONTINGENCIA:"CONTINGENCIA_REVISAO_CI"
});
const transitions=Object.freeze({
 PREPARADA_CI:Object.freeze({
  SIMULAR_RESPOSTA_ACEITA:"ACEITA_SIMULADA_CI",
  SIMULAR_RESPOSTA_REJEITADA:"REJEITADA_CI",
  SIMULAR_RESPOSTA_INDETERMINADA:"INDETERMINADA_CI",
  SUSPENDER_POR_CONTINGENCIA:"CONTINGENCIA_REVISAO_CI"
 }),
 INDETERMINADA_CI:Object.freeze({
  SIMULAR_CONSULTA_ACEITA:"ACEITA_SIMULADA_CI",
  SIMULAR_CONSULTA_REJEITADA:"REJEITADA_CI",
  SUSPENDER_POR_CONTINGENCIA:"CONTINGENCIA_REVISAO_CI"
 }),
 ACEITA_SIMULADA_CI:Object.freeze({
  SIMULAR_CANCELAMENTO:"CANCELADA_SIMULADA_CI"
 })
});
const fail=message=>{throw Error(message);};
export function proximoEstadoFiscalCi({estado,tipo,motivo}){
 if(typeof estado!=="string"||typeof tipo!=="string")fail("M4D_EVENTO_INVALIDO");
 const next=transitions[estado]?.[tipo];
 if(!next)fail("M4D_TRANSICAO_NAO_PERMITIDA");
 if(typeof motivo!=="string"||motivo.trim().length<12||
    motivo.trim().length>500)fail("M4D_MOTIVO_AUDITAVEL_OBRIGATORIO");
 return {
  estadoAnterior:estado,estadoPosterior:next,
  tipo,motivo:motivo.trim(),
  exigeConsultaManual:next==="INDETERMINADA_CI"||
   next==="CONTINGENCIA_REVISAO_CI",
  permitiuReenvioAutomatico:false,
  transmitiuDocumento:false,
  recebeuProtocoloReal:false,
  autorizadoOficialmente:false,
  canceladoOficialmente:false
 };
}
export function validarPlanoFiscalCi(plan,{classe,tipoDocumento}){
 if(!plan||!["PRODUTO","SERVICO"].includes(classe)||
    !["NFE","NFCE","NFSE"].includes(tipoDocumento)||
    (classe==="PRODUTO"&&!["NFE","NFCE"].includes(tipoDocumento))||
    (classe==="SERVICO"&&tipoDocumento!=="NFSE"))
  fail("M4D_TIPO_FISCAL_INCOMPATIVEL");
 const group=plan.grupos?.find(x=>x.classe===classe);
 if(!group||group.tipoDocumentoEscolhido!==tipoDocumento||
    plan.emissor?.empresaId!==group.emissor?.empresaId)
  fail("M4D_GRUPO_OU_EMISSOR_INCONSISTENTE");
 if(plan.emissor?.ambiente!=="HOMOLOGACAO")
  fail("M4D_PRODUCAO_FISCAL_BLOQUEADA");
 if(!group.serieProposta||group.pendencias.length||
    !group.itens?.length)
  fail("M4D_PENDENCIAS_FISCAIS_BLOQUEIAM_PREPARACAO");
 if(plan.emissaoHabilitada!==false||plan.gerouDocumento!==false||
    plan.autorizou!==false)fail("M4D_PLANO_NAO_SEGURO");
 return {classe,tipoDocumento,
  vendaId:plan.vendaId,organizacaoId:plan.organizacaoId,
  empresaId:plan.emissor.empresaId,
  fingerprint:plan.fingerprint,total:group.total,
  ambiente:"HOMOLOGACAO",podeTransmitir:false,
  exigeHomologacaoExterna:true};
}
