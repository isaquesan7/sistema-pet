/** M.5.26: provider-neutral output must stay inert and issuer-specific. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {prepararFiscalPorVendaFilha} from "../src/modules/fiscal/fiscal-unificado-venda.contract.js";
import {prepararEnvelopesFiscaisNeutrosM526} from "../src/modules/fiscal/fiscal-provedor-neutro.contract.js";

const empresa={id:"e1",organizacaoId:"org1",cnpj:"12345678901234",
 razaoSocial:"Emissor CI",cidade:"Salvador",estado:"BA",
 configuracaoFiscal:{regime:"SIMPLES_NACIONAL",ambiente:"HOMOLOGACAO",
  serieNfe:"1",serieNfse:"1",provedorFiscal:"CI_APENAS_EXEMPLO",
  codigoMunicipioIbge:"2927408"}};
const produto={id:"cat1",empresaId:"e1",ativo:true,tipo:"PRODUTO",
 fiscalConfig:{ncm:"23091000",cfop:"5102",origemMercadoria:"0",cstCsosn:"102"}};
const servico={id:"cat2",empresaId:"e1",ativo:true,tipo:"SERVICO",
 fiscalConfig:{codigoServicoMunicipal:"TESTE"}};
const item=(id,cat,valor)=>({id,vendaId:"v1",descricao:"Item "+id,
 itemCatalogo:cat,valorUnitario:valor,quantidade:"1.000",
 desconto:"0.00",valorTotal:valor});
const venda={id:"v1",empresaId:"e1",empresa,clienteId:"cli1",comandaId:"c1",
 status:"FINALIZADA",operacaoUnificada:{empresaId:"e1",vendaId:"v1",
  status:"CONCLUIDA"},documentosFiscais:[],subtotal:"160.00",
 desconto:"1.10",acrescimo:"0.10",valorTotal:"159.00",
 itens:[item("p1",produto,"100.00"),item("s1",servico,"60.00")]};
const gerar=()=>prepararFiscalPorVendaFilha({organizacaoId:"org1",venda,
 escolhas:[{classe:"PRODUTO",tipoDocumento:"NFE"},
  {classe:"SERVICO",tipoDocumento:"NFSE"}]});
const rehash=plano=>{
 const keys=["versaoContrato","vendaId","comandaId","organizacaoId","emissor",
  "subtotal","desconto","acrescimo","total","grupos"];
 const snapshot=Object.fromEntries(keys.map(k=>[k,plano[k]]));
 return {...plano,fingerprint:createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")};
};

test("one inert document envelope per class and issuer, with exact totals",()=>{
 const origem=gerar();
 const p=prepararEnvelopesFiscaisNeutrosM526(origem);
 assert.equal(p.fase,"M5_26_PORTA_FISCAL_NEUTRA");
 assert.equal(p.quantidadeEnvelopes,2);
 assert.deepEqual(p.envelopes.map(e=>e.documento.tipoEscolhido),["NFE","NFSE"]);
 assert.deepEqual(p.envelopes.map(e=>e.valores.total),
  origem.grupos.map(g=>g.total));
 assert.equal(p.envelopes[0].origem.empresaId,"e1");
 assert.equal(p.envelopes[0].emissor.cnpj,"12345678901234");
 assert.equal(p.envelopes[0].documento.serieInformadaNaoReservada,"1");
 assert.equal(p.envelopes[0].itens[0].classificacaoInformada.ncm,"23091000");
 assert.equal(p.envelopes[1].itens[0].classificacaoInformada.codigoServicoMunicipal,"TESTE");
 assert.equal(p.envelopes.every(e=>e.permiteEmissao===false&&
  e.permiteCancelamento===false&&e.permiteConsultaExterna===false&&
  e.permiteContingencia===false&&e.transmitiu===false&&
  e.assinouXml===false&&e.reservouNumero===false&&
  e.documentoFiscalCriado===false),true);
 assert.equal(p.provedorConectado,false);
 assert.equal(p.habilitaQualquerOperacaoFiscal,false);
 assert.equal(p.envelopes.every(e=>e.pendencias.includes(
  "PROVEDOR_FISCAL_AINDA_NAO_ESCOLHIDO")),true);
 assert(!JSON.stringify(p).includes("CI_APENAS_EXEMPLO"),
  "A historical provider config must not be a provider choice or credential");
 assert.deepEqual(prepararEnvelopesFiscaisNeutrosM526(gerar()),p);
});

test("no provider selected still permits LOCAL preparation, never emission",()=>{
 const plan=prepararFiscalPorVendaFilha({organizacaoId:"org1",
  venda:{...venda,empresa:{...empresa,configuracaoFiscal:null}},
  escolhas:[{classe:"PRODUTO",tipoDocumento:"NFCE"},
   {classe:"SERVICO",tipoDocumento:"NFSE"}]});
 const out=prepararEnvelopesFiscaisNeutrosM526(plan);
 assert.equal(out.envelopes[0].documento.tipoEscolhido,"NFCE");
 assert.equal(out.envelopes[0].documento.serieInformadaNaoReservada,null);
 assert(out.envelopes[0].pendencias.includes("PROVEDOR_FISCAL_NAO_CONFIGURADO"));
 assert(out.envelopes[1].pendencias.includes("SERIE_NAO_CONFIGURADA"));
 assert.equal(out.motorFiscalImplementado,false);
});

test("reject tampering, mixed issuers, totals, classes, duplicated lines and active flags",()=>{
 const base=gerar();
 const change=(index,values)=>({...base,grupos:base.grupos.map((g,i)=>
  i===index?{...g,...values}:g)});
 assert.throws(()=>prepararEnvelopesFiscaisNeutrosM526({...base,
  emissaoHabilitada:true}),/M526_ORIGEM_INSEGURA/);
 assert.throws(()=>prepararEnvelopesFiscaisNeutrosM526({...base,
  fingerprint:"0".repeat(64)}),/M526_FINGERPRINT_ORIGEM_DIVERGENTE/);
 assert.throws(()=>prepararEnvelopesFiscaisNeutrosM526(rehash(change(0,{
  emissor:{...base.emissor,empresaId:"outra"}
 }))),/M526_GRUPO_INCOMPATIVEL/);
 assert.throws(()=>prepararEnvelopesFiscaisNeutrosM526(rehash(change(0,{
  tipoDocumentoEscolhido:"NFSE"
 }))),/M526_GRUPO_INCOMPATIVEL/);
 assert.throws(()=>prepararEnvelopesFiscaisNeutrosM526(rehash(change(0,{
  total:"99.99"
 }))),/M526_TOTAL_GRUPO_DIVERGENTE/);
 assert.throws(()=>prepararEnvelopesFiscaisNeutrosM526(rehash(change(0,{
  itens:[{...base.grupos[0].itens[0],valorPlanejado:"999.00"}]
 }))),/M526_RATEIO_ITEM_DIVERGENTE/);
 assert.throws(()=>prepararEnvelopesFiscaisNeutrosM526(rehash(change(1,{
  itens:[{...base.grupos[1].itens[0],id:base.grupos[0].itens[0].id}]
 }))),/M526_ITEM_FORA_DO_EMISSOR_OU_DUPLICADO/);
 assert.throws(()=>prepararEnvelopesFiscaisNeutrosM526(rehash(change(0,{
  documentoCriado:true
 }))),/M526_GRUPO_INCOMPATIVEL/);
});
