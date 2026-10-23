import {test} from "node:test";
import assert from "node:assert/strict";
import {GATES_CUSTODIA_M529}
 from "../src/modules/pdv/pdv-unificado-custodia-devolucoes.contract.js";
import {avaliarMinutaCustodiaM530,RESPONSABILIDADES_CUSTODIA_M530}
 from "../src/modules/pdv/pdv-unificado-minuta-custodia.contract.js";
import {planejarFronteiraEvidenciasM531,CONTROLES_FRONTEIRA_M531}
 from "../src/modules/pdv/pdv-unificado-fronteira-evidencias.contract.js";
import {simularAcessoEvidenciaM532,OPERACOES_EVIDENCIA_M532,
 PAPEIS_HIPOTETICOS_M532}
 from "../src/modules/pdv/pdv-unificado-acesso-evidencias.contract.js";

function fronteira(planejados=true){
 const plano={fase:"M5_29_PLANO_CUSTODIA_NAO_APROVADO_CI",
  organizacaoId:"org-ci",empresaId:"cnpj-ci",comandaId:"comanda-ci",
  codigoDossie:"a".repeat(64),codigoPlano:"b".repeat(64),
  somenteLeitura:true,politicaAprovada:false,baseLegalDefinida:null,
  prazoRetencaoDias:null,cadeiaCustodiaRealDisponivel:false,
  permiteUpload:false,permiteArmazenamento:false,permiteExportacao:false,
  permiteDescarteReal:false,permiteReembolso:false,
  permiteLancamentoFinanceiro:false,permiteOperacaoFiscal:false,
  habilitaCheckout:false,pendenciasPolitica:GATES_CUSTODIA_M529};
 const minuta=avaliarMinutaCustodiaM530({plano,
  minuta:{versao:"M5_30_MINUTA_CUSTODIA_CI_V1",
   organizacaoId:plano.organizacaoId,empresaId:plano.empresaId,
   comandaId:plano.comandaId,codigoPlanoEsperado:plano.codigoPlano,
   requisitos:GATES_CUSTODIA_M529.map((codigo,i)=>({codigo,
    areaResponsavel:RESPONSABILIDADES_CUSTODIA_M530[codigo],
    especificado:true,referenciaControle:`CI-M532_MINUTA_${i+100}`}))}});
 return planejarFronteiraEvidenciasM531({minuta,
  proposta:{versao:"M5_31_FRONTEIRA_EVIDENCIAS_CI_V1",
   organizacaoId:minuta.organizacaoId,empresaId:minuta.empresaId,
   comandaId:minuta.comandaId,codigoMinutaEsperado:minuta.codigoMinuta,
   controles:Object.fromEntries(CONTROLES_FRONTEIRA_M531.map(c=>[c,planejados]))}});
}
const solicitacao=(f,operacao="LER_CONTEUDO",papelHipotetico="AUDITOR_CI")=>({
 versao:"M5_32_DECISAO_ACESSO_EVIDENCIA_CI_V1",
 organizacaoId:f.organizacaoId,empresaId:f.empresaId,comandaId:f.comandaId,
 codigoFronteiraEsperado:f.codigoFronteira,operacao,papelHipotetico
});

test("M.5.32 denies every hypothetical operation for every role with 10/10 planned",()=>{
 const f=fronteira();
 for(const operacao of OPERACOES_EVIDENCIA_M532){
  for(const papelHipotetico of PAPEIS_HIPOTETICOS_M532){
   const s=solicitacao(f,operacao,papelHipotetico);
   const decision=simularAcessoEvidenciaM532({fronteira:f,solicitacao:s});
   assert.equal(decision.fase,"M5_32_ACESSO_DOCUMENTAL_NEGADO_CI");
   assert.equal(decision.controlesPlanejados,10);
   assert.equal(decision.controlesImplementados,0);
   assert.equal(decision.controlesHomologados,0);
   assert.equal(decision.papelRealAutenticado,false);
   assert.equal(decision.permissaoRealVerificada,false);
   assert.equal(decision.bloqueios.length,6);
   assert.equal(decision.somenteLeitura,true);
   for(const key of ["autorizado","capacidadeEmitida","tokenEmitido",
    "urlAssinadaEmitida","permiteUpload","permiteLeitura",
    "permiteExportacao","permiteDescarte","permiteRestore",
    "permiteOperacaoFiscal","permiteReembolso","habilitaCheckout"])
    assert.equal(decision[key],false,key);
   assert.deepEqual(decision,simularAcessoEvidenciaM532({fronteira:f,solicitacao:s}));
   assert.equal(JSON.stringify(decision).includes("CI-M532_MINUTA_"),false);
  }
 }
});

test("M.5.32 refuses operations even when NOT EVEN PLANNED",()=>{
 const f=fronteira(false);
 const d=simularAcessoEvidenciaM532({fronteira:f,solicitacao:solicitacao(f)});
 assert.equal(d.controlesPlanejados,0);
 assert.equal(d.autorizado,false);
 assert.equal(d.permiteLeitura,false);
 assert.equal(d.bloqueios.includes("CONTROLES_DE_SEGURANCA_NAO_HOMOLOGADOS"),true);
});

test("M.5.32 rejects forged authorization, coverage or control matrix",()=>{
 const f=fronteira(),s=solicitacao(f);
 const invalid=[
  {...f,autorizacaoParaCaptura:true},
  {...f,permiteArmazenamento:true},
  {...f,habilitaCheckout:true},
  {...f,prazoRetencaoDias:365},
  {...f,codigoFronteira:"b".repeat(64)},
  {...f,coberturaPlanejamento:{...f.coberturaPlanejamento,planejados:9}},
  {...f,controles:[{...f.controles[0],implementado:true},...f.controles.slice(1)]},
  {...f,controles:[{...f.controles[0],planejado:false},...f.controles.slice(1)]},
  {...f,controles:[...f.controles].reverse()},
  {...f,tiposConteudoAprovados:["pdf"]},
  {...f,urlAssinada:"https://host/not-real"}
 ];
 for(const value of invalid)assert.throws(()=>simularAcessoEvidenciaM532({
  fronteira:value,solicitacao:s
 }),/M532_/);
});

test("M.5.32 rejects cross-CNPJ/tenant, stale SHA, unknown role and payload",()=>{
 const f=fronteira(),s=solicitacao(f);
 const invalid=[
  {...s,organizacaoId:"outra-org"},
  {...s,empresaId:"outra-empresa"},
  {...s,comandaId:"outra-comanda"},
  {...s,codigoFronteiraEsperado:"c".repeat(64)},
  {...s,versao:"M5_32_V0"},
  {...s,operacao:"LIBERAR_ACESSO"},
  {...s,papelHipotetico:"ADMIN_REAL"},
  {...s,documentoBase64:"not-allowed"},
  {...s,usuarioId:"real-person"},
  {...s,url:"https://example.org"},
  {...s,tempoExpiracaoSegundos:3600}
 ];
 for(const value of invalid)assert.throws(()=>simularAcessoEvidenciaM532({
  fronteira:f,solicitacao:value
 }),/M532_/);
});
