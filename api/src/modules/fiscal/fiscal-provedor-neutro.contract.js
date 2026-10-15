/**
 * PointVet M.5.26 — pure, provider-neutral fiscal handoff contract.
 * It projects an M.4C.2 child-sale fiscal preview to an internal versioned
 * envelope. NO adapter, SDK, XML, numbering, signing, transmission or taxes.
 * Never call this with an untrusted plan: source authorization stays in M.4C.2.
 */
import {createHash} from "node:crypto";
import {fiscalCents} from "./fiscal-unificado-planejamento.contract.js";

const fail=code=>{throw Error("M526_"+code);};
const sha=/^[a-f0-9]{64}$/;
const valid=x=>typeof x==="string"&&x.trim().length>0;
const fmt=c=>(c/100).toFixed(2);
const digest=data=>createHash("sha256").update(JSON.stringify(data)).digest("hex");
const tipos=Object.freeze({PRODUTO:["NFE","NFCE"],SERVICO:["NFSE"]});

/** Strict internal checksum of the M.4C.2 source, not third-party proof. */
function validarOrigem(plano){
 if(plano?.modo!=="PREPARACAO_FISCAL_NAO_EXECUTAVEL"||
    plano.versaoContrato!==1||!valid(plano.organizacaoId)||
    !valid(plano.vendaId)||!valid(plano.comandaId)||
    !valid(plano.emissor?.empresaId)||
    !/^\d{14}$/.test(String(plano.emissor?.cnpj||""))||
    plano.emissaoHabilitada!==false||plano.gerouDocumento!==false||
    plano.transmitiu!==false||plano.autorizou!==false||
    plano.precisaRevisaoFiscal!==true||
    !Array.isArray(plano.grupos)||!plano.grupos.length||
    plano.grupos.length>2||!sha.test(plano.fingerprint||""))
  fail("ORIGEM_INSEGURA");
 const origem={versaoContrato:plano.versaoContrato,vendaId:plano.vendaId,
  comandaId:plano.comandaId,organizacaoId:plano.organizacaoId,
  emissor:plano.emissor,subtotal:plano.subtotal,
  desconto:plano.desconto,acrescimo:plano.acrescimo,
  total:plano.total,grupos:plano.grupos};
 if(digest(origem)!==plano.fingerprint)fail("FINGERPRINT_ORIGEM_DIVERGENTE");
}

/**
 * Creates ONE neutral envelope per document class of ONE finished child sale.
 * Existing fiscal catalog fields are merely passed through for later review.
 * No fiscal calculation, legal classification or provider capability is inferred.
 */
