/**
 * PointVet M.5.24 — conservative READ-ONLY documentary/fiscal gap review.
 * Compares two independently authorized projections and fails CLOSED if their
 * observations disagree. No uploaded evidence or external-bank verification.
 * A matched internal ledger NEVER constitutes refund/fiscal approval.
 */
import {createHash} from "node:crypto";
import {centavosM522,reaisM522} from "./pdv-unificado-devolucao-declarada.contract.js";
const fail=x=>{throw Error("M524_"+x);};
const valid=x=>typeof x==="string"&&x.trim().length>0;
const sha=/^[a-f0-9]{64}$/;
const convert={
 AGUARDANDO_SEGUNDA_CONFERENCIA:"SEM_REPASSE_INTERNO",
 SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA:"SEM_REPASSE_INTERNO",
 REPASSE_INTERNO_CONFIRMADO_MANUALMENTE:"REPASSE_INTERNO_ATIVO",
 CORRECAO_INTERNA_REGISTRADA:"REPASSE_INTERNO_COMPENSADO"
};
const money=v=>centavosM522(v);
export function diagnosticarDivergenciasDevolucoesM524({
 organizacaoId,empresaId,comandaId,fluxo,historico
}={}){
 if(![organizacaoId,empresaId,comandaId].every(valid)||
    fluxo?.fase!=="M5_16_FLUXO_OPERACIONAL_READ_ONLY"||
    fluxo.leituraSomente!==true||
    fluxo.integracaoBancaria!==false||
    fluxo.checkoutDisponivel!==false||
    !Array.isArray(fluxo.preparacoes)||fluxo.preparacoes.length>50||
    historico?.fase!=="M5_23_HISTORICO_DEVOLUCOES_EXTERNA_READ_ONLY"||
    historico.organizacaoId!==organizacaoId||
    historico.empresaId!==empresaId||historico.comandaId!==comandaId||
    historico.leituraSomente!==true||
    historico.bancoVerificadoIndependentemente!==false||
    historico.permiteNovoReembolso!==false||
    !Array.isArray(historico.preparacoes)||historico.preparacoes.length>50||
    fluxo.preparacoes.length!==historico.preparacoes.length)
  fail("FONTES_DESATUALIZADAS_OU_SEM_AUTORIZACAO");
 const byPrep=new Map();
 for(const h of historico.preparacoes){
  if(!h?.preparacaoId||byPrep.has(h.preparacaoId)||
     !Array.isArray(h.movimentos)||h.quantidadeDeclaracoes!==h.movimentos.length)
   fail("HISTORICO_INCOMPLETO");
  byPrep.set(h.preparacaoId,h);
 }
 let brutoTotal=0,declaradoTotal=0,naoDeclaradoTotal=0,declaracoesTotal=0;
 const preparados=fluxo.preparacoes.map(p=>{
  const h=byPrep.get(p.preparacaoId);
  if(!h||p.empresaId!==empresaId||p.comandaId!==comandaId||
     p.referenciaExtrato!==h.referenciaExtrato||
     !Object.hasOwn(convert,p.etapa)||
     convert[p.etapa]!==h.estadoRepasseInterno||
     !sha.test(p.revisaoFinanceira?.codigoRevisao||"")||
     p.revisaoFinanceira.etapaRevisada!==p.etapa||
     p.revisaoFinanceira.valorLiquidoEsperado!==p.valorLiquido||
     p.revisaoFinanceira.habilitaCheckout!==false||
     p.provaBancariaAutomatica!==false||
     p.habilitadoParaEscrita!==false)
   fail("ETAPAS_E_REVISOES_DIVERGENTES");
  const bruto=money(p.valorBruto),tarifa=money(p.tarifaCartao);
  const antecipacao=money(p.descontoAntecipacao),liquido=money(p.valorLiquido);
  const hBruto=money(h.brutoOriginal),declarado=money(h.totalDevolucoesDeclaradas),
   semDeclaracao=money(h.brutoSemDeclaracaoNoLivro);
  if(bruto===0||liquido===0||bruto!==tarifa+antecipacao+liquido||
     bruto!==hBruto||declarado+semDeclaracao!==bruto||
     (declarado>0&&p.etapa!=="REPASSE_INTERNO_CONFIRMADO_MANUALMENTE")||
     !["ANTECIPACAO","REPASSE_NORMAL"].includes(p.tipo)||
     (p.tipo==="REPASSE_NORMAL"&&antecipacao!==0)||
     (p.tipo==="ANTECIPACAO"&&antecipacao===0))
   fail("COMPOSICAO_E_HISTORICO_DIVERGENTES");
  const fromRows=h.movimentos.reduce((n,m)=>{
   if(!valid(m.referenciaExterna)||!valid(m.usuarioId)||
      m.tipo!=="DECLARACAO_DE_DEVOLUCAO_EXTERNA_NAO_VERIFICADA")
    fail("DECLARACAO_INVALIDA");
   const value=money(m.valorBrutoDeclarado);
   if(value===0||!Number.isSafeInteger(n+value))
    fail("VALOR_DECLARADO_INVALIDO");
   return n+value;
  },0);
  if(fromRows!==declarado)fail("HISTORICO_SEM_FECHAMENTO");
  const gaps=[];
  if(h.movimentos.length){
   gaps.push("COMPROVANTES_EXTERNOS_NAO_VERIFICADOS");
   gaps.push("BENEFICIARIO_E_MEIO_DEVOLUCAO_NAO_COMPROVADOS");
   gaps.push("CONFERENCIA_INDEPENDENTE_NAO_REALIZADA");
  }
  if(semDeclaracao>0)
   gaps.push("HISTORICO_EXTERNO_PODE_ESTAR_INCOMPLETO");
  if(h.movimentos.length||p.etapa==="CORRECAO_INTERNA_REGISTRADA")
   gaps.push("TRATAMENTO_FISCAL_POR_EMISSOR_PENDENTE");
  if(tarifa>0&&(h.movimentos.length||p.etapa==="CORRECAO_INTERNA_REGISTRADA"))
   gaps.push("RECUPERACAO_TARIFA_NAO_VERIFICADA");
  if(antecipacao>0&&(h.movimentos.length||p.etapa==="CORRECAO_INTERNA_REGISTRADA"))
   gaps.push("RECUPERACAO_ANTECIPACAO_NAO_VERIFICADA");
  if(!h.movimentos.length&&p.etapa!=="CORRECAO_INTERNA_REGISTRADA")
   gaps.push("NENHUMA_DEVOLUCAO_EXTERNA_CONFERIDA");
  brutoTotal+=bruto;declaradoTotal+=declarado;
  naoDeclaradoTotal+=semDeclaracao;declaracoesTotal+=h.movimentos.length;
  if(![brutoTotal,declaradoTotal,naoDeclaradoTotal].every(Number.isSafeInteger))
   fail("SOMA_FORA_DO_LIMITE");
  return Object.freeze({
   preparacaoId:p.preparacaoId,referenciaExtrato:p.referenciaExtrato,
   etapaInterna:p.etapa,codigoRevisaoFinanceira:p.revisaoFinanceira.codigoRevisao,
   brutoOriginal:reaisM522(bruto),tarifaInformada:reaisM522(tarifa),
   descontoAntecipacaoInformado:reaisM522(antecipacao),
   repasseLiquidoInterno:reaisM522(liquido),
   devolucoesDeclaradas:reaisM522(declarado),
   brutoSemDeclaracaoNoLivro:reaisM522(semDeclaracao),
   quantidadeDeclaracoes:h.movimentos.length,
   situacaoConferencia:"PENDENTE_EVIDENCIAS_EXTERNAS_E_REVISAO_FISCAL",
   pendencias:Object.freeze(gaps),
   provaExternaValidada:false,
   enquadramentoFiscalAprovado:false,
   tarifasRecuperadasConfirmadas:false,
   permiteEstornar:false,permiteBaixar:false
  });
 });
 if(brutoTotal!==money(historico.totais?.brutoPreparacoes)||
    declaradoTotal!==money(historico.totais?.devolucoesDeclaradas)||
    naoDeclaradoTotal!==money(historico.totais?.brutoSemDeclaracaoNoLivro)||
    declaracoesTotal!==historico.totais?.quantidadeDeclaracoes)
  fail("TOTAIS_ENTRE_FONTES_DIVERGENTES");
 const overview={versao:"M5_24_CONFERENCIA_EXTERNA_READ_ONLY",
  organizacaoId,empresaId,comandaId,
  revisoes:preparados.map(p=>({
   preparacaoId:p.preparacaoId,
   codigoRevisaoFinanceira:p.codigoRevisaoFinanceira,
   devolucoesDeclaradas:p.devolucoesDeclaradas,
   brutoSemDeclaracaoNoLivro:p.brutoSemDeclaracaoNoLivro,
   quantidadeDeclaracoes:p.quantidadeDeclaracoes
  }))};
 const codigoDiagnostico=createHash("sha256").update(JSON.stringify(overview)).digest("hex");
 return Object.freeze({
  fase:overview.versao,organizacaoId,empresaId,comandaId,
  codigoDiagnostico,
  preparacoes:Object.freeze(preparados),
  totais:Object.freeze({
   brutoOriginal:reaisM522(brutoTotal),
   declaracoesExternasNaoVerificadas:reaisM522(declaradoTotal),
   brutoSemDeclaracaoNoLivro:reaisM522(naoDeclaradoTotal),
   quantidadeDeclaracoes:declaracoesTotal
  }),
  confrontoDeDocumentosExternosRealizado:false,
  todasDevolucoesExternasConhecidas:false,
  politicaFiscalHomologada:false,
  recuperacoesTarifasConfirmadas:false,
  habilitaRegistroDeDevolucao:false,
  habilitaCheckout:false,
  fazMovimentacaoBancaria:false,
  geraDocumentoFiscal:false,
  leituraSomente:true
 });
}
