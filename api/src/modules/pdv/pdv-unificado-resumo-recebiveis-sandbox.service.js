/**
 * PointVet M.5.6 — diagnóstico financeiro sem I/O externo, APENAS CI.
 * Leitura read-only em snapshot RepeatableRead do PostgreSQL descartável.
 * Por organização, empresa e comanda; sem endpoint HTTP nem lançamentos.
 */
import prisma from "../../config/prisma.js";
import {exigirBancoIsolado} from "./pdv-unificado-venda-sandbox.service.js";
import {consolidarRecebiveisCartaoM56} from "./pdv-unificado-resumo-recebiveis.contract.js";
const fail=code=>{throw Error(code);};
export async function consultarResumoRecebiveisCartaoSomenteSandbox({
 organizacaoId,empresaId,usuarioId,comandaId
}={}){
 exigirBancoIsolado();
 if([organizacaoId,empresaId,usuarioId,comandaId].some(x=>typeof x!=="string"||!x.trim()))
  fail("M56_CONTEXTO_INVALIDO");
 return prisma.$transaction(async tx=>{
  const db=await tx.$queryRaw`SELECT current_database() AS nome`;
  if(db[0]?.nome!=="pointvet_unified_ci")fail("M56_BANCO_NAO_ISOLADO");
  const [user,org,orgLink,companyLink]=await Promise.all([
   tx.usuario.findUnique({where:{id:usuarioId},select:{status:true}}),
   tx.organizacao.findUnique({where:{id:organizacaoId},select:{ativo:true}}),
   tx.usuarioOrganizacao.findUnique({where:{
    usuarioId_organizacaoId:{usuarioId,organizacaoId}},select:{ativo:true}}),
   tx.usuarioEmpresa.findUnique({where:{
    usuarioId_empresaId:{usuarioId,empresaId}},include:{
     empresa:{select:{ativo:true,organizacaoId:true}},
     cargo:{include:{permissoes:{include:{permissao:{select:{codigo:true}}}}}}}}})
  ]);
  if(user?.status!=="ATIVO"||!org?.ativo||!orgLink?.ativo||
     !companyLink?.ativo||!companyLink.empresa?.ativo||
     companyLink.empresa.organizacaoId!==organizacaoId||
     !companyLink.cargo?.ativo||
     !companyLink.cargo.permissoes.some(x=>x.permissao.codigo==="financeiro.gerenciar"))
   fail("M56_SEM_ACESSO_FINANCEIRO");
  const comanda=await tx.comanda.findFirst({where:{
   id:comandaId,rascunhoUnificado:true,cliente:{organizacaoId}
  },select:{id:true,status:true}});
  if(!comanda)fail("M56_COMANDA_NAO_ENCONTRADA");
  const registros=await tx.linhaRecebimentoManualUnificado.findMany({
   where:{forma:"CARTAO_CREDITO",operacao:{empresaId,reserva:{comandaId}}},
   include:{
    pagamento:{select:{id:true,forma:true,status:true,valor:true,parcelas:true,vendaId:true}},
    registro:{select:{status:true}},
    operacao:{include:{
     venda:{select:{id:true,empresaId:true,status:true}},
     reserva:{select:{comandaId:true,status:true}}
    }},
    parcelasRecebiveis:{orderBy:{indice:"asc"}}
   },
   orderBy:{id:"asc"}
  });
  const parcelIds=registros.flatMap(r=>r.parcelasRecebiveis.map(p=>p.id));
  const audits=parcelIds.length?await tx.auditoria.findMany({where:{
   organizacaoId,empresaId,acao:"REPASSE_CARTAO_CONCILIADO_MANUAL_CI",
   entidade:"ParcelaRecebivelManualUnificado",entidadeId:{in:parcelIds}
  },select:{acao:true,entidade:true,entidadeId:true,empresaId:true,
   organizacaoId:true,dadosNovos:true}}):[];
  return consolidarRecebiveisCartaoM56({organizacaoId,empresaId,comandaId,
   linhas:registros.map(r=>({...r,comandaStatus:comanda.status})),auditorias:audits});
 },{isolationLevel:"RepeatableRead",maxWait:8000,timeout:12000});
}