export function prepararEnvelopesFiscaisNeutrosM526(plano){
 validarOrigem(plano);
 const usados=new Set(),classes=new Set();
 let total=0,subtotal=0,desconto=0,acrescimo=0;
 const envelopes=plano.grupos.map(grupo=>{
  if(!tipos[grupo?.classe]?.includes(grupo.tipoDocumentoEscolhido)||
     classes.has(grupo.classe)||grupo.documentoCriado!==false||
     grupo.emissaoHabilitada!==false||grupo.autorizacaoFiscal!==false||
     !grupo.emissor||JSON.stringify(grupo.emissor)!==JSON.stringify(plano.emissor)||
     !Array.isArray(grupo.itens)||!grupo.itens.length||grupo.itens.length>500||
     !Array.isArray(grupo.pendencias)||
     grupo.pendencias.some(x=>!valid(x)))fail("GRUPO_INCOMPATIVEL");
  classes.add(grupo.classe);
  let somaItens=0,somaDescontos=0,somaAcrescimos=0;
  const itens=grupo.itens.map(item=>{
   if(!valid(item?.id)||usados.has(item.id)||
      item.tipo!==grupo.classe||!valid(item.itemCatalogoId))
    fail("ITEM_FORA_DO_EMISSOR_OU_DUPLICADO");
   usados.add(item.id);
   let base,desc,extra,planejado;
   try{
    base=fiscalCents(item.valorBase);
    desc=fiscalCents(item.descontoGlobalAlocado);
    extra=fiscalCents(item.acrescimoGlobalAlocado);
    planejado=fiscalCents(item.valorPlanejado);
    fiscalCents(item.descontoLinha);
   }catch{fail("VALOR_ITEM_INVALIDO");}
   if(desc>base||base-desc+extra!==planejado)
    fail("RATEIO_ITEM_DIVERGENTE");
   somaItens+=planejado;somaDescontos+=desc;somaAcrescimos+=extra;
   if(![somaItens,somaDescontos,somaAcrescimos].every(Number.isSafeInteger))
    fail("SOMA_INVALIDA");
   const tax=item.fiscalConfig;
   const camposFiscais=tax?{
    ncm:tax.ncm||null,cfop:tax.cfop||null,
    origemMercadoria:tax.origemMercadoria||null,cstCsosn:tax.cstCsosn||null,
    codigoServicoMunicipal:tax.codigoServicoMunicipal||null
   }:null;
   return {itemVendaId:item.id,itemCatalogoId:item.itemCatalogoId,
    descricaoInformada:item.descricao||null,quantidadeInformada:item.quantidade,
    precoUnitarioInformado:item.precoUnitario,
    descontoLinhaInformado:item.descontoLinha,
    descontoGlobalAlocado:fmt(desc),acrescimoGlobalAlocado:fmt(extra),
    valorPlanejado:fmt(planejado),classificacaoInformada:camposFiscais};
  });
  let gt,gs,gd,ga;
  try{
   gt=fiscalCents(grupo.total);gs=fiscalCents(grupo.subtotal);
   gd=fiscalCents(grupo.descontoGlobal);ga=fiscalCents(grupo.acrescimoGlobal);
  }catch{fail("VALORES_GRUPO_INVALIDOS");}
  if(gt!==somaItens||gd!==somaDescontos||ga!==somaAcrescimos||
     gs-gd+ga!==gt)fail("TOTAL_GRUPO_DIVERGENTE");
  total+=gt;subtotal+=gs;desconto+=gd;acrescimo+=ga;
  if(![total,subtotal,desconto,acrescimo].every(Number.isSafeInteger))
   fail("TOTAL_VENDA_INVALIDO");
  const pacote={versaoContrato:"POINTVET_FISCAL_PORT_V1",
   origem:{organizacaoId:plano.organizacaoId,empresaId:plano.emissor.empresaId,
    vendaId:plano.vendaId,comandaId:plano.comandaId,
    fingerprintPrevia:plano.fingerprint},
   emissor:{cnpj:plano.emissor.cnpj,razaoSocial:plano.emissor.razaoSocial||null,
    uf:plano.emissor.uf||null,municipio:plano.emissor.municipio||null,
    codigoMunicipioIbge:plano.emissor.codigoMunicipioIbge||null,
    regimeInformado:plano.emissor.regime||null,
    entidadeFiscalId:plano.emissor.entidadeFiscalId||null,
    unidadeOperacionalId:plano.emissor.unidadeOperacionalId||null},
   documento:{classe:grupo.classe,tipoEscolhido:grupo.tipoDocumentoEscolhido,
    serieInformadaNaoReservada:grupo.serieProposta||null},
   valores:{subtotal:fmt(gs),descontoGlobal:fmt(gd),
    acrescimoGlobal:fmt(ga),total:fmt(gt)},
   itens,
   pendencias:Object.freeze([...new Set([...grupo.pendencias,
    "PROVEDOR_FISCAL_AINDA_NAO_ESCOLHIDO",
    "REVISAO_LEGAL_E_FISCAL_POR_EMISSOR_PENDENTE",
    "ADAPTADOR_FISCAL_NAO_IMPLEMENTADO"])].sort())};
  return Object.freeze({...pacote,fingerprintEnvelope:digest(pacote),
   estado:"AGUARDANDO_ESCOLHA_DE_PROVEDOR",somentePreparacao:true,
   permiteEmissao:false,permiteCancelamento:false,permiteConsultaExterna:false,
   permiteContingencia:false,transmitiu:false,assinouXml:false,
   reservouNumero:false,documentoFiscalCriado:false});
 });
 try{
  if(total!==fiscalCents(plano.total)||subtotal!==fiscalCents(plano.subtotal)||
     desconto!==fiscalCents(plano.desconto)||
     acrescimo!==fiscalCents(plano.acrescimo))fail("TOTAL_VENDA_DIVERGENTE");
 }catch(e){if(String(e.message).startsWith("M526_"))throw e;fail("TOTAL_VENDA_INVALIDO");}
 return Object.freeze({fase:"M5_26_PORTA_FISCAL_NEUTRA",
  organizacaoId:plano.organizacaoId,vendaId:plano.vendaId,
  quantidadeEnvelopes:envelopes.length,envelopes:Object.freeze(envelopes),
  provedorConectado:false,motorFiscalImplementado:false,
  temCredenciaisExternas:false,habilitaQualquerOperacaoFiscal:false});
}
