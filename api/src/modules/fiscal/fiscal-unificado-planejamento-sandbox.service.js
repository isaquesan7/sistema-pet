/**
 * PointVet M.4C.1 — read-only segregated fiscal preflight over a persisted
 * multi-company draft. Isolated PostgreSQL CI ONLY, NEVER mounted in HTTP.
 * Does not create Venda, DocumentoFiscal, invoice, or payment.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "../pdv/pdv-unificado-venda-sandbox.service.js";
import {planejarMatrizFiscalRascunho} from "./fiscal-unificado-planejamento.contract.js";

export async function planejarFiscalRascunhoUnificadoSomenteSandbox({
 organizacaoId,usuarioId,empresaId,comandaId,versao
}){
 exigirBancoIsolado();
 if(!organizacaoId||!usuarioId||!empresaId||!comandaId||
   !Number.isInteger(versao)||versao<1)throw Error("M4C_PARAMETROS_INVALIDOS");
 return prisma.$transaction(async tx=>{
  const database=await tx.$queryRawUnsafe("SELECT current_database() AS nome");
  if(database[0]?.nome!=="pointvet_unified_ci")throw Error("BANCO_NAO_ISOLADO");
  const actor=await tx.usuario.findFirst({where:{
   id:usuarioId,status:"ATIVO"
  },select:{id:true}});
  if(!actor)throw Error("M4C_USUARIO_INATIVO");
  const draft=await tx.comanda.findFirst({where:{
   id:comandaId,rascunhoUnificado:true,
   cliente:{organizacaoId,ativo:true}
  },include:{
   cliente:{select:{id:true,organizacaoId:true}},
   vendas:{select:{id:true}},
   itens:{include:{itemCatalogo:{
    include:{fiscalConfig:true}
   }}}
  }});
  if(!draft)throw Error("M4C_RASCUNHO_NAO_ENCONTRADO");
  if(draft.versaoRascunho!==versao)throw Error("M4C_VERSAO_DESATUALIZADA");
  if(draft.status!=="ABERTA"||draft.vendas.length||!draft.itens.length)
   throw Error("M4C_RASCUNHO_BLOQUEADO");
  const reserved=await tx.reservaFechamentoUnificado.count({
   where:{comandaId,status:"RESERVADA"}
  });
  if(reserved)throw Error("M4C_RASCUNHO_RESERVADO");
  const companyIds=[...new Set(draft.itens.map(i=>i.empresaId))];
  if(!companyIds.includes(empresaId))throw Error("M4C_EMPRESA_SELECIONADA_DIVERGENTE");
  const [companies,access]=await Promise.all([
   tx.empresa.findMany({where:{id:{in:companyIds},organizacaoId,ativo:true},
    include:{configuracaoFiscal:true,
     unidadeOperacionalLegada:{include:{entidadeFiscal:true}}}}),
   tx.usuarioEmpresa.findMany({where:{
    usuarioId,empresaId:{in:companyIds},ativo:true,
    empresa:{organizacaoId,ativo:true}
   },include:{cargo:{include:{permissoes:{include:{permissao:true}}}}}})
  ]);
  if(companies.length!==companyIds.length)throw Error("M4C_EMPRESA_OUTRO_TENANT");
  const permitted=new Set(access.filter(link=>{
   const codes=new Set(link.cargo?.ativo?
    link.cargo.permissoes.map(p=>p.permissao.codigo):[]);
   return codes.has("pdv.acessar")&&codes.has("fiscal.visualizar");
  }).map(link=>link.empresaId));
  if(companyIds.some(id=>!permitted.has(id)))
   throw Error("M4C_PERMISSAO_FISCAL_EMPRESA_INSUFICIENTE");
  const projected=planejarMatrizFiscalRascunho({
   organizacaoId,clienteId:draft.clienteId,comandaId,versao,
   empresas:companies,linhas:draft.itens
  });
  return {...projected,bancoIsolado:true,
   naoGerouDocumento:true,naoMovimentouCaixa:true,naoMovimentouEstoque:true,
   permiteEmissao:false};
 },{isolationLevel:"RepeatableRead",maxWait:5000,timeout:15000});
}
