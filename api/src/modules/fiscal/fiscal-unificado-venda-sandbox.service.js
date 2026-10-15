/**
 * PointVet M.4C.2 — read-only fiscal preparation for an existing CI child
 * sale. No HTTP route. No writes, transmission, provider calls or authorization.
 * Requires one company-specific finalized sale linked to an audited
 * multi-company reservation and the selected organization's customer.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "../pdv/pdv-unificado-venda-sandbox.service.js";
import {prepararFiscalPorVendaFilha} from "./fiscal-unificado-venda.contract.js";

export async function prepararVendaFilhaFiscalSomenteSandbox({
 organizacaoId,empresaId,usuarioId,vendaId,escolhas
}){
 exigirBancoIsolado();
 if(!organizacaoId||!empresaId||!usuarioId||!vendaId)
  throw Error("M4C2_PARAMETROS_INVALIDOS");
 return prisma.$transaction(async tx=>{
  const current=await tx.$queryRawUnsafe("SELECT current_database() AS name");
  if(current[0]?.name!=="pointvet_unified_ci")throw Error("BANCO_NAO_ISOLADO");
  const [actor,link]=await Promise.all([
   tx.usuario.findFirst({where:{id:usuarioId,status:"ATIVO"},select:{id:true}}),
   tx.usuarioEmpresa.findFirst({where:{
    usuarioId,empresaId,ativo:true,empresa:{organizacaoId,ativo:true}
   },include:{cargo:{include:{permissoes:{include:{permissao:true}}}}}})
  ]);
  if(!actor||!link?.cargo?.ativo)throw Error("M4C2_USUARIO_OU_EMPRESA_SEM_ACESSO");
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
 },{isolationLevel:"RepeatableRead",maxWait:5000,timeout:12000});
}
