/**
 * PointVet M.5.27 — read-only dossier for INDEPENDENT HUMAN document review.
 * Combines M.5.23 ledger with M.5.24 diagnosis from the SAME authorized DB
 * snapshot. It does NOT inspect attachments, bank accounts or fiscal systems.
 * A dossier is an actionable checklist, NEVER a refund or approval command.
 */
import {createHash} from "node:crypto";
import {centavosM522,reaisM522} from "./pdv-unificado-devolucao-declarada.contract.js";

const fail=code=>{throw Error("M527_"+code);};
const str=x=>typeof x==="string"&&x.trim().length>0;
const hex=/^[a-f0-9]{64}$/;
const hash=obj=>createHash("sha256").update(JSON.stringify(obj)).digest("hex");
const stages={
 AGUARDANDO_SEGUNDA_CONFERENCIA:"SEM_REPASSE_INTERNO",
 SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA:"SEM_REPASSE_INTERNO",
 REPASSE_INTERNO_CONFIRMADO_MANUALMENTE:"REPASSE_INTERNO_ATIVO",
 CORRECAO_INTERNA_REGISTRADA:"REPASSE_INTERNO_COMPENSADO"
};
const safeMoney=v=>{
 try{return centavosM522(v);}catch{fail("VALOR_INVALIDO");}
};
const checklist=Object.freeze([
 "OBTER_COMPROVANTE_FORA_DO_POINTVET",
 "CONFERIR_VALOR_DATA_REFERENCIA_E_DESTINATARIO",
 "VERIFICAR_EXTRATO_EXTERNAMENTE_SEM_INTEGRACAO",
 "DESIGNAR_SEGUNDO_CONFERENTE_DIFERENTE_DO_DECLARANTE",
 "ENCAMINHAR_TRATAMENTO_CONTABIL_E_FISCAL_POR_CNPJ"
]);

