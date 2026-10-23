import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checkoutManualHabilitado,estornoContingenciaHabilitado,estornoManualHabilitado,empresaEstornoContingenciaAutorizada} from "../src/modules/pdv/pdv-unificado-checkout-manual.gate.js";

test("checkout manual falha fechado sem 4 autorizações e nunca exige motor fiscal",()=>{
 const enabled=process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED;
 const allowed=process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS;
 const companies=process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS;
 const org={id:"ci-only",configuracao:{pdvUnificadoHabilitado:true}};
 const enabledFor=o=>checkoutManualHabilitado(o,"ci-company");
 try{
  delete process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED;
  delete process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS;
  delete process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS;
  assert.equal(enabledFor(org),false);
  process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED="1";
  assert.equal(enabledFor(org),false);
  process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS="outra";
  assert.equal(enabledFor(org),false);
  process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS="outra, ci-only";
  assert.equal(enabledFor(org),false);
  process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS="outra-empresa,ci-company";
  assert.equal(enabledFor(org),true);
  assert.equal(enabledFor({...org,configuracao:{pdvUnificadoHabilitado:false}}),false);
  assert.equal(enabledFor({...org,id:"outra-organizacao"}),false);
  assert.equal(checkoutManualHabilitado(org,"empresa-nova"),false);
 }finally{
  if(enabled===undefined)delete process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED;
  else process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED=enabled;
  if(allowed===undefined)delete process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS;
  else process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS=allowed;
  if(companies===undefined)delete process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS;
  else process.env.POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS=companies;
 }
 const service=readFileSync(new URL("../src/modules/pdv/pdv-unificado-checkout-manual.service.js",import.meta.url),"utf8");
 assert.match(service,/isolationLevel:"Serializable"/);
 assert.match(service,/registrarRecebimentoManualEmTransacao/);
 assert.match(service,/criarVendasFilhasEmTransacao/);
 assert.match(service,/efetivarRecebimentosManuaisEmTransacao/);
 assert.doesNotMatch(service,/criarDocumentoAutomaticoVenda|emitirNota|enviarPagamento|webhook/i);
});

test("contingência M.5.56 autoriza apenas ESTORNO com três allowlists independentes",()=>{
 const keys=["POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED","POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS",
  "POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS","POINTVET_UNIFIED_MANUAL_REVERSAL_ENABLED",
  "POINTVET_UNIFIED_MANUAL_REVERSAL_ORG_IDS","POINTVET_UNIFIED_MANUAL_REVERSAL_COMPANY_IDS"];
 const originals=new Map(keys.map(key=>[key,process.env[key]]));
 const org={id:"tenant-sintetico",configuracao:{pdvUnificadoHabilitado:true}};
 try{
  for(const key of keys)delete process.env[key];
  assert.equal(estornoManualHabilitado(org,"empresa-a"),false);
  process.env.POINTVET_UNIFIED_MANUAL_REVERSAL_ENABLED="1";
  assert.equal(estornoManualHabilitado(org,"empresa-a"),false);
  process.env.POINTVET_UNIFIED_MANUAL_REVERSAL_ORG_IDS="outro-tenant,tenant-sintetico";
  assert.equal(estornoManualHabilitado(org,"empresa-a"),false);
  process.env.POINTVET_UNIFIED_MANUAL_REVERSAL_COMPANY_IDS="empresa-a,empresa-b";
  assert.equal(estornoManualHabilitado(org,"empresa-a"),true);
  assert.equal(estornoContingenciaHabilitado(org,"empresa-b"),true);
  assert.equal(empresaEstornoContingenciaAutorizada("empresa-c"),false);
  assert.equal(checkoutManualHabilitado(org,"empresa-a"),false,
   "A permissão de estorno jamais habilita o checkout");
  assert.equal(estornoManualHabilitado({...org,id:"tenant-errado"},"empresa-a"),false);
  assert.equal(estornoManualHabilitado({...org,configuracao:{pdvUnificadoHabilitado:false}},"empresa-a"),false);
  process.env.POINTVET_UNIFIED_MANUAL_REVERSAL_ENABLED="0";
  assert.equal(estornoManualHabilitado(org,"empresa-a"),false);
 }finally{
  for(const [key,value] of originals){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
