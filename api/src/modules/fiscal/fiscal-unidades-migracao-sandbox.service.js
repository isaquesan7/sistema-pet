/**
 * PointVet M.4C.3 — assisted, reversible logical link of LEGACY Empresa to
 * EntidadeFiscal + UnidadeOperacional, exclusively in disposable PostgreSQL CI.
 *
 * No HTTP route, no production writes, no CNPJ unique index removal, no
 * automatic fiscal/checkout activation, and no ownership reassignment.
 *
 * A stable operator-approved snapshot is retained in Auditoria. The legacy
 * Empresa is NEVER changed. Reverse DETACHES the unit, retaining the issuer,
 * unit and historical audit; it never deletes sale, stock, account or invoice.
 */
import {createHash} from "node:crypto";
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "../pdv/pdv-unificado-venda-sandbox.service.js";

const EVENT_LINK="M4C3_VINCULO_FISCAL_LEGADO_CI";
const EVENT_REVERSE="M4C3_REVERSAO_LOGICA_FISCAL_CI";
const fail=s=>{throw Error(s);};
const digest=o=>createHash("sha256").update(JSON.stringify(o)).digest("hex");
const formatCodigo=x=>typeof x==="string"&&/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(x);
const formatRequest=x=>typeof x==="string"&&/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(x);
function validate(x){
 if(!x||!x.organizacaoId||!x.empresaId||!x.usuarioId)
  fail("M4C3_PARAMETROS_INCOMPLETOS");
 return x;
}
async function guard(tx){
 const data=await tx.$queryRawUnsafe("SELECT current_database() AS name");
 if(data[0]?.name!=="pointvet_unified_ci")fail("BANCO_NAO_ISOLADO");
}
async function authorize(tx,x){
 const [who,link,orgLink,org]=await Promise.all([
  tx.usuario.findFirst({where:{id:x.usuarioId,status:"ATIVO"},select:{id:true}}),
  tx.usuarioEmpresa.findFirst({where:{
   empresaId:x.empresaId,usuarioId:x.usuarioId,ativo:true,
   empresa:{organizacaoId:x.organizacaoId,ativo:true}
  },include:{cargo:{include:{permissoes:{include:{permissao:true}}}}}}),
  tx.usuarioOrganizacao.findUnique({where:{
   usuarioId_organizacaoId:{usuarioId:x.usuarioId,organizacaoId:x.organizacaoId}
  }}),
  tx.organizacao.findFirst({where:{id:x.organizacaoId,ativo:true},select:{id:true}})
 ]);
 if(!who||!org||!orgLink?.ativo||
    !["PROPRIETARIO","ADMINISTRADOR"].includes(orgLink.papel))
  fail("M4C3_GESTOR_DA_ORGANIZACAO_OBRIGATORIO");
 // Prisma's UsuarioEmpresa.cargoId FK alone does not guarantee that the
 // associated Cargo belongs to the same issuer company. Enforce it here.
 if(!link?.cargo?.ativo||link.cargo.empresaId!==x.empresaId||
    !link.cargo.permissoes.some(
  p=>p.permissao.codigo==="fiscal.gerenciar"))
  fail("M4C3_PERMISSAO_FISCAL_GERENCIAR_OBRIGATORIA");
}
async function source(tx,x){
 const empresa=await tx.empresa.findFirst({where:{
  id:x.empresaId,organizacaoId:x.organizacaoId,ativo:true
 },include:{configuracaoFiscal:true,unidadeOperacionalLegada:{
  include:{entidadeFiscal:true}
 }}});
 if(!empresa)fail("M4C3_EMPRESA_NAO_ENCONTRADA");
 if(!/^\d{14}$/.test(empresa.cnpj)||!empresa.razaoSocial?.trim()||
    !empresa.nomeFantasia?.trim())fail("M4C3_CNPJ_OU_IDENTIDADE_INCOMPLETA");
 const [vendas,documentos,caixas,itens,usuarios,estoque]=await Promise.all([
  tx.venda.count({where:{empresaId:empresa.id}}),
  tx.documentoFiscal.count({where:{empresaId:empresa.id}}),
  tx.caixa.count({where:{empresaId:empresa.id}}),
  tx.itemCatalogo.count({where:{empresaId:empresa.id}}),
  tx.usuarioEmpresa.count({where:{empresaId:empresa.id}}),
  tx.movimentacaoEstoque.count({where:{empresaId:empresa.id}})
 ]);
 // No customer PII, banking identifiers, payment references or passwords.
 const snapshot={
  contrato:1,organizacaoId:x.organizacaoId,empresaId:empresa.id,
  empresaAtualizadaEm:empresa.updatedAt.toISOString(),
  cnpj:empresa.cnpj,razaoSocial:empresa.razaoSocial,
  nomeFantasia:empresa.nomeFantasia,
  inscricaoEstadual:empresa.inscricaoEstadual||null,
  inscricaoMunicipal:empresa.inscricaoMunicipal||null,
  uf:empresa.estado||null,municipio:empresa.cidade||null,
  fiscalConfigId:empresa.configuracaoFiscal?.id||null,
  fiscalConfigAtualizadaEm:empresa.configuracaoFiscal?.updatedAt?.toISOString()||null,
  historico:{vendas,documentos,caixas,itens,usuarios,estoque}
 };
 return {empresa,snapshot,fingerprint:digest(snapshot)};
}
async function previous(tx,x){
 const records=await tx.auditoria.findMany({where:{
  organizacaoId:x.organizacaoId,empresaId:x.empresaId,
  entidade:"UnidadeOperacional",entidadeId:x.empresaId,
  acao:{in:[EVENT_LINK,EVENT_REVERSE]}
 },orderBy:[{createdAt:"asc"},{id:"asc"}]});
 const importRecords=records.filter(y=>y.acao===EVENT_LINK);
 const revRecords=records.filter(y=>y.acao===EVENT_REVERSE);
 if(importRecords.length>1||revRecords.length>1)fail("M4C3_HISTORICO_AMBIGUO");
 if(revRecords.length&&!importRecords.length)fail("M4C3_HISTORICO_INCONSISTENTE");
 return {importRecord:importRecords[0],reverseRecord:revRecords[0]};
}
async function lockCompany(tx,x){
 await tx.$queryRawUnsafe('SELECT "id" FROM "empresas" WHERE "id"=$1 FOR UPDATE',x.empresaId);
 await authorize(tx,x);
}
const response=(record,{reutilizado=false,estado="VINCULADA"}={})=>({
 estado,empresaId:record.empresaId,organizacaoId:record.organizacaoId,
 entidadeFiscalId:record.entidadeFiscalId,unidadeOperacionalId:record.unidadeOperacionalId,
 fingerprint:record.fingerprint,snapshot:record.snapshot,
 reutilizado,emissaoFiscalHabilitada:false,unidadeAdicionalOperacional:false,
 alterouEmpresaLegada:false,podeImplantarEmProducao:false
});
function validateExistingTopology(empresa,entity,unit){
 if(!entity||!unit||!entity.ativo||!unit.ativa||
    entity.organizacaoId!==empresa.organizacaoId||
    entity.cnpj!==empresa.cnpj||
    entity.razaoSocial!==empresa.razaoSocial||
    unit.organizacaoId!==empresa.organizacaoId||
    unit.entidadeFiscalId!==entity.id||
    unit.empresaLegadaId!==empresa.id)
  fail("M4C3_TOPOLOGIA_DIVERGENTE");
}
export async function planejarVinculoFiscalLegadoSomenteSandbox(input){
 exigirBancoIsolado();const x=validate(input);
 return prisma.$transaction(async tx=>{
  await guard(tx);await authorize(tx,x);
  const current=await source(tx,x);
  const history=await previous(tx,x);
  return {...current.snapshot,fingerprint:current.fingerprint,
   jaVinculada:!!current.empresa.unidadeOperacionalLegada,
   historicoMigracao:history.importRecord?{
    registroId:history.importRecord.id,
    reversaoLogica:!!history.reverseRecord
   }:null,
   codigoProposto:"LEGADO_"+x.empresaId.replace(/[^A-Za-z0-9]/g,"").slice(-20).toUpperCase(),
   exigeRevisaoHumana:true,cnpjConfirmadoNaReceitaFederal:false,
   fiscalHabilitado:false,operacoesAdicionaisHabilitadas:false};
 },{isolationLevel:"RepeatableRead",timeout:12000});
}
/** Serializable and locked on original Empresa; only assisted CI linking. */
export async function vincularEmpresaLegadaSomenteSandbox(input){
 exigirBancoIsolado();const x=validate(input);
 if(!formatCodigo(x.codigo)||!formatRequest(x.solicitacaoId)||
    !/^[a-f0-9]{64}$/.test(x.fingerprint||""))
  fail("M4C3_APROVACAO_OU_CODIGO_INVALIDO");
 return prisma.$transaction(async tx=>{
  await guard(tx);await lockCompany(tx,x);
  const src=await source(tx,x),history=await previous(tx,x);
  if(src.fingerprint!==x.fingerprint)fail("M4C3_ORIGEM_ALTERADA_DESDE_REVISAO");
  const intended=digest({version:1,codigo:x.codigo,solicitacaoId:x.solicitacaoId,
   fingerprint:src.fingerprint,empresaId:x.empresaId,organizacaoId:x.organizacaoId});
  if(history.reverseRecord)fail("M4C3_JA_REVERTIDA_REQUER_REVISAO_MANUAL");
  if(history.importRecord){
   const old=history.importRecord.dadosNovos;
   if(old?.solicitacaoFingerprint!==intended)
    fail("M4C3_REPETICAO_DIVERGENTE");
   const entity=await tx.entidadeFiscal.findFirst({where:{
    id:old.entidadeFiscalId,organizacaoId:x.organizacaoId
   }});
   const unit=await tx.unidadeOperacional.findFirst({where:{
    id:old.unidadeOperacionalId,organizacaoId:x.organizacaoId
   }});
   validateExistingTopology(src.empresa,entity,unit);
   return response(old,{reutilizado:true});
  }
  if(src.empresa.unidadeOperacionalLegada)
   fail("M4C3_VINCULO_PREEXISTENTE_SEM_RASTRO");
  let entity=await tx.entidadeFiscal.findUnique({where:{
   organizacaoId_cnpj:{organizacaoId:x.organizacaoId,cnpj:src.empresa.cnpj}
  }});
  if(entity&&(!entity.ativo||entity.razaoSocial!==src.empresa.razaoSocial))
   fail("M4C3_EMISSOR_PREEXISTENTE_DIVERGENTE");
  let entityCreated=false;
  if(!entity){
   entity=await tx.entidadeFiscal.create({data:{
    organizacaoId:x.organizacaoId,cnpj:src.empresa.cnpj,
    razaoSocial:src.empresa.razaoSocial
   }});entityCreated=true;
  }
  const used=await tx.unidadeOperacional.findUnique({where:{
   entidadeFiscalId_codigo:{entidadeFiscalId:entity.id,codigo:x.codigo}
  }});
  if(used)fail("M4C3_CODIGO_UNIDADE_JA_EXISTENTE");
  const unit=await tx.unidadeOperacional.create({data:{
   organizacaoId:x.organizacaoId,entidadeFiscalId:entity.id,codigo:x.codigo,
   nome:src.empresa.nomeFantasia,empresaLegadaId:src.empresa.id
  }});
  const saved={solicitacaoFingerprint:intended,organizacaoId:x.organizacaoId,
   empresaId:x.empresaId,entidadeFiscalId:entity.id,
   unidadeOperacionalId:unit.id,codigo:x.codigo,
   fingerprint:src.fingerprint,snapshot:src.snapshot,
   entidadeFiscalCriadaNestaOperacao:entityCreated};
  await tx.auditoria.create({data:{
   organizacaoId:x.organizacaoId,empresaId:x.empresaId,usuarioId:x.usuarioId,
   acao:EVENT_LINK,entidade:"UnidadeOperacional",entidadeId:x.empresaId,
   dadosNovos:saved
  }});
  if(x.simularFalhaAposVinculo===true)
   fail("M4C3_FALHA_SIMULADA_VINCULO");
  return response(saved);
 },{isolationLevel:"Serializable",maxWait:10000,timeout:25000});
}
/**
 * Logical reversal only. DOES NOT delete original issuer/unit or historical
 * commercial rows. An imported company cannot be silently imported again.
 */
