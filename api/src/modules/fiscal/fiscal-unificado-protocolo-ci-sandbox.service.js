/**
 * PointVet M.4D.1 — NEVER routes via HTTP; executed ONLY in disposable CI DB.
 * SIMULATED fiscal intent/event ledger, NOT an invoice, provider integration,
 * external protocol, tax calculation, real acceptance or cancellation.
 */
import {createHash} from "node:crypto";
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "../pdv/pdv-unificado-venda-sandbox.service.js";
import {prepararVendaFilhaFiscalTransacaoSomenteSandbox} from "./fiscal-unificado-venda-sandbox.service.js";
import {validarPlanoFiscalCi,proximoEstadoFiscalCi} from "./fiscal-unificado-protocolo-ci.contract.js";

const fail=s=>{throw Error(s);};
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const validKey=x=>typeof x==="string"&&/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(x);
async function isolated(tx){
 exigirBancoIsolado();
 const rows=await tx.$queryRawUnsafe("SELECT current_database() AS name");
 if(rows[0]?.name!=="pointvet_unified_ci")fail("M4D_BANCO_NAO_ISOLADO");
}
async function permission(tx,{organizacaoId,empresaId,usuarioId},right){
 const [user,membership,companyAccess]=await Promise.all([
  tx.usuario.findUnique({where:{id:usuarioId},select:{status:true}}),
  tx.usuarioOrganizacao.findUnique({where:{
   usuarioId_organizacaoId:{usuarioId,organizacaoId}
  }}),
  tx.usuarioEmpresa.findUnique({where:{
   usuarioId_empresaId:{usuarioId,empresaId}
  },include:{empresa:true,cargo:{include:{permissoes:{include:{permissao:true}}}}}})
 ]);
 if(user?.status!=="ATIVO"||!membership?.ativo||
    !companyAccess?.ativo||!companyAccess.empresa?.ativo||
    companyAccess.empresa.organizacaoId!==organizacaoId||
    !companyAccess.cargo?.ativo||
    companyAccess.cargo.empresaId!==empresaId)
  fail("M4D_ACESSO_ORGANIZACAO_EMISSOR_INVALIDO");
 const allowed=new Set(companyAccess.cargo.permissoes.map(x=>x.permissao.codigo));
 if(!["pdv.acessar","fiscal.visualizar",right].every(x=>allowed.has(x)))
  fail("M4D_PERMISSAO_FISCAL_INSUFICIENTE");
}
async function snapshot(tx,x,chosen){
 return prepararVendaFilhaFiscalTransacaoSomenteSandbox(tx,{
  organizacaoId:x.organizacaoId,empresaId:x.empresaId,usuarioId:x.usuarioId,
  vendaId:x.vendaId,escolhas:chosen
 });
}
const display=(row,reutilizada=false)=>({
 id:row.id,empresaId:row.empresaId,vendaId:row.vendaId,
 classe:row.classe,tipoDocumento:row.tipoDocumento,estado:row.estado,
 pedidoFingerprint:row.pedidoFingerprint,snapshotFingerprint:row.snapshotFingerprint,
 reutilizada,transmissaoHabilitada:false,autorizacaoOficial:false,
 cancelamentoOficial:false,houveProtocoloFiscal:false,houveXml:false,
 houveAlteracaoDocumentoFiscal:false
});
export async function prepararFluxoFiscalSomenteSandbox(x){
 exigirBancoIsolado();
 if(!x?.organizacaoId||!x.empresaId||!x.vendaId||!x.usuarioId||
    !validKey(x.solicitacaoId))fail("M4D_PARAMETROS_PREPARACAO_INVALIDOS");
 return prisma.$transaction(async tx=>{
  await isolated(tx);await permission(tx,x,"fiscal.emitir");
  await tx.$queryRawUnsafe('SELECT "id" FROM "vendas" WHERE "id"=$1 FOR UPDATE',x.vendaId);
  const opts=x.escolhas;
  if(!Array.isArray(opts)||opts.length===0)fail("M4D_ESCOLHAS_OBRIGATORIAS");
  const plan=await snapshot(tx,x,opts);
  const meta=validarPlanoFiscalCi(plan,{classe:x.classe,tipoDocumento:x.tipoDocumento});
  const request=hash({v:1,organizacaoId:x.organizacaoId,empresaId:x.empresaId,
   vendaId:x.vendaId,classe:x.classe,tipoDocumento:x.tipoDocumento,
   solicitacaoId:x.solicitacaoId,fingerprint:meta.fingerprint});
  const existing=await tx.fluxoFiscalUnificadoCi.findUnique({where:{
   vendaId_classe:{vendaId:x.vendaId,classe:x.classe}
  }});
  if(existing){
   if(existing.pedidoFingerprint!==request||
      existing.snapshotFingerprint!==plan.fingerprint||
      existing.organizacaoId!==x.organizacaoId||
      existing.empresaId!==x.empresaId||
      existing.tipoDocumento!==x.tipoDocumento)
    fail("M4D_PREPARACAO_REPLAY_DIVERGENTE");
   return display(existing,true);
  }
  const row=await tx.fluxoFiscalUnificadoCi.create({data:{
   organizacaoId:x.organizacaoId,empresaId:x.empresaId,vendaId:x.vendaId,
   criadoPorId:x.usuarioId,classe:meta.classe,tipoDocumento:meta.tipoDocumento,
   estado:"PREPARADA_CI",pedidoFingerprint:request,
   snapshotFingerprint:meta.fingerprint,snapshot:plan
  }});
  if(x.simularFalhaAposGravar===true)fail("M4D_FALHA_SIMULADA_PREPARACAO");
  return display(row);
 },{isolationLevel:"Serializable",maxWait:10000,timeout:25000});
}
export async function registrarEventoFiscalSimuladoSomenteSandbox(x){
 exigirBancoIsolado();
 if(!x?.organizacaoId||!x.empresaId||!x.usuarioId||!x.fluxoId||
    !validKey(x.chaveEvento)||typeof x.tipo!=="string")
  fail("M4D_EVENTO_PARAMETROS_INVALIDOS");
 const motivo=typeof x.motivo==="string"?x.motivo.trim():"";
 return prisma.$transaction(async tx=>{
  await isolated(tx);
  const permissionName=x.tipo==="SIMULAR_CANCELAMENTO"?"fiscal.cancelar":"fiscal.emitir";
  await permission(tx,x,permissionName);
  await tx.$queryRawUnsafe('SELECT "id" FROM "fluxos_fiscais_unificados_ci" WHERE "id"=$1 FOR UPDATE',x.fluxoId);
  const row=await tx.fluxoFiscalUnificadoCi.findFirst({where:{
   id:x.fluxoId,organizacaoId:x.organizacaoId,empresaId:x.empresaId
  }});
  if(!row)fail("M4D_FLUXO_NAO_ENCONTRADO");
  const fingerprint=hash({v:1,fluxoId:x.fluxoId,chaveEvento:x.chaveEvento,
   tipo:x.tipo,motivo,usuarioId:x.usuarioId});
  const existing=await tx.eventoFluxoFiscalUnificadoCi.findUnique({where:{
   fluxoId_chaveEvento:{fluxoId:row.id,chaveEvento:x.chaveEvento}
  }});
  if(existing){
   if(existing.eventoFingerprint!==fingerprint)fail("M4D_EVENTO_REPLAY_CONFLITANTE");
   return {...display(row,true),estado:existing.estadoPosterior,
    eventoId:existing.id,reutilizada:true,houveReenvio:false};
  }
  // Verify live sale, issuer, fiscal config and plan are unchanged since
  // preparation; any altered fiscal identity MUST stop all state changes.
  const choices=row.snapshot?.grupos?.map(g=>({
   classe:g.classe,tipoDocumento:g.tipoDocumentoEscolhido
  }));
  if(!Array.isArray(choices)||!choices.length)
   fail("M4D_SNAPSHOT_INVALIDO");
  const live=await snapshot(tx,{...x,vendaId:row.vendaId},choices);
  if(live.fingerprint!==row.snapshotFingerprint)
   fail("M4D_FONTE_FISCAL_ALTERADA");
  const meta=validarPlanoFiscalCi(live,{
   classe:row.classe,tipoDocumento:row.tipoDocumento
  });
  if(meta.empresaId!==row.empresaId||meta.vendaId!==row.vendaId)
   fail("M4D_EMISSOR_DIVERGENTE");
  const decision=proximoEstadoFiscalCi({
   estado:row.estado,tipo:x.tipo,motivo
  });
  const updated=await tx.fluxoFiscalUnificadoCi.updateMany({where:{
   id:row.id,estado:decision.estadoAnterior
  },data:{estado:decision.estadoPosterior}});
  if(updated.count!==1)fail("M4D_TRANSICAO_CONCORRENTE");
  const event=await tx.eventoFluxoFiscalUnificadoCi.create({data:{
   fluxoId:row.id,usuarioId:x.usuarioId,chaveEvento:x.chaveEvento,
   eventoFingerprint:fingerprint,tipo:x.tipo,
   estadoAnterior:decision.estadoAnterior,
   estadoPosterior:decision.estadoPosterior,
   evidencia:{...decision,origem:"SIMULADOR_LOCAL_CI",
    comprovacaoEmissorExterno:false,consultouProvedorFiscal:false}
  }});
  if(x.simularFalhaAposGravar===true)fail("M4D_FALHA_SIMULADA_EVENTO");
  return {...display({...row,estado:decision.estadoPosterior}),
   eventoId:event.id,exigeConsultaManual:decision.exigeConsultaManual,
   houveReenvio:false};
 },{isolationLevel:"Serializable",maxWait:10000,timeout:25000});
}
