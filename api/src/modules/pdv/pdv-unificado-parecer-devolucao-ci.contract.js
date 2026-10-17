/**
 * PointVet M.5.28 — independent reviewer ATTESTATION of document comparison,
 * based only on supplied metadata. No document upload, bank verification,
 * real refund, fiscal operation or authority to complete the M.5.27 checklist.
 */
import {createHash} from "node:crypto";
import {centavosM522,reaisM522} from "./pdv-unificado-devolucao-declarada.contract.js";

const fail=code=>{throw Error("M528_"+code);};
const SHA=/^[0-9a-f]{64}$/;
const REF=/^[A-Za-z0-9][A-Za-z0-9_./:-]{7,119}$/;
const str=x=>typeof x==="string"&&x.trim().length>=3&&x.length<=120;

export function validarParecerDevolucaoCiM528({
 devolucaoId,devolucaoFingerprint,codigoDossie,conferenteId,
 usuarioDeclaranteId,criadorPreparacaoId,usuarioRepasseId,
 referenciaExterna,valorBrutoDeclarado,
 evidenciaReferencia,evidenciaSha256,confirmouComparacaoDocumental
}={}){
 if(![devolucaoId,conferenteId,usuarioDeclaranteId,criadorPreparacaoId,
   usuarioRepasseId].every(str)||!SHA.test(devolucaoFingerprint||"")||
   !SHA.test(codigoDossie||"")||
   !REF.test(referenciaExterna||"")||
   !REF.test(evidenciaReferencia||"")||
   !SHA.test(evidenciaSha256||""))fail("METADADOS_INVALIDOS");
 if(new Set([usuarioDeclaranteId,criadorPreparacaoId,usuarioRepasseId])
    .has(conferenteId))fail("CONFERENTE_NAO_INDEPENDENTE");
 if(confirmouComparacaoDocumental!==true)
  fail("DECLARACAO_HUMANA_EXPLICITA_OBRIGATORIA");
 let value;
 try{value=centavosM522(valorBrutoDeclarado);}
 catch{fail("VALOR_INVALIDO");}
 if(value<=0)fail("VALOR_INVALIDO");
 const objeto={versao:1,tipo:"PARECER_DOCUMENTAL_DEVOLUCAO_NAO_VERIFICADO",
  devolucaoId,devolucaoFingerprint,codigoDossie,
  conferenteId,referenciaExterna,valorBruto:reaisM522(value),
  evidenciaReferencia,evidenciaSha256};
 return Object.freeze({fingerprint:createHash("sha256")
  .update(JSON.stringify(objeto)).digest("hex"),
  devolucaoId,conferenteId,codigoDossie,
  evidenciaReferencia,evidenciaSha256,
  valorBruto:objeto.valorBruto,
  status:"CONFERENCIA_DOCUMENTAL_DECLARADA_CI",
  comprovanteAnexado:false,conteudoDocumentoAutenticado:false,
  bancoVerificadoIndependentemente:false,segundaRevisaoLegalConcluida:false,
  permiteReembolso:false,permiteLancamentoFinanceiro:false,
  permiteOperacaoFiscal:false,habilitaCheckout:false});
}