export function montarDossieDevolucoesM527({diagnostico,historico}={}){
 if(diagnostico?.fase!=="M5_24_CONFERENCIA_EXTERNA_READ_ONLY"||
    ![diagnostico.organizacaoId,diagnostico.empresaId,diagnostico.comandaId].every(str)||
    !hex.test(diagnostico.codigoDiagnostico||"")||
    diagnostico.leituraSomente!==true||
    diagnostico.confrontoDeDocumentosExternosRealizado!==false||
    diagnostico.habilitaRegistroDeDevolucao!==false||
    diagnostico.habilitaCheckout!==false||
    diagnostico.fazMovimentacaoBancaria!==false||
    diagnostico.geraDocumentoFiscal!==false||
    historico?.fase!=="M5_23_HISTORICO_DEVOLUCOES_EXTERNA_READ_ONLY"||
    historico.organizacaoId!==diagnostico.organizacaoId||
    historico.empresaId!==diagnostico.empresaId||
    historico.comandaId!==diagnostico.comandaId||
    historico.leituraSomente!==true||
    historico.bancoVerificadoIndependentemente!==false||
    historico.permiteNovoReembolso!==false||
    !Array.isArray(diagnostico.preparacoes)||
    !Array.isArray(historico.preparacoes)||
    diagnostico.preparacoes.length>50||
    historico.preparacoes.length!==diagnostico.preparacoes.length)
  fail("FONTES_NAO_CONFIAVEIS");

 // Verify the M.5.24 checksum against its own review projection, not only
 // its syntax. This guards against accidental mismatched/stale handoffs.
 const sourceHash=hash({versao:diagnostico.fase,
  organizacaoId:diagnostico.organizacaoId,empresaId:diagnostico.empresaId,
  comandaId:diagnostico.comandaId,
  revisoes:diagnostico.preparacoes.map(p=>({
   preparacaoId:p.preparacaoId,codigoRevisaoFinanceira:p.codigoRevisaoFinanceira,
   devolucoesDeclaradas:p.devolucoesDeclaradas,
   brutoSemDeclaracaoNoLivro:p.brutoSemDeclaracaoNoLivro,
   quantidadeDeclaracoes:p.quantidadeDeclaracoes
  }))});
 if(sourceHash!==diagnostico.codigoDiagnostico)
  fail("DIAGNOSTICO_ADULTERADO");

 const byId=new Map();
 for(const h of historico.preparacoes){
  if(!str(h?.preparacaoId)||byId.has(h.preparacaoId)||
     !Array.isArray(h.movimentos)||h.movimentos.length>500)
   fail("HISTORICO_AMBIGUO");
  byId.set(h.preparacaoId,h);
 }
 const usedMovement=new Set(),usedRef=new Set();
 let total=0,remainingTotal=0,declarations=0;
 const dossiers=diagnostico.preparacoes.map(p=>{
  const h=byId.get(p?.preparacaoId);
  if(!h||!hex.test(p.codigoRevisaoFinanceira||"")||
     p.referenciaExtrato!==h.referenciaExtrato||
     !Object.hasOwn(stages,p.etapaInterna)||
     stages[p.etapaInterna]!==h.estadoRepasseInterno||
     p.situacaoConferencia!=="PENDENTE_EVIDENCIAS_EXTERNAS_E_REVISAO_FISCAL"||
     p.provaExternaValidada!==false||p.enquadramentoFiscalAprovado!==false||
     p.permiteEstornar!==false||p.permiteBaixar!==false||
     !Array.isArray(p.pendencias)||
     p.quantidadeDeclaracoes!==h.movimentos.length||
     h.quantidadeDeclaracoes!==h.movimentos.length)
   fail("PREPARACAO_DIVERGENTE");
  let bruto=safeMoney(h.brutoOriginal),saldo=bruto,soma=0;
  if(bruto!==safeMoney(p.brutoOriginal)||
     safeMoney(p.devolucoesDeclaradas)!==safeMoney(h.totalDevolucoesDeclaradas)||
     safeMoney(p.brutoSemDeclaracaoNoLivro)!==safeMoney(h.brutoSemDeclaracaoNoLivro)||
     (h.movimentos.length&&!p.pendencias.includes("CONFERENCIA_INDEPENDENTE_NAO_REALIZADA")))
   fail("VALORES_DIVERGENTES");
  const movimentos=h.movimentos.map(m=>{
   const ts=new Date(m?.registradoEm);
   const value=safeMoney(m?.valorBrutoDeclarado);
   const rest=safeMoney(m?.saldoBrutoNaoDeclaradoApos);
   if(!str(m?.id)||usedMovement.has(m.id)||
      !str(m.referenciaExterna)||usedRef.has(m.referenciaExterna)||
      !str(m.usuarioId)||
      m.tipo!=="DECLARACAO_DE_DEVOLUCAO_EXTERNA_NAO_VERIFICADA"||
      !Number.isFinite(ts.getTime())||ts.toISOString()!==m.registradoEm||
      value<=0||saldo-value!==rest)
    fail("MOVIMENTO_DIVERGENTE");
   usedMovement.add(m.id);usedRef.add(m.referenciaExterna);
   saldo=rest;soma+=value;
   return Object.freeze({declaracaoId:m.id,referenciaInformada:m.referenciaExterna,
    valorDeclarado:reaisM522(value),registradoEm:m.registradoEm,
    declaranteUsuarioId:m.usuarioId,
    checklistPendente:checklist,comprovanteVerificado:false,
    revisorIndependenteConfirmado:false});
  });
  if(soma!==safeMoney(h.totalDevolucoesDeclaradas)||
     saldo!==safeMoney(h.brutoSemDeclaracaoNoLivro)||
     soma+saldo!==bruto)
   fail("FECHAMENTO_DIVERGENTE");
  total+=soma;remainingTotal+=saldo;declarations+=movimentos.length;
  if(!Number.isSafeInteger(total)||!Number.isSafeInteger(remainingTotal))
   fail("LIMITE_MONETARIO");
  return Object.freeze({preparacaoId:p.preparacaoId,
   referenciaRepasseInformada:p.referenciaExtrato,
   codigoRevisaoFinanceira:p.codigoRevisaoFinanceira,
   brutoOriginal:reaisM522(bruto),
   devolucoesDeclaradas:reaisM522(soma),
   brutoSemDeclaracao:reaisM522(saldo),
   declaracoes:Object.freeze(movimentos),
   pendencias:Object.freeze([...p.pendencias]),
   conferidoExternamente:false,duplaConferenciaConcluida:false});
 });
 if(declarations!==historico.totais?.quantidadeDeclaracoes||
    declarations!==diagnostico.totais?.quantidadeDeclaracoes||
    total!==safeMoney(historico.totais?.devolucoesDeclaradas)||
    total!==safeMoney(diagnostico.totais?.declaracoesExternasNaoVerificadas)||
    remainingTotal!==safeMoney(historico.totais?.brutoSemDeclaracaoNoLivro)||
    remainingTotal!==safeMoney(diagnostico.totais?.brutoSemDeclaracaoNoLivro))
  fail("TOTAIS_DIVERGENTES");
 const versao="M5_27_DOSSIE_REVISAO_INDEPENDENTE_READ_ONLY";
 const proof={versao,organizacaoId:diagnostico.organizacaoId,
  empresaId:diagnostico.empresaId,comandaId:diagnostico.comandaId,
  codigoDiagnosticoOrigem:diagnostico.codigoDiagnostico,
  preparacoes:dossiers.map(p=>({
   preparacaoId:p.preparacaoId,codigoRevisaoFinanceira:p.codigoRevisaoFinanceira,
   declaracoes:p.declaracoes.map(m=>({
    declaracaoId:m.declaracaoId,referenciaInformada:m.referenciaInformada,
    valorDeclarado:m.valorDeclarado,registradoEm:m.registradoEm,
    declaranteUsuarioId:m.declaranteUsuarioId
   }))
  }))};
 return Object.freeze({fase:versao,organizacaoId:diagnostico.organizacaoId,
  empresaId:diagnostico.empresaId,comandaId:diagnostico.comandaId,
  codigoDiagnosticoOrigem:diagnostico.codigoDiagnostico,
  codigoDossie:hash(proof),preparacoes:Object.freeze(dossiers),
  totais:Object.freeze({valorDeclaradoSemProva:reaisM522(total),
   brutoSemDeclaracao:reaisM522(remainingTotal),quantidadeDeclaracoes:declarations}),
  exigeConferenciaHumanaExterna:true,provasBancariasValidas:false,
  revisaoFiscalHomologada:false,permiteConcluirRevisao:false,
  permiteNovoReembolso:false,permiteLancamentoFinanceiro:false,
  permiteOperacaoFiscal:false,habilitaCheckout:false,leituraSomente:true});
}