export async function reverterVinculoFiscalLegadoSomenteSandbox(input){
 exigirBancoIsolado();const x=validate(input);
 const motivo=typeof x.motivo==="string"?x.motivo.trim():"";
 if(motivo.length<12||motivo.length>500||!formatRequest(x.solicitacaoId))
  fail("M4C3_REVERSAO_MOTIVO_OU_CHAVE_INVALIDOS");
 return prisma.$transaction(async tx=>{
  await guard(tx);await lockCompany(tx,x);
  const history=await previous(tx,x);
  const linked=history.importRecord?.dadosNovos;
  if(!linked)fail("M4C3_SEM_VINCULO_AUDITADO");
  const f=digest({versao:1,solicitacaoId:x.solicitacaoId,motivo,
   fingerprint:linked.fingerprint,unidadeOperacionalId:linked.unidadeOperacionalId});
  if(history.reverseRecord){
   if(history.reverseRecord.dadosNovos?.fingerprintReversao!==f)
    fail("M4C3_REVERSAO_REPETICAO_DIVERGENTE");
   return response(linked,{reutilizado:true,estado:"DESVINCULADA_LOGICAMENTE"});
  }
  const company=await tx.empresa.findFirst({where:{
   id:x.empresaId,organizacaoId:x.organizacaoId,ativo:true
  },include:{unidadeOperacionalLegada:true}});
  const entity=await tx.entidadeFiscal.findFirst({where:{
   id:linked.entidadeFiscalId,organizacaoId:x.organizacaoId
  }});
  validateExistingTopology(company,entity,company?.unidadeOperacionalLegada);
  if(company.unidadeOperacionalLegada.id!==linked.unidadeOperacionalId)
   fail("M4C3_UNIDADE_NAO_CORRESPONDE_A_ORIGEM");
  // Independent units under this issuer stay untouched.
  const changed=await tx.unidadeOperacional.updateMany({where:{
   id:linked.unidadeOperacionalId,organizacaoId:x.organizacaoId,
   entidadeFiscalId:linked.entidadeFiscalId,empresaLegadaId:x.empresaId
  },data:{empresaLegadaId:null,ativa:false}});
  if(changed.count!==1)fail("M4C3_CONCORRENCIA_REVERSAO");
  await tx.auditoria.create({data:{
   organizacaoId:x.organizacaoId,empresaId:x.empresaId,usuarioId:x.usuarioId,
   acao:EVENT_REVERSE,entidade:"UnidadeOperacional",entidadeId:x.empresaId,
   dadosAnteriores:linked,
   dadosNovos:{fingerprintReversao:f,motivo,
    entidadeFiscalId:linked.entidadeFiscalId,
    unidadeOperacionalId:linked.unidadeOperacionalId,
    remocaoFisica:false,emissaoFiscal:false}
  }});
  if(x.simularFalhaAposVinculo===true)
   fail("M4C3_FALHA_SIMULADA_REVERSAO");
  return response(linked,{estado:"DESVINCULADA_LOGICAMENTE"});
 },{isolationLevel:"Serializable",maxWait:10000,timeout:25000});
}
