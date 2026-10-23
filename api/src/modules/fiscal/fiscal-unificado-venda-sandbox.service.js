/**
 * PointVet M.4C.2: tenant-scoped, read-only fiscal child-sale preflight.
 * Exposed as a transaction-scoped helper for the CI-only M.4D protocol:
 * the snapshot and intent are generated within the SAME locked transaction.
 * NEVER used in production or HTTP routes.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "../pdv/pdv-unificado-venda-sandbox.service.js";
import {prepararFiscalPorVendaFilha} from "./fiscal-unificado-venda.contract.js";

export async function prepararVendaFilhaFiscalTransacaoSomenteSandbox(tx,{
 organizacaoId,empresaId,usuarioId,vendaId,escolhas
}){
 exigirBancoIsolado();
 if(!organizacaoId||!empresaId||!usuarioId||!vendaId)
  throw Error("M4C2_PARAMETROS_INVALIDOS");
  const current=await tx.$queryRawUnsafe("SELECT current_database() AS name");
  if(current[0]?.name!=="pointvet_unified_ci")throw Error("BANCO_NAO_ISOLADO");
  const [actor,link]=await Promise.all([
   tx.usuario.findFirst({where:{id:usuarioId,status:"ATIVO"},select:{id:true}}),
   tx.usuarioEmpresa.findFirst({where:{
    usuarioId,empresaId,ativo:true,empresa:{organizacaoId,ativo:true}
   },include:{cargo:{include:{permissoes:{include:{permissao:true}}}}}})
  ]);
  if(!actor||!link?.cargo?.ativo||link.cargo.empresaId!==empresaId)throw Error("M4C2_USUARIO_OU_EMPRESA_SEM_ACESSO");
  const codes=new Set(link.cargo.permissoes.map(p=>p.permissao.codigo));
  if(!codes.has("pdv.acessar")||!codes.has("fiscal.visualizar"))
   throw Error("M4C2_PERMISSOES_INSUFICIENTES");
  const venda=await tx.venda.findFirst({where:{
   id:vendaId,empresaId,status:"FINALIZADA",
   empresa:{organizacaoId,ativo:true},
   cliente:{organizacaoId,ativo:true},
   comanda:{rascunhoUnificado:true,status:"FECHADA",cliente:{organizacaoId}}
  },include:{
   empresa:{include:{configuracaoFiscal:true,
    unidadeOperacionalLegada:{include:{entidadeFiscal:true}}}},
   itens:{include:{itemCatalogo:{include:{fiscalConfig:true}}}},
   documentosFiscais:{select:{id:true,status:true}},
   operacaoUnificada:{include:{reserva:{select:{
    comandaId:true,versaoRascunho:true,status:true
   }}}}
  }});
  if(!venda)throw Error("M4C2_VENDA_FILHA_NAO_ENCONTRADA");
  const operation=venda.operacaoUnificada;
  if(!operation||operation.status!=="CONCLUIDA"||
     operation.empresaId!==empresaId||operation.vendaId!==venda.id||
     operation.reserva.comandaId!==venda.comandaId||
     operation.reserva.status!=="RESERVADA")
   throw Error("M4C2_ORIGEM_UNIFICADA_INVALIDA");
  const plan=prepararFiscalPorVendaFilha({organizacaoId,venda,escolhas});
  return {...plan,execucaoApenasCi:true,reutilizavelSemPersistencia:true,
   documentoPendenteDeHomologacao:true,emissaoDisponivel:false};
}
export async function prepararVendaFilhaFiscalSomenteSandbox(args){
 exigirBancoIsolado();
 return prisma.$transaction(
  tx=>prepararVendaFilhaFiscalTransacaoSomenteSandbox(tx,args),
  {isolationLevel:"RepeatableRead",maxWait:5000,timeout:12000}
 );
}
