import {test} from "node:test";
import assert from "node:assert/strict";
import {GATES_CUSTODIA_M529}
 from "../src/modules/pdv/pdv-unificado-custodia-devolucoes.contract.js";
import {avaliarMinutaCustodiaM530,RESPONSABILIDADES_CUSTODIA_M530}
 from "../src/modules/pdv/pdv-unificado-minuta-custodia.contract.js";
import {planejarFronteiraEvidenciasM531,CONTROLES_FRONTEIRA_M531}
 from "../src/modules/pdv/pdv-unificado-fronteira-evidencias.contract.js";

const plano=()=>({fase:"M5_29_PLANO_CUSTODIA_NAO_APROVADO_CI",
 organizacaoId:"org-ci",empresaId:"empresa-ci",comandaId:"comanda-ci",
 codigoDossie:"a".repeat(64),codigoPlano:"b".repeat(64),
 somenteLeitura:true,politicaAprovada:false,baseLegalDefinida:null,
 prazoRetencaoDias:null,cadeiaCustodiaRealDisponivel:false,
 permiteUpload:false,permiteArmazenamento:false,permiteExportacao:false,
 permiteDescarteReal:false,permiteReembolso:false,
 permiteLancamentoFinanceiro:false,permiteOperacaoFiscal:false,
 habilitaCheckout:false,pendenciasPolitica:GATES_CUSTODIA_M529});
const minuta=(completa=true)=>{const p=plano();return avaliarMinutaCustodiaM530({plano:p,
 minuta:{versao:"M5_30_MINUTA_CUSTODIA_CI_V1",
 organizacaoId:p.organizacaoId,empresaId:p.empresaId,
 comandaId:p.comandaId,codigoPlanoEsperado:p.codigoPlano,
 requisitos:GATES_CUSTODIA_M529.map((codigo,i)=>({codigo,
  areaResponsavel:RESPONSABILIDADES_CUSTODIA_M530[codigo],
  especificado:completa,referenciaControle:completa?`CI-M531_REFERENCIA_${i+100}`:null}))}});};
const proposta=(m,planejado=false)=>({versao:"M5_31_FRONTEIRA_EVIDENCIAS_CI_V1",
 organizacaoId:m.organizacaoId,empresaId:m.empresaId,comandaId:m.comandaId,
 codigoMinutaEsperado:m.codigoMinuta,
 controles:Object.fromEntries(CONTROLES_FRONTEIRA_M531.map(c=>[c,planejado]))});

test("M.5.31 enumerates 10 planning gaps; all operations remain forbidden",()=>{
 const m=minuta(),p=proposta(m),result=planejarFronteiraEvidenciasM531({minuta:m,proposta:p});
 assert.equal(result.fase,"M5_31_FRONTEIRA_STORAGE_NAO_IMPLEMENTADA_CI");
 assert.equal(result.coberturaPlanejamento.total,10);
 assert.equal(result.coberturaPlanejamento.pendentes,10);
 assert.equal(result.coberturaPlanejamento.propostaTecnicaCompleta,false);
 assert.equal(result.controles.every(c=>!c.implementado&&!c.validadoEmAmbienteReal),true);
 assert.equal(result.prazoRetencaoDias,null);
 assert.deepEqual(result.tiposConteudoAprovados,[]);
 assert.equal(result.limiteBytesAprovado,null);
 for(const key of ["provedorArmazenamentoSelecionado",
  "adaptadorArmazenamentoImplementado","chavesCriptograficasReaisCriadas",
  "politicaRetencaoAprovada","autorizacaoParaCaptura","permiteUpload",
  "permiteArmazenamento","permiteExportacao","permiteDescarteReal",
  "permiteReembolso","permiteLancamentoFinanceiro","permiteOperacaoFiscal",
  "habilitaCheckout"]) assert.equal(result[key],false,key);
 assert.equal(result.somenteLeitura,true);
 assert.deepEqual(planejarFronteiraEvidenciasM531({minuta:m,proposta:p}),result);
 assert.equal(JSON.stringify(result).includes("CI-M531_REFERENCIA_"),false);
});

test("M.5.31 complete proposal is still not storage implementation or approval",()=>{
 const m=minuta(),p=proposta(m,true),result=planejarFronteiraEvidenciasM531({minuta:m,proposta:p});
 assert.equal(result.coberturaPlanejamento.planejados,10);
 assert.equal(result.coberturaPlanejamento.propostaTecnicaCompleta,true);
 assert.equal(result.controles.every(c=>c.planejado&&!c.implementado),true);
 assert.equal(result.autorizacaoParaCaptura,false);
 assert.equal(result.permiteUpload,false);
 assert.equal(result.politicaRetencaoAprovada,false);
 assert.equal(result.permiteDescarteReal,false);
 p.controles[CONTROLES_FRONTEIRA_M531[0]]=false;
 assert.notEqual(planejarFronteiraEvidenciasM531({minuta:m,proposta:p}).codigoFronteira,
  result.codigoFronteira);
});

test("M.5.31 fails closed on incomplete minute, changed SHA, tenant and payload",()=>{
 const m=minuta(),p=proposta(m);
 assert.throws(()=>planejarFronteiraEvidenciasM531({minuta:minuta(false),proposta:p}),
  /M531_MINUTA_TECNICA_INCOMPLETA/);
 const invalid=[
  {minuta:{...m,politicaAprovada:true},proposta:p},
  {minuta:{...m,permiteUpload:true},proposta:p},
  {minuta:{...m,permissaoFake:true,coberturaTecnica:{...m.coberturaTecnica,
   especificados:9}},proposta:p},
  {minuta:m,proposta:{...p,empresaId:"outra-empresa"}},
  {minuta:m,proposta:{...p,organizacaoId:"outra-org"}},
  {minuta:m,proposta:{...p,comandaId:"outra-comanda"}},
  {minuta:m,proposta:{...p,codigoMinutaEsperado:"c".repeat(64)}},
  {minuta:m,proposta:{...p,arquivoBase64:"not-allowed"}},
  {minuta:m,proposta:{...p,url:"https://host/file"}},
  {minuta:m,proposta:{...p,controles:{...p.controles,unexpected:true}}},
  {minuta:m,proposta:{...p,controles:{...p.controles,
   [CONTROLES_FRONTEIRA_M531[0]]:"true"}}},
  {minuta:m,proposta:{...p,controles:{[CONTROLES_FRONTEIRA_M531[0]]:true}}}
 ];
 for(const x of invalid)assert.throws(()=>planejarFronteiraEvidenciasM531(x),/M531_/);
});
