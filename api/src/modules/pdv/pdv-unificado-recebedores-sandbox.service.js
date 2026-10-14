/**
 * PointVet 20.2.4B.2B.2 — technical receiver registry + status evidence MOCK ONLY.
 * No HTTP routes, credentials, money movement, PSP requests or financial reconciliation.
 * A recorded mock status does NOT authorize retries, settle a payment or finalize a sale.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {consultarReservaFechamento} from "./pdv-unificado.service.js";

const CNPJ=/^[0-9]{14}$/;
const MOCK_REF=/^ci_mock_[a-zA-Z0-9_-]{3,90}$/;
const AUDIT_REF=/^[a-zA-Z0-9:_-]{1,120}$/;
const RESULTS=new Set(["CONFIRMADA","RECUSADA","INDETERMINADA"]);

async function bancoIsolado(tx){
 const rows=await tx.$queryRaw`SELECT current_database() AS nome`;
 if(rows[0]?.nome!=="pointvet_unified_ci")throw Error("BANCO_NAO_ISOLADO");
}
function resumoReceiver(r,reutilizado){
 return {id:r.id,empresaId:r.empresaId,cnpj:r.cnpj,provedor:r.provedor,
  referenciaExterna:r.referenciaExterna,ativo:r.ativo,reutilizado,
  checkoutHabilitado:false,contaPspVerificada:false};
}

/** Register an INACTIVE mapping. Never stores access tokens or banking credentials. */
export async function registrarRecebedorMockSomenteSandbox({organizacaoId,empresaId,cnpj,referenciaExterna}){
 exigirBancoIsolado();
 if(!CNPJ.test(cnpj||"")||!MOCK_REF.test(referenciaExterna||""))throw Error("RECEBEDOR_MOCK_INVALIDO");
 return prisma.$transaction(async tx=>{
  await bancoIsolado(tx);
  const empresa=await tx.empresa.findFirst({where:{id:empresaId,organizacaoId,ativo:true},select:{id:true,cnpj:true}});
  if(!empresa||empresa.cnpj!==cnpj)throw Error("RECEBEDOR_CNPJ_DIVERGENTE");
  const prev=await tx.recebedorPspUnificado.findUnique({where:{empresaId}});
  if(prev){
   if(prev.cnpj!==cnpj||prev.provedor!=="SIMULADOR_CI"||prev.referenciaExterna!==referenciaExterna||prev.ativo)
    throw Error("RECEBEDOR_JA_CONFIGURADO");
   return resumoReceiver(prev,true);
  }
  const created=await tx.recebedorPspUnificado.create({data:{
   empresaId,cnpj,provedor:"SIMULADOR_CI",referenciaExterna,ativo:false
  }});
  return resumoReceiver(created,false);
 },{isolationLevel:"Serializable",maxWait:5000,timeout:12000});
}

function resumoConsulta(e,reutilizada){
 return {id:e.id,intencaoId:e.intencaoId,recebedorId:e.recebedorId,
  chaveConsulta:e.chaveConsulta,resultadoSimulado:e.resultado,reutilizada,
  houveEnvioPsp:false,podeReenviar:false,liquidacaoConfirmada:false,pagamentoCriado:false};
}
/** Append a provider-neutral MOCK status-query evidence.
 * Only permitted after manual reconciliation is requested.
 * This deliberately NEVER changes payment/outbox state: an unsigned assertion
 * from a mock/provider response must not be treated as financial confirmation.
 */
export async function registrarConsultaStatusMockSomenteSandbox({
 organizacaoId,usuarioId,empresaId,id,versao,intencaoId,recebedorId,
 chaveConsulta,referenciaTransacao,resultado
}){
 exigirBancoIsolado();
 if(!AUDIT_REF.test(chaveConsulta||"")||!AUDIT_REF.test(referenciaTransacao||"")||
   !RESULTS.has(resultado))throw Error("CONSULTA_STATUS_INVALIDA");
 return prisma.$transaction(async tx=>{
  await bancoIsolado(tx);
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${id} FOR UPDATE`;
  // Authorization covers ALL companies, including ones other than the selected company.
  const reserva=await consultarReservaFechamento({organizacaoId,usuarioId,empresaId,id,versao},tx);
  if(!reserva||reserva.status!=="RESERVADA")throw Error("RESERVA_NAO_EDITAVEL");
  const intent=await tx.intencaoAutorizacaoUnificada.findFirst({
   where:{id:intencaoId,operacao:{reservaId:reserva.id}},include:{
    operacao:{include:{empresa:{select:{organizacaoId:true,cnpj:true}}}},outbox:true
   }
  });
  if(!intent||!intent.outbox)throw Error("INTENCAO_NAO_ENCONTRADA");
  const receiver=await tx.recebedorPspUnificado.findUnique({where:{id:recebedorId}});
  if(!receiver||receiver.provedor!=="SIMULADOR_CI"||receiver.ativo||
    receiver.empresaId!==intent.operacao.empresaId||
    receiver.cnpj!==intent.operacao.empresa.cnpj||
    intent.operacao.empresa.organizacaoId!==organizacaoId)
    throw Error("RECEBEDOR_NAO_CORRESPONDE_A_EMPRESA");
  if(intent.outbox.status!=="REVISAO_MANUAL")throw Error("CONSULTA_FORA_DA_REVISAO");
  const old=await tx.evidenciaConsultaPspSimulada.findUnique({where:{chaveConsulta}});
  if(old){
   if(old.intencaoId!==intencaoId||old.recebedorId!==recebedorId||
     old.referenciaTransacao!==referenciaTransacao||old.resultado!==resultado)
     throw Error("CONSULTA_STATUS_CONFLITANTE");
   return resumoConsulta(old,true);
  }
  const row=await tx.evidenciaConsultaPspSimulada.create({data:{
   intencaoId,recebedorId,chaveConsulta,referenciaTransacao,resultado
  }});
  return resumoConsulta(row,false);
 },{isolationLevel:"Serializable",maxWait:5000,timeout:12000});
}
