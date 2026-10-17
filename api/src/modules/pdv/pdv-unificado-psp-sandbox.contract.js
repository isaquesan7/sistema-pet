/**
 * PointVet 20.2.4B.2 — contrato PSP simulado.
 *
 * Nenhum webhook HTTP, nenhum PSP, nenhum segredo persistido. A assinatura HMAC
 * é um CONTRATO DE TESTE, não substitui o algoritmo exigido pelo PSP real.
 * Apenas permite exercitar correlação por recebedor, valor, intenção, janela
 * temporal e deduplicação de eventos antes de habilitar qualquer integração.
 */
import {createHmac,timingSafeEqual} from "node:crypto";
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {registrarEventoSomenteSandbox} from "./pdv-unificado-autorizacao-sandbox.service.js";

const WINDOW_SECONDS=300;
const RESULTS=new Set(["CONFIRMADA","RECUSADA","INDETERMINADA"]);
const REF=/^[a-zA-Z0-9_:-]{1,120}$/;
const CNPJ=/^[0-9]{14}$/;

function timestampSecs(time){
 const num=Number(time);
 if(!Number.isSafeInteger(num)||num<0)throw Error("WEBHOOK_TIMESTAMP_INVALIDO");
 return num;
}
/** Sign exactly the unmodified raw UTF-8 JSON, prefixed with timestamp. */
export function assinarWebhookPSPSimulado({rawBody,timestamp,secret}){
 if(typeof rawBody!=="string"||typeof secret!=="string"||secret.length<32)
  throw Error("WEBHOOK_CONFIG_INVALIDA");
 return "sha256="+createHmac("sha256",secret).update(String(timestamp)+"."+rawBody).digest("hex");
}
function verificarAssinatura({rawBody,timestamp,signature,secret,agoraMs}){
 if(typeof rawBody!=="string"||Buffer.byteLength(rawBody)>8192||
  typeof signature!=="string"||!/^sha256=[a-f0-9]{64}$/.test(signature)||
  typeof secret!=="string"||secret.length<32)throw Error("WEBHOOK_ASSINATURA_INVALIDA");
 const seconds=timestampSecs(timestamp);
 if(Math.abs(Math.floor(agoraMs/1000)-seconds)>WINDOW_SECONDS)throw Error("WEBHOOK_EXPIRADO");
 const expected=assinarWebhookPSPSimulado({rawBody,timestamp:seconds,secret});
 const a=Buffer.from(expected,"utf8"),b=Buffer.from(signature,"utf8");
 if(a.length!==b.length||!timingSafeEqual(a,b))throw Error("WEBHOOK_ASSINATURA_INVALIDA");
}
function validarPayload(rawBody){
 let obj;
 try{obj=JSON.parse(rawBody)}catch{throw Error("WEBHOOK_PAYLOAD_INVALIDO")}
 const names=["versao","intencaoChave","empresaId","recebedorCnpj","valorCentavos","eventoId","resultado","token"];
 if(!obj||typeof obj!=="object"||Array.isArray(obj)||
  Object.keys(obj).length!==names.length||names.some(k=>!(k in obj))||
  obj.versao!==1||typeof obj.intencaoChave!=="string"||!REF.test(obj.intencaoChave)||
  typeof obj.empresaId!=="string"||!obj.empresaId||
  typeof obj.recebedorCnpj!=="string"||!CNPJ.test(obj.recebedorCnpj)||
  !Number.isSafeInteger(obj.valorCentavos)||obj.valorCentavos<=0||
  typeof obj.eventoId!=="string"||!REF.test(obj.eventoId)||
  !RESULTS.has(obj.resultado)||typeof obj.token!=="string"||!obj.token)
  throw Error("WEBHOOK_PAYLOAD_INVALIDO");
 return obj;
}
/** TEST-ONLY signed callback handler, never mounted as an HTTP route.
 * Validates invoice-receiver identity and expected cents against the immutable
 * intent before calling the existing transactional/synthetic event handler.
 */
export async function receberWebhookPSPSomenteSandbox({
 organizacaoId,usuarioId,empresaId,id,versao,rawBody,timestamp,signature,secret,agoraMs=Date.now()
}){
 exigirBancoIsolado();
 verificarAssinatura({rawBody,timestamp,signature,secret,agoraMs});
 const body=validarPayload(rawBody);
 const intent=await prisma.intencaoAutorizacaoUnificada.findFirst({
  where:{chaveIdempotencia:body.intencaoChave,
   operacao:{reserva:{comandaId:id,versaoRascunho:versao,comanda:{cliente:{organizacaoId}}},
    empresaId:body.empresaId,empresa:{organizacaoId,cnpj:body.recebedorCnpj}}},
  select:{id:true,valor:true,operacao:{select:{empresaId:true,empresa:{select:{cnpj:true}}}}}
 });
 if(!intent)throw Error("WEBHOOK_RECEBEDOR_OU_INTENCAO_INVALIDA");
 if(Math.round(Number(intent.valor)*100)!==body.valorCentavos)
  throw Error("WEBHOOK_VALOR_DIVERGENTE");
 return registrarEventoSomenteSandbox({organizacaoId,usuarioId,empresaId,id,versao,
  intencaoId:intent.id,resultado:body.resultado,chaveEvento:body.eventoId,token:body.token});
}
