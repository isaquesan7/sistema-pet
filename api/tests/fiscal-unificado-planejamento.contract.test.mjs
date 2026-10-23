/** PointVet M.4C.1: pure deterministic fiscal matrix, never invoice emission. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {planejarMatrizFiscalRascunho,fiscalCents} from "../src/modules/fiscal/fiscal-unificado-planejamento.contract.js";
const company={id:"a",organizacaoId:"o",cnpj:"12345678901234",razaoSocial:"Emitente",
 ativo:true,cidade:"Salvador",estado:"BA",
 configuracaoFiscal:{regime:"SIMPLES_NACIONAL",serieNfe:"1",serieNfce:"2",serieNfse:"1",
  codigoMunicipioIbge:"2927408",provedorFiscal:"EXEMPLO"}};
const product={id:"p",empresaId:"a",tipo:"PRODUTO",ativo:true,precoVenda:"50.00",
 fiscalConfig:{ncm:"23091000",cfop:"5102",cstCsosn:"102",origemMercadoria:"0"}};
const service={id:"s",empresaId:"a",tipo:"SERVICO",ativo:true,precoVenda:"25.00",
 fiscalConfig:{codigoServicoMunicipal:"XXXX"}};
const line=(id,cat,qty="1.000",total="50.00")=>({
 id,empresaId:"a",itemCatalogo:cat,status:"ATIVO",valorUnitario:cat.precoVenda,
 quantidade:qty,desconto:"0.00",valorTotal:total
});
const args={organizacaoId:"o",clienteId:"c",comandaId:"r",versao:1,
 empresas:[company],linhas:[line("p1",product),line("s1",service,"2.000","50.00")]};
test("segregates products and services without deciding tax document",()=>{
 const p=planejarMatrizFiscalRascunho(args);
 assert.equal(p.numeroGrupos,2);
 assert.equal(p.total,"100.00");
 assert.deepEqual(p.grupos.find(g=>g.classe==="PRODUTO").documentosPossiveis,["NFE","NFCE"]);
 assert.deepEqual(p.grupos.find(g=>g.classe==="SERVICO").documentosPossiveis,["NFSE"]);
 assert(p.grupos.every(g=>g.emissaoHabilitada===false&&g.documentoEscolhido===null));
 assert.equal(p.documentoEmitido,false);
 assert.equal(p.gerouVenda,false);
});
test("rejects tenant contamination even before classifying lines",()=>{
 assert.throws(()=>planejarMatrizFiscalRascunho({...args,
  empresas:[{...company,organizacaoId:"other"}]}),/M4C_ISOLAMENTO_EMPRESA_INVALIDO/);
 assert.throws(()=>planejarMatrizFiscalRascunho({...args,
  linhas:[{...args.linhas[0],empresaId:"elsewhere"}]}),/M4C_LINHA_EMPRESA_NAO_AUTORIZADA/);
});
test("missing fiscal classification, invalid money and discount mismatch fail closed",()=>{
 const invalid=planejarMatrizFiscalRascunho({...args,linhas:[
  {...args.linhas[0],valorTotal:"49.00",itemCatalogo:{...product,fiscalConfig:null}}
 ]});
 const codes=invalid.grupos[0].pendencias.map(p=>p.codigo);
 assert(codes.includes("VALOR_LINHA_DIVERGENTE"));
 assert(codes.includes("CLASSIFICACAO_FISCAL_ITEM_AUSENTE"));
 for(const invalidValue of ["0.001","1e2","-1","01"])assert.throws(()=>fiscalCents(invalidValue),/M4C_VALOR/);
});
test("incompatible issuer topology blocks fiscal completeness",()=>{
 const invalid=planejarMatrizFiscalRascunho({...args,empresas:[{...company,
  unidadeOperacionalLegada:{id:"u",empresaLegadaId:"a",entidadeFiscalId:"x",
   organizacaoId:"o",ativa:true,entidadeFiscal:{id:"x",organizacaoId:"o",
    cnpj:"99999999999999",ativo:true}}}]});
 assert(invalid.grupos.every(g=>g.pendencias.some(i=>i.codigo==="TOPOLOGIA_FISCAL_DIVERGENTE")));
 assert(invalid.grupos.every(g=>g.emissaoHabilitada===false));
});
