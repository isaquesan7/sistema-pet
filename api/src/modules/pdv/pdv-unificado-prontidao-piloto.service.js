/**
 * Issue #41 — Diagnóstico somente de leitura para pilotagem de checkout
 * manual em dois CNPJs. Não expõe segredos/IDs de outros tenants, não
 * altera configuração, caixa, estoque ou pagamentos. Não substitui
 * autorização humana para o teste com recebimento externo.
 */
import prisma from "../../config/prisma.js";
import {checkoutManualHabilitado,empresaManualAutorizada} from "./pdv-unificado-checkout-manual.gate.js";

export async function avaliarProntidaoPiloto({organizacao,usuarioId,empresaId},db=prisma){
 const organizacaoId=organizacao?.id;
 if(!organizacaoId||!usuarioId||!empresaId)throw Error("PILOTO_CONTEXTO_INVALIDO");
 const acessos=await db.usuarioEmpresa.findMany({
  where:{
   usuarioId,ativo:true,usuario:{status:"ATIVO"},
   empresa:{organizacaoId,ativo:true},
   cargo:{ativo:true,permissoes:{some:{permissao:{codigo:"pdv.acessar"}}}},
  },
  select:{empresaId:true,empresa:{select:{nomeFantasia:true,tipo:true}}},
 });
 const ids=acessos.map(v=>v.empresaId);
 // Só apresentar CNPJs nos quais o usuário tem permissão ativa de PDV.
 if(!ids.includes(empresaId))throw Error("PILOTO_SEM_ACESSO");
 const [totalEmpresas,sessoes,supervisores]=await Promise.all([
  db.empresa.count({where:{organizacaoId,ativo:true}}),
  db.sessaoCaixa.findMany({
   where:{status:"ABERTO",caixa:{ativo:true,empresaId:{in:ids}}},
   select:{id:true,caixa:{select:{empresaId:true}}}
  }),
  db.usuarioEmpresa.findMany({
   where:{
    empresaId:{in:ids},ativo:true,
    usuario:{status:"ATIVO"},
    empresa:{organizacaoId,ativo:true},
    cargo:{ativo:true,permissoes:{some:{permissao:{codigo:"pdv.cancelar_venda"}}}},
   },
   select:{empresaId:true,usuarioId:true}
  }),
 ]);
 const abertas=new Map();
 for(const s of sessoes)abertas.set(s.caixa.empresaId,(abertas.get(s.caixa.empresaId)||0)+1);
 const supervisoresPorEmpresa=new Set(supervisores.map(s=>s.empresaId));
 const empresas=acessos.map(v=>({
  id:v.empresaId,nomeFantasia:v.empresa.nomeFantasia,tipo:v.empresa.tipo,
  caixaAberto: Boolean(abertas.get(v.empresaId)),
  caixasAbertos:abertas.get(v.empresaId)||0,
  supervisorParaEstorno:supervisoresPorEmpresa.has(v.empresaId),
  empresaNaAllowlist:empresaManualAutorizada(v.empresaId),
  checkoutHabilitado:checkoutManualHabilitado(organizacao,v.empresaId),
 })).sort((a,b)=>a.nomeFantasia.localeCompare(b.nomeFantasia,"pt-BR"));
 const pendencias=[];
 if(!organizacao.configuracao?.pdvUnificadoHabilitado)
  pendencias.push("PREFERENCIA_UNIFICADA_DESATIVADA");
 if(totalEmpresas<2)
  pendencias.push("MENOS_DE_DOIS_CNPJS_ATIVOS");
 if(ids.length!==totalEmpresas)
  pendencias.push("ACESSO_INCOMPLETO_AOS_CNPJS");
 if(empresas.some(e=>!e.caixaAberto))
  pendencias.push("CAIXA_NAO_ABERTO_EM_TODOS_CNPJS");
 if(empresas.some(e=>!e.supervisorParaEstorno))
  pendencias.push("SUPERVISOR_ESTORNO_AUSENTE");
 if(empresas.some(e=>!e.empresaNaAllowlist))
  pendencias.push("ALLOWLIST_EMPRESA_INCOMPLETA");
 if(empresas.some(e=>!e.checkoutHabilitado))
  pendencias.push("CHECKOUT_MANUAL_DESATIVADO");
 return {
  apenasDiagnostico:true,organizacaoId,empresaSelecionadaId:empresaId,
  totalEmpresasAtivas:totalEmpresas,empresasAcessiveis:empresas.length,
  empresas,pendencias,
  condicoesTecnicasAtendidas:pendencias.length===0,
  exigeAutorizacaoHumana:true,
  aviso:"Diagnóstico somente de leitura. Não confirma recebimento, operação fiscal nem autoriza uma venda. Caixas e permissões são revalidados na transação.",
 };
}
