/**
 * PointVet M.5.7 — consultas read-only de recebíveis de cartão por empresa.
 * Não disponibiliza checkout ou conciliação: nunca escreve em tabelas.
 * Segurança por tenant, empresa, membro ativo e financeiro.gerenciar.
 */
import prisma from "../../config/prisma.js";
import {consolidarRecebiveisCartaoM56} from "./pdv-unificado-resumo-recebiveis.contract.js";
const falha=c=>{throw Error(c);};
function validar(ids){
 if(ids.some(x=>typeof x!=="string"||!x.trim()))falha("M57_CONTEXTO_INVALIDO");
}
async function autorizar(tx,{organizacaoId,empresaId,usuarioId}){
 const [usuario,org,membro,vinculo]=await Promise.all([
  tx.usuario.findUnique({where:{id:usuarioId},select:{status:true}}),
  tx.organizacao.findUnique({where:{id:organizacaoId},select:{ativo:true,configuracao:{select:{pdvUnificadoHabilitado:true}}}}),
  tx.usuarioOrganizacao.findUnique({where:{usuarioId_organizacaoId:{usuarioId,organizacaoId}},select:{ativo:true}}),
  tx.usuarioEmpresa.findUnique({
   where:{usuarioId_empresaId:{usuarioId,empresaId}},
   include:{
    empresa:{select:{ativo:true,organizacaoId:true}},
    cargo:{include:{permissoes:{include:{permissao:{select:{codigo:true}}}}}}
   }
  })
 ]);
 if(usuario?.status!=="ATIVO"||!org?.ativo||!membro?.ativo||
    !vinculo?.ativo||!vinculo.empresa?.ativo||
    vinculo.empresa.organizacaoId!==organizacaoId||!vinculo.cargo?.ativo||
    !vinculo.cargo.permissoes.some(x=>x.permissao.codigo==="financeiro.gerenciar"))
  falha("M57_SEM_ACESSO_FINANCEIRO");
 if(!org.configuracao?.pdvUnificadoHabilitado)
  falha("M57_PREFERENCIA_DESATIVADA");
}
export async function consultarRecebiveisCartaoLeituraM57({organizacaoId,empresaId,usuarioId,comandaId}={}){
 validar([organizacaoId,empresaId,usuarioId,comandaId]);
 return prisma.$transaction(async tx=>{
  await autorizar(tx,{organizacaoId,empresaId,usuarioId});
  const comanda=await tx.comanda.findFirst({where:{
   id:comandaId,rascunhoUnificado:true,cliente:{organizacaoId}
  },select:{id:true,status:true}});
  if(!comanda)falha("M57_COMANDA_NAO_ENCONTRADA");
  const linhas=await tx.linhaRecebimentoManualUnificado.findMany({
   where:{forma:"CARTAO_CREDITO",operacao:{empresaId,reserva:{comandaId}}},
   include:{
    pagamento:{select:{id:true,forma:true,status:true,valor:true,parcelas:true,vendaId:true}},
    registro:{select:{status:true}},
    operacao:{include:{
     venda:{select:{id:true,empresaId:true,status:true}},
     reserva:{select:{comandaId:true,status:true}}
    }},
    parcelasRecebiveis:{orderBy:{indice:"asc"}}
   },orderBy:{id:"asc"}
  });
  const ids=linhas.flatMap(x=>x.parcelasRecebiveis.map(p=>p.id));
  const auditorias=ids.length?await tx.auditoria.findMany({where:{
   organizacaoId,empresaId,acao:"REPASSE_CARTAO_CONCILIADO_MANUAL_CI",
   entidade:"ParcelaRecebivelManualUnificado",entidadeId:{in:ids}
  },select:{acao:true,entidade:true,entidadeId:true,empresaId:true,organizacaoId:true,dadosNovos:true}}):[];
  return consolidarRecebiveisCartaoM56({organizacaoId,empresaId,comandaId,
   linhas:linhas.map(x=>({...x,comandaStatus:comanda.status})),auditorias});
 },{isolationLevel:"RepeatableRead",maxWait:8000,timeout:12000});
}
export async function listarComandasRecebiveisCartaoLeituraM57({organizacaoId,empresaId,usuarioId}={}){
 validar([organizacaoId,empresaId,usuarioId]);
 return prisma.$transaction(async tx=>{
  await autorizar(tx,{organizacaoId,empresaId,usuarioId});
  const registros=await tx.reservaOperacaoUnificada.findMany({
   where:{empresaId,reserva:{comanda:{rascunhoUnificado:true,cliente:{organizacaoId}}},
    recebimentosManuais:{some:{forma:"CARTAO_CREDITO"}}},
   select:{reserva:{select:{comanda:{select:{id:true,numero:true,status:true}}}}},
   orderBy:[{createdAt:"desc"},{id:"desc"}],take:20
  });
  const seen=new Set();
  return registros.flatMap(x=>{
   const comanda=x.reserva?.comanda;
   if(!comanda||seen.has(comanda.id))return [];
   seen.add(comanda.id);
   return [{id:comanda.id,numero:comanda.numero,status:comanda.status}];
  });
 },{isolationLevel:"RepeatableRead",maxWait:8000,timeout:12000});
}
