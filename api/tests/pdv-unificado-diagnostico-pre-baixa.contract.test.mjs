import {test} from "node:test";
import assert from "node:assert/strict";
import {planejarBaixaCartaoM59} from "../src/modules/pdv/pdv-unificado-baixa-cartao.contract.js";
import {validarParecerDocumentalM511} from "../src/modules/pdv/pdv-unificado-parecer-documental.contract.js";
import {avaliarDossiePreBaixaM512} from "../src/modules/pdv/pdv-unificado-diagnostico-pre-baixa.contract.js";
function input(){
 const organization="orgM512",company="coM512",command="cmdM512";
 const summary={fase:"M5_6_RESUMO_RECEBIVEIS_CI",organizacaoId:organization,
  empresaId:company,comandaId:command,leituraSomente:true,provaBancariaIndependente:false,
  linhas:[{linhaId:"lineM512",empresaId:company,situacao:"REPASSE_PARCIAL_DECLARADO",
   parcelas:[{id:"partM512",valor:"60.00",status:"CONCILIADA"}]}]};
 const plan=planejarBaixaCartaoM59({resumo:summary,pedido:{
  tipo:"REPASSE_NORMAL",contaFinanceiraId:"bank-M512",
  referenciaExtrato:"M512-EXTRATO-CI",dataCredito:"2026-10-15",
  parcelaIds:["partM512"],tarifaCartao:"1.20",descontoAntecipacao:"0.00",
  valorLiquidoDeclarado:"58.80",confirmouConferenciaExterna:true
 }});
 const prep={id:"prepM512",organizacaoId:organization,empresaId:company,
  comandaId:command,usuarioId:"makerM512",contaFinanceiraId:"bank-M512",
  referenciaExtrato:plan.referenciaExtrato,tipo:plan.tipo,
  dataCredito:new Date("2026-10-15T00:00:00.000Z"),
  fingerprint:plan.fingerprint,status:"PREPARADA_SEM_BAIXA",
  bruto:"60.00",tarifaCartao:"1.20",descontoAntecipacao:"0.00",
  liquidoDeclarado:"58.80",snapshot:{
   versao:1,fase:plan.fase,parcelas:plan.parcelas,valores:plan.valores,
   baixaRealExecutada:false,verificacaoBancariaIndependente:false
  }};
 const reviewed=validarParecerDocumentalM511({preparacaoFingerprint:plan.fingerprint,
  conferenteId:"reviewerM512",evidenciaReferencia:"EVIDENCE-M512-CI",
  evidenciaSha256:"a".repeat(64),confirmouConferenciaDocumental:true});
 const parecer={id:"reviewM512",preparacaoId:prep.id,organizacaoId:organization,
  empresaId:company,conferenteId:"reviewerM512",
  evidenciaReferencia:reviewed.evidenciaReferencia,
  evidenciaSha256:reviewed.evidenciaSha256,fingerprint:reviewed.fingerprint,
  status:reviewed.status,
  snapshot:{versao:1,preparacaoFingerprint:prep.fingerprint,
   referenciaExtrato:prep.referenciaExtrato,parcelas:["partM512"],
   comprovacaoBancariaIndependente:false,
   baixaContabilAutorizada:false,conteudoDocumentoValidado:false}};
 return {organizacaoId:organization,empresaId:company,preparacao:prep,parecer,
  comanda:{id:command,organizacaoId:organization,status:"FECHADA",rascunhoUnificado:true},
  conta:{id:"bank-M512",empresaId:company,tipo:"BANCO",ativo:true},
  parcelas:[{id:"partM512",valor:"60.00",status:"CONCILIADA",
   conciliadoEm:new Date("2026-10-15T12:00:00.000Z"),empresaId:company,
   comandaId:command,forma:"CARTAO_CREDITO",pagamentoStatus:"PENDENTE",
   vendaStatus:"FINALIZADA",operacaoStatus:"CONCLUIDA",reservaStatus:"RESERVADA"}],
  auditoriasPreparacao:[{organizacaoId:organization,empresaId:company,
   usuarioId:"makerM512",entidadeId:prep.id,dadosNovos:{fingerprint:prep.fingerprint}}],
  auditoriasParecer:[{organizacaoId:organization,empresaId:company,
   usuarioId:"reviewerM512",entidadeId:parecer.id,dadosNovos:{
    fingerprint:parecer.fingerprint,segregacaoDeFuncoes:true,
    comprovacaoBancariaIndependente:false
   }}],
  auditoriasDeclaracao:[{organizacaoId:organization,empresaId:company,
   usuarioId:"makerM512",entidadeId:"partM512",
   dadosNovos:{status:"CONCILIADA",provaBancariaIndependente:false,
    valorCentavos:6000}}]
 };
}
test("M.5.12 consistent dossier still NEVER unlocks accounting or production",()=>{
 const value=avaliarDossiePreBaixaM512(input());
 assert.equal(value.integridadeInternaAprovada,true,JSON.stringify(value.pendencias));
 assert.equal(value.situacao,"CONFERENCIA_DOCUMENTAL_COERENTE_SEM_BANCO");
 assert.deepEqual(value.pendencias,[]);
 assert(value.dependenciasExternas.includes("EXTRATO_BANCARIO_AUTENTICADO_NAO_VERIFICADO"));
 for(const key of ["comprovacaoBancariaIndependente","podeExecutarBaixa",
  "podeAprovarPagamento","podeCreditarBanco","podeExecutarEstorno",
  "podeEmitirFiscal","podePublicarPdv"]){
  assert.equal(value[key],false,key);
 }
});
test("M.5.12 tampering or stale states invalidate internal dossier",()=>{
 const changes=[
  f=>{f.parcelas[0].status="ESTORNADA";},
  f=>{f.parcelas[0].valor="59.00";},
  f=>{f.preparacao.tarifaCartao="1.30";},
  f=>{f.preparacao.referenciaExtrato="ALTERED-M512-CI";},
  f=>{f.preparacao.snapshot.parcelas=f.preparacao.snapshot.parcelas.map(p=>({...p,parcelaId:"other"}));},
  f=>{f.conta.empresaId="cross-tenant";},
  f=>{f.comanda.status="CANCELADA";},
  f=>{f.parecer.evidenciaSha256="f".repeat(64);},
  f=>{f.parecer.snapshot.comprovacaoBancariaIndependente=true;},
  f=>{f.auditoriasPreparacao=[];},
  f=>{f.auditoriasParecer=[];},
  f=>{f.auditoriasDeclaracao[0].usuarioId="reviewerM512";},
  f=>{f.auditoriasDeclaracao[0].dadosNovos.valorCentavos=5999;}
 ];
 for(const mutate of changes){
  const fixture=input();mutate(fixture);
  const actual=avaliarDossiePreBaixaM512(fixture);
  assert.equal(actual.integridadeInternaAprovada,false,JSON.stringify(actual));
  assert(actual.pendencias.length>0);
  assert.equal(actual.podeExecutarBaixa,false);
 }
});
test("M.5.12 cannot pass without second-person review",()=>{
 const f=input();f.parecer=null;f.auditoriasParecer=[];
 const actual=avaliarDossiePreBaixaM512(f);
 assert.equal(actual.integridadeInternaAprovada,false);
 assert(actual.pendencias.includes("SEGUNDA_CONFERENCIA_AUSENTE"));
 assert.equal(actual.podePublicarPdv,false);
});
