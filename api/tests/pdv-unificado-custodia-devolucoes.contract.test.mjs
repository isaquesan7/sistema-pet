import {test} from "node:test";
import assert from "node:assert/strict";
import {planejarCustodiaDevolucoesM529 as plan}
 from "../src/modules/pdv/pdv-unificado-custodia-devolucoes.contract.js";

const dossie=()=>({
 fase:"M5_27_DOSSIE_REVISAO_INDEPENDENTE_READ_ONLY",
 organizacaoId:"organizacao-ci",empresaId:"empresa-ci",comandaId:"comanda-ci",
 codigoDossie:"a".repeat(64),leituraSomente:true,
 provasBancariasValidas:false,revisaoFiscalHomologada:false,
 permiteConcluirRevisao:false,permiteNovoReembolso:false,
 permiteLancamentoFinanceiro:false,permiteOperacaoFiscal:false,
 habilitaCheckout:false,
 preparacoes:[{preparacaoId:"preparacao-ci",declaracoes:[{
  declaracaoId:"devolucao-ci",comprovanteVerificado:false,
  revisorIndependenteConfirmado:false,
  referenciaInformada:"CI-SHOULD-NOT-LEAK",declaranteUsuarioId:"ci-person"
 }]}],totais:{quantidadeDeclaracoes:1}
});
const parecer=()=>({id:"parecer-ci",organizacaoId:"organizacao-ci",
 empresaId:"empresa-ci",comandaId:"comanda-ci",devolucaoId:"devolucao-ci",
 conferenteId:"auditor-ci",codigoDossie:"a".repeat(64),
 fingerprint:"b".repeat(64),status:"CONFERENCIA_DOCUMENTAL_DECLARADA_CI",
 evidenciaReferencia:"CI-EVIDENCE-PRIVATE-NO-LEAK",
 evidenciaSha256:"c".repeat(64)
});

test("M.5.29 drafts privacy/custody gates without retention, storage or authority",()=>{
 const draft=plan({dossie:dossie()});
 assert.equal(draft.devolucoes[0].estado,"SEM_PARECER_CI");
 assert.equal(draft.contagem.pareceresDeclarados,0);
 assert.equal(draft.estadoPolitica,"AGUARDANDO_DEFINICAO_JURIDICA_E_HOMOLOGACAO");
 assert(draft.pendenciasPolitica.includes("RETENCAO_POR_CATEGORIA_E_MARCO_INICIAL"));
 assert(draft.pendenciasPolitica.includes("DESCARTE_SEGURO_E_SUSPENSAO_POR_LITIGIO"));
 assert(draft.pendenciasPolitica.includes("REGRAS_CONTABEIS_E_FISCAIS_POR_CNPJ"));
 assert.equal(draft.prazoRetencaoDias,null);
 assert.equal(draft.baseLegalDefinida,null);
 assert.equal(draft.dataDescarte,null);
 assert.equal(draft.politicaAprovada,false);
 for(const k of ["permiteUpload","permiteArmazenamento","permiteExportacao",
  "permiteDescarteReal","permiteReembolso","permiteLancamentoFinanceiro",
  "permiteOperacaoFiscal","habilitaCheckout","conteudoDocumentoAutenticado",
  "bancoVerificadoIndependentemente"])
  assert.equal(draft[k],false,k);
 assert.deepEqual(draft,plan({dossie:dossie()}));
});

test("M.5.29 distinguishes current and historical attestation; never leaks evidence",()=>{
 const current=plan({dossie:dossie(),pareceres:[parecer()]});
 assert.equal(current.contagem.pareceresNaVersaoAtual,1);
 assert.equal(current.devolucoes[0].estado,"PARECER_DECLARADO_NA_VERSAO_ATUAL");
 assert.equal(current.politicaAprovada,false);
 assert.equal(current.permiteUpload,false);
 const serialized=JSON.stringify(current);
 assert(!serialized.includes("CI-EVIDENCE-PRIVATE-NO-LEAK"));
 assert(!serialized.includes("CI-SHOULD-NOT-LEAK"));
 assert(!serialized.includes("ci-person"));
 assert(!serialized.includes("c".repeat(64)));
 const stale=dossie();stale.codigoDossie="d".repeat(64);
 const historical=plan({dossie:stale,pareceres:[parecer()]});
 assert.equal(historical.contagem.pareceresHistoricos,1);
 assert.equal(historical.contagem.pareceresNaVersaoAtual,0);
 assert.equal(historical.devolucoes[0].estado,"PARECER_DE_VERSAO_ANTERIOR");
 assert.notEqual(historical.codigoPlano,current.codigoPlano);
 assert.equal(historical.permiteArmazenamento,false);
});

test("M.5.29 fails closed on cross-tenant, duplicated or untracked review",()=>{
 const variants=[
  {dossie:dossie(),pareceres:[{...parecer(),empresaId:"outra-empresa"}]},
  {dossie:dossie(),pareceres:[{...parecer(),devolucaoId:"devolucao-fora"}]},
  {dossie:dossie(),pareceres:[parecer(),parecer()]},
  {dossie:dossie(),pareceres:[{...parecer(),fingerprint:"broken"}]},
  {dossie:dossie(),pareceres:[{...parecer(),status:"APROVADO"}]},
  {dossie:{...dossie(),provasBancariasValidas:true},pareceres:[]},
  {dossie:{...dossie(),habilitaCheckout:true},pareceres:[]},
  {dossie:{...dossie(),codigoDossie:"forged"},pareceres:[]},
  {dossie:{...dossie(),totais:{quantidadeDeclaracoes:0}},pareceres:[]}
 ];
 for(const args of variants)assert.throws(()=>plan(args),/M529_/);
});

test("M.5.29 supports a new dossier without declarations without guessing policy",()=>{
 const empty=dossie();empty.preparacoes[0].declaracoes=[];
 empty.totais.quantidadeDeclaracoes=0;
 const draft=plan({dossie:empty,pareceres:[]});
 assert.equal(draft.contagem.declaracoes,0);
 assert.equal(draft.pendenciasPolitica.length,10);
 assert.equal(draft.prazoRetencaoDias,null);
});
