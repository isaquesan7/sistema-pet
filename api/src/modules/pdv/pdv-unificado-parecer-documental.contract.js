/**
 * PointVet M.5.11 — segregated documentary REVIEW only.
 * Evidence hash/reference are supplied by reviewer; bytes are not uploaded
 * or independently verified. Never proves bank credit or permits settlement.
 */
import {createHash} from "node:crypto";
const fail=reason=>{throw Error("M511_"+reason);};
const REFERENCE=/^[A-Za-z0-9][A-Za-z0-9_./:-]{7,119}$/;
const HEX=/^[a-f0-9]{64}$/;
export function validarParecerDocumentalM511({preparacaoFingerprint,conferenteId,
 evidenciaReferencia,evidenciaSha256,confirmouConferenciaDocumental}={}){
 if(typeof preparacaoFingerprint!=="string"||!HEX.test(preparacaoFingerprint)||
    typeof conferenteId!=="string"||conferenteId.length<3||
    typeof evidenciaReferencia!=="string"||
    !REFERENCE.test(evidenciaReferencia)||
    typeof evidenciaSha256!=="string"||!HEX.test(evidenciaSha256))
  fail("EVIDENCIA_OU_CONTEXTO_INVALIDO");
 if(confirmouConferenciaDocumental!==true)
  fail("DECLARACAO_EXPLICITA_OBRIGATORIA");
 const fingerprint=createHash("sha256").update(JSON.stringify({
  versao:1,tipo:"SEGUNDA_CONFERENCIA_DOCUMENTAL",
  preparacaoFingerprint,conferenteId,evidenciaReferencia,evidenciaSha256
 })).digest("hex");
 return Object.freeze({fingerprint,preparacaoFingerprint,conferenteId,
  evidenciaReferencia,evidenciaSha256,
  status:"CONFERENCIA_DOCUMENTAL_DECLARADA",
  documentoAnexado:false,conteudoDocumentoValidado:false,
  comprovacaoBancariaIndependente:false,baixaContabilAutorizada:false});
}
