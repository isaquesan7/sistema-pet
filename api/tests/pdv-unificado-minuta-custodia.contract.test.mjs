import {test} from "node:test";
import assert from "node:assert/strict";
import {GATES_CUSTODIA_M529}
 from "../src/modules/pdv/pdv-unificado-custodia-devolucoes.contract.js";
import {avaliarMinutaCustodiaM530,RESPONSABILIDADES_CUSTODIA_M530}
 from "../src/modules/pdv/pdv-unificado-minuta-custodia.contract.js";

const plano=()=>({fase:"M5_29_PLANO_CUSTODIA_NAO_APROVADO_CI",
 organizacaoId:"organizacao-ci",empresaId:"empresa-ci",comandaId:"comanda-ci",
 codigoDossie:"a".repeat(64),codigoPlano:"b".repeat(64),
 somenteLeitura:true,politicaAprovada:false,baseLegalDefinida:null,
 prazoRetencaoDias:null,cadeiaCustodiaRealDisponivel:false,
 permiteUpload:false,permiteArmazenamento:false,permiteExportacao:false,
 permiteDescarteReal:false,permiteReembolso:false,
 permiteLancamentoFinanceiro:false,permiteOperacaoFiscal:false,
 habilitaCheckout:false,pendenciasPolitica:GATES_CUSTODIA_M529});
const minuta=p=>({versao:"M5_30_MINUTA_CUSTODIA_CI_V1",
 organizacaoId:p.organizacaoId,empresaId:p.empresaId,
 comandaId:p.comandaId,codigoPlanoEsperado:p.codigoPlano,
 requisitos:GATES_CUSTODIA_M529.map(codigo=>({codigo,
  areaResponsavel:RESPONSABILIDADES_CUSTODIA_M530[codigo],
  especificado:false,referenciaControle:null}))});

test("M.5.30 makes a scoped draft with explicit owners and NO real approvals",()=>{
 const p=plano(),draft=avaliarMinutaCustodiaM530({plano:p,minuta:minuta(p)});
 assert.equal(draft.controles.length,10);
 assert.equal(draft.coberturaTecnica.pendentes,10);
 assert.equal(draft.coberturaTecnica.matrizTecnicamentePreenchida,false);
 assert.equal(draft.pendenciasAprovacaoReal.length,6);
 assert.equal(draft.prazoRetencaoHomologado,null);
 assert.equal(draft.pessoasAprovadorasVerificadas,false);
 assert.equal(draft.segregacaoPessoasHomologada,false);
 for(const field of ["politicaAprovada","permiteUpload","permiteArmazenamento",
  "permiteExportacao","permiteDescarteReal","permiteReembolso",
  "permiteLancamentoFinanceiro","permiteOperacaoFiscal","habilitaCheckout"])
  assert.equal(draft[field],false,field);
 assert.deepEqual(draft,avaliarMinutaCustodiaM530({plano:p,minuta:minuta(p)}));
});

test("Even 10 specified CI controls do not authorize a policy or retention",()=>{
 const p=plano(),m=minuta(p);
 for(const [i,r] of m.requisitos.entries()){
  r.especificado=true;r.referenciaControle=`CI-CONTROLE_${i+1000}`;
 }
 const full=avaliarMinutaCustodiaM530({plano:p,minuta:m});
 assert.equal(full.coberturaTecnica.matrizTecnicamentePreenchida,true);
 assert.equal(full.coberturaTecnica.especificados,10);
 assert.equal(full.politicaAprovada,false);
 assert.equal(full.prazoRetencaoHomologado,null);
 assert.equal(full.controles.every(x=>!x.evidenciaRealVerificada&&
  !x.aprovacaoHumanaReal),true);
 assert.equal(full.permiteUpload,false);
 assert.equal(full.habilitaCheckout,false);
 const reversed={...m,requisitos:[...m.requisitos].reverse()};
 assert.equal(avaliarMinutaCustodiaM530({plano:p,minuta:reversed}).codigoMinuta,
  full.codigoMinuta,"order cannot alter the signed draft fingerprint");
 m.requisitos[0].referenciaControle="CI-CONTROLE_ALTERADO";
 assert.notEqual(avaliarMinutaCustodiaM530({plano:p,minuta:m}).codigoMinuta,
  full.codigoMinuta);
});

test("M.5.30 refuses stale plan, cross-tenant and arbitrary content/file inputs",()=>{
 const p=plano(),m=minuta(p);
 const variants=[
  {plano:{...p,politicaAprovada:true},minuta:m},
  {plano:{...p,habilitaCheckout:true},minuta:m},
  {plano:{...p,permiteLancamentoFinanceiro:true},minuta:m},
  {plano:{...p,prazoRetencaoDias:365},minuta:m},
  {plano:{...p,pendenciasPolitica:["OTHER"]},minuta:m},
  {plano:p,minuta:{...m,empresaId:"outra-empresa"}},
  {plano:p,minuta:{...m,codigoPlanoEsperado:"d".repeat(64)}},
  {plano:p,minuta:{...m,arquivoBase64:"sensitive"}},
  {plano:p,minuta:{...m,requisitos:m.requisitos.slice(1)}},
  {plano:p,minuta:{...m,requisitos:[m.requisitos[0],...m.requisitos.slice(0,9)]}},
  {plano:p,minuta:{...m,requisitos:m.requisitos.map((r,i)=>i? r:{
   ...r,areaResponsavel:"FINANCEIRO_FISCAL"})}},
  {plano:p,minuta:{...m,requisitos:m.requisitos.map((r,i)=>i? r:{
   ...r,especificado:true,referenciaControle:"https://host/arquivo.pdf"})}},
  {plano:p,minuta:{...m,requisitos:m.requisitos.map((r,i)=>i? r:{
   ...r,conteudoDocumento:"tutor"})}}
 ];
 for(const x of variants)assert.throws(()=>avaliarMinutaCustodiaM530(x),/M530_/);
 const changed=plano();changed.codigoPlano="e".repeat(64);
 assert.throws(()=>avaliarMinutaCustodiaM530({plano:changed,minuta:m}),
  /M530_PLANO_DESATUALIZADO/);
});
