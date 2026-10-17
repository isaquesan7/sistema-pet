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
import {raizFiscalCi,avaliarCadeiaFiscalCi,confirmarInvestigacaoManualCi,
 fingerprintEventoFiscalCi,hashCadeiaEventoFiscalCi}
 from "./fiscal-unificado-integridade-ci.contract.js";

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
async function conferirIntegridade(tx,row){
 const events=await tx.eventoFluxoFiscalUnificadoCi.findMany({
  where:{fluxoId:row.id},orderBy:[{sequencia:"asc"},{id:"asc"}]
 });
 const status=avaliarCadeiaFiscalCi(row,events);
 if(!status.confiavel)fail("M4D2_HISTORICO_INTEGRO_OBRIGATORIO:"+status.pendencias.join(","));
 return {status,events};
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
   await conferirIntegridade(tx,existing);
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
  const root=raizFiscalCi(row);
  const secured=await tx.fluxoFiscalUnificadoCi.update({where:{id:row.id},data:{
   integridadeRaiz:root,integridadeCabeca:root
  }});
  if(x.simularFalhaAposGravar===true)fail("M4D_FALHA_SIMULADA_PREPARACAO");
  return display(secured);
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
  const permissionName=x.tipo==="SIMULAR_CANCELAMENTO"?"fiscal.cancelar":
   x.tipo==="REGISTRAR_INVESTIGACAO_MANUAL_CI"?"fiscal.gerenciar":"fiscal.emitir";
  await permission(tx,x,permissionName);
  await tx.$queryRawUnsafe('SELECT "id" FROM "fluxos_fiscais_unificados_ci" WHERE "id"=$1 FOR UPDATE',x.fluxoId);
  const row=await tx.fluxoFiscalUnificadoCi.findFirst({where:{
   id:x.fluxoId,organizacaoId:x.organizacaoId,empresaId:x.empresaId
  }});
  if(!row)fail("M4D_FLUXO_NAO_ENCONTRADO");
  const {status:chainStatus}=await conferirIntegridade(tx,row);
  const fingerprint=fingerprintEventoFiscalCi({
   fluxoId:x.fluxoId,chaveEvento:x.chaveEvento,
   tipo:x.tipo,motivo,usuarioId:x.usuarioId,
   referenciaInterna:x.referenciaInterna,
   descricaoVerificacao:x.descricaoVerificacao
  });
  const existing=await tx.eventoFluxoFiscalUnificadoCi.findUnique({where:{
   fluxoId_chaveEvento:{fluxoId:row.id,chaveEvento:x.chaveEvento}
  }});
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
  // Even a replay must validate the CURRENT fiscal source, never return a
  // stale green result after issuer/config/sale/documents changed.
  if(existing){
   if(existing.eventoFingerprint!==fingerprint)fail("M4D_EVENTO_REPLAY_CONFLITANTE");
   return {...display(row,true),estado:existing.estadoPosterior,
    eventoId:existing.id,reutilizada:true,houveReenvio:false};
  }
  if((x.tipo==="SIMULAR_CONSULTA_ACEITA"||
       x.tipo==="SIMULAR_CONSULTA_REJEITADA")&&
       chainStatus.investigacaoManualNecessaria)
   fail("M4D2_INVESTIGACAO_MANUAL_PREVIA_OBRIGATORIA");
  const manual=x.tipo==="REGISTRAR_INVESTIGACAO_MANUAL_CI";
  const decision=manual?confirmarInvestigacaoManualCi({
   estado:row.estado,motivo,referenciaInterna:x.referenciaInterna,
   descricaoVerificacao:x.descricaoVerificacao
  }):proximoEstadoFiscalCi({
   estado:row.estado,tipo:x.tipo,motivo
  });
  const evidencia=manual?decision:{
   ...decision,origem:"SIMULADOR_LOCAL_CI",
   comprovacaoEmissorExterno:false,consultouProvedorFiscal:false
  };
  const sequencia=row.integridadeContador+1;
  const eventValues={fluxoId:row.id,usuarioId:x.usuarioId,
   chaveEvento:x.chaveEvento,eventoFingerprint:fingerprint,tipo:x.tipo,
   estadoAnterior:decision.estadoAnterior,estadoPosterior:decision.estadoPosterior,
   evidencia,sequencia,hashAnterior:row.integridadeCabeca};
  const hashEvento=hashCadeiaEventoFiscalCi(eventValues);
  const updated=await tx.fluxoFiscalUnificadoCi.updateMany({where:{
   id:row.id,estado:decision.estadoAnterior,
   integridadeCabeca:row.integridadeCabeca,
   integridadeContador:row.integridadeContador
  },data:{
   estado:decision.estadoPosterior,integridadeContador:{increment:1},
   integridadeCabeca:hashEvento
  }});
  if(updated.count!==1)fail("M4D_TRANSICAO_CONCORRENTE");
  const event=await tx.eventoFluxoFiscalUnificadoCi.create({data:{
   ...eventValues,hashEvento
  }});
  if(x.simularFalhaAposGravar===true)fail("M4D_FALHA_SIMULADA_EVENTO");
  return {...display({...row,estado:decision.estadoPosterior}),
   eventoId:event.id,exigeConsultaManual:manual||
    decision.exigeConsultaManual===true,
   houveReenvio:false};
 },{isolationLevel:"Serializable",maxWait:10000,timeout:25000});
}


/**
 * Manual read-only diagnosis: any broken chain is returned as UNTRUSTED.
 * Never makes an official status determination or retries emission.
 */
export async function diagnosticarFluxoFiscalSomenteSandbox(x){
 exigirBancoIsolado();
 if(!x?.organizacaoId||!x.empresaId||!x.fluxoId||!x.usuarioId)
  fail("M4D2_CONSULTA_INVALIDA");
 return prisma.$transaction(async tx=>{
  await isolated(tx);
  await permission(tx,x,"fiscal.visualizar");
  const row=await tx.fluxoFiscalUnificadoCi.findFirst({where:{
   id:x.fluxoId,empresaId:x.empresaId,organizacaoId:x.organizacaoId
  }});
  if(!row)fail("M4D_FLUXO_NAO_ENCONTRADO");
  const events=await tx.eventoFluxoFiscalUnificadoCi.findMany({
   where:{fluxoId:row.id},orderBy:[{sequencia:"asc"},{id:"asc"}]
  });
  const status=avaliarCadeiaFiscalCi(row,events);
  // Diagnose original live source separately; do not claim trust after its
  // document was created or a sale changed.
  let origemConfiavel=false;
  try{
   const escolhas=row.snapshot?.grupos?.map(g=>({
    classe:g.classe,tipoDocumento:g.tipoDocumentoEscolhido
   }));
   if(Array.isArray(escolhas)&&escolhas.length){
    const live=await snapshot(tx,{...x,vendaId:row.vendaId},escolhas);
    origemConfiavel=live.fingerprint===row.snapshotFingerprint;
   }
  }catch{origemConfiavel=false;}
  return {...display(row),...status,
   fonteFiscalAtualConfiavel:origemConfiavel,
   confiavel:status.confiavel&&origemConfiavel,
   pendencias:[...status.pendencias,
    ...(!origemConfiavel?["M4D2_FONTE_FISCAL_DIVERGENTE"]:[])],
   exigeConsultaHumanaEmCanalOficial:true,
   recebeuProtocoloFiscalReal:false,autorizaNovoEnvio:false,
   retornoPossuiProvaExterna:false};
 },{isolationLevel:"RepeatableRead",maxWait:5000,timeout:14000});
}
