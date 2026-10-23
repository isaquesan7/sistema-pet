/** PointVet M.4C.2 — deterministic fiscal sale-child preparation, NO emission. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {fiscalCents} from "../src/modules/fiscal/fiscal-unificado-planejamento.contract.js";
import {ratearCentavosPorPeso,prepararFiscalPorVendaFilha}
 from "../src/modules/fiscal/fiscal-unificado-venda.contract.js";
const company={id:"e1",organizacaoId:"tenant",cnpj:"12345678901234",
 razaoSocial:"Emissor CI",cidade:"Salvador",estado:"BA",
 configuracaoFiscal:{regime:"SIMPLES_NACIONAL",ambiente:"HOMOLOGACAO",
  serieNfe:"1",serieNfce:"2",serieNfse:"3",provedorFiscal:"CI_TESTE",
  codigoMunicipioIbge:"2927408"}};
const product={id:"cp",empresaId:"e1",tipo:"PRODUTO",ativo:true,
 fiscalConfig:{ncm:"23091000",cfop:"5102",origemMercadoria:"0",cstCsosn:"102"}};
const service={id:"cs",empresaId:"e1",tipo:"SERVICO",ativo:true,
 fiscalConfig:{codigoServicoMunicipal:"TESTE"}};
const make=(id,cat,base)=>({
 id,vendaId:"s1",descricao:"Item "+id,itemCatalogo:cat,
 valorUnitario:base.toFixed(2),quantidade:"1.000",desconto:"0.00",
 valorTotal:base.toFixed(2)
});
const sale={id:"s1",empresaId:"e1",empresa:company,comandaId:"d1",clienteId:"customer",
 status:"FINALIZADA",
 operacaoUnificada:{empresaId:"e1",vendaId:"s1",status:"CONCLUIDA"},
 documentosFiscais:[],subtotal:"200.00",desconto:"10.01",
 acrescimo:"1.01",valorTotal:"191.00",
 itens:[make("a",product,100),make("b",product,50),make("c",service,50)]};
const input={organizacaoId:"tenant",venda:sale,
 escolhas:[{classe:"PRODUTO",tipoDocumento:"NFE"},{classe:"SERVICO",tipoDocumento:"NFSE"}]};
test("Hamilton allocation sums exact cents with stable ties and arbitrary surcharges",()=>{
 assert.deepEqual(ratearCentavosPorPeso(1,[{id:"b",peso:100},{id:"a",peso:100}]),{a:1,b:0});
 assert.deepEqual(ratearCentavosPorPeso(5,[{id:"b",peso:100},{id:"a",peso:100}]),{a:3,b:2});
 assert.deepEqual(ratearCentavosPorPeso(200,[{id:"a",peso:1}],{permitirExcederBase:true}),{a:200});
 assert.throws(()=>ratearCentavosPorPeso(201,[{id:"a",peso:1}]),/M4C2_RATEIO_SUPERA_BASE/);
});
test("explicit issue selection, issuer identity, exact discounts and surcharges",()=>{
 const a=prepararFiscalPorVendaFilha(input);
 const b=prepararFiscalPorVendaFilha({...input,escolhas:[...input.escolhas].reverse(),
  venda:{...sale,itens:[...sale.itens].reverse()}});
 assert.deepEqual(a,b,"Line order and choice order must not affect the output or fingerprint");
 assert.equal(a.emissaoHabilitada,false);
 assert.equal(a.gerouDocumento,false);
 assert.equal(a.total,"191.00");
 assert.equal(a.desconto,"10.01");
 assert.equal(a.acrescimo,"1.01");
 assert.equal(a.grupos.length,2);
 assert.equal(a.grupos[0].tipoDocumentoEscolhido,"NFE");
 assert.equal(a.grupos[1].tipoDocumentoEscolhido,"NFSE");
 assert.equal(a.grupos[0].emissor.cnpj,"12345678901234");
 const all=a.grupos.flatMap(g=>g.itens);
 assert.equal(all.reduce((n,x)=>n+fiscalCents(x.descontoGlobalAlocado),0),1001);
 assert.equal(all.reduce((n,x)=>n+fiscalCents(x.acrescimoGlobalAlocado),0),101);
 assert.equal(all.reduce((n,x)=>n+fiscalCents(x.valorPlanejado),0),19100);
 assert.equal(a.grupos.reduce((n,g)=>n+fiscalCents(g.total),0),19100);
 assert.equal(a.grupos.every(g=>g.documentoCriado===false),true);
 assert.equal(a.precisaRevisaoFiscal,true);
});
test("choices never silently downgrade invoices to a receipt or mix item classes",()=>{
 for(const escolhas of [
  [],[{classe:"PRODUTO",tipoDocumento:"NFSE"},{classe:"SERVICO",tipoDocumento:"NFSE"}],
  [{classe:"PRODUTO",tipoDocumento:"RECIBO"},{classe:"SERVICO",tipoDocumento:"NFSE"}],
  [{classe:"PRODUTO",tipoDocumento:"NFE"},{classe:"PRODUTO",tipoDocumento:"NFCE"}]
 ])assert.throws(()=>prepararFiscalPorVendaFilha({...input,escolhas}),/M4C2_ESCOLHA|M4C2_TIPO/);
});
test("sales and tenants fail closed: wrong owner, row, total, document or status",()=>{
 const cases=[
  {organizacaoId:"other"},
  {venda:{...sale,empresaId:"e2"}},
  {venda:{...sale,status:"ABERTA"}},
  {venda:{...sale,documentosFiscais:[{id:"real",status:"PENDENTE"}]}},
  {venda:{...sale,valorTotal:"190.99"}},
  {venda:{...sale,subtotal:"199.99"}},
  {venda:{...sale,itens:[{...sale.itens[0],valorTotal:"99.99"},...sale.itens.slice(1)]}},
  {venda:{...sale,itens:[{...sale.itens[0],itemCatalogo:{...product,empresaId:"e2"}},...sale.itens.slice(1)]}},
  {venda:{...sale,operacaoUnificada:{...sale.operacaoUnificada,vendaId:"else"}}}
 ];
 for(const x of cases)assert.throws(()=>prepararFiscalPorVendaFilha({...input,...x}),/M4C2_/);
});
test("missing fiscal data report pending rather than authorizing anything",()=>{
 const s={...sale,empresa:{...company,configuracaoFiscal:null},
  itens:[{...sale.itens[0],itemCatalogo:{...product,fiscalConfig:null}},
   ...sale.itens.slice(1)]};
 const p=prepararFiscalPorVendaFilha({...input,venda:s});
 assert(p.grupos.some(g=>g.pendencias.length>0));
 assert.equal(p.emissaoHabilitada,false);
 assert(p.fingerprint.length===64);
});
