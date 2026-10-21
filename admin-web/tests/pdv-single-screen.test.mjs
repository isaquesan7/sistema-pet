/** M.5.68 — um único balcão, configuração por organização e execução financeira protegida. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {keepUnifiedPdvRouteOnCompanyChange} from "../src/lib/unifiedDraft.js";

function source(path){return readFileSync(new URL(path,import.meta.url),"utf8");}
const app=source("../src/App.jsx");
const pdv=source("../src/pages/PdvPage.jsx");
const intelligent=source("../src/pages/UnifiedPdvPreviewPage.jsx");
const settings=source("../src/pages/SettingsPage.jsx");
const css=source("../src/pdv.css");
const shared=source("../src/components/PdvSaleLayout.jsx");

test("somente /pdv é tela de operação; URL anterior redireciona",()=>{
 assert.match(app,/<Route path="pdv" element={<PdvPage \/>} \/>/);
 assert.match(app,/<Route path="pdv\/unificado\/simulacao" element={<Navigate to="\/pdv" replace \/>} \/>/);
 assert.doesNotMatch(app,/Route path="pdv\/unificado\/simulacao" element={<UnifiedPdvPreviewPage/);
 assert.match(pdv,/import UnifiedPdvPreviewPage from "\.\/UnifiedPdvPreviewPage\.jsx"/);
 assert.match(pdv,/<UnifiedPdvPreviewPage embedded \/>/);
 assert.match(intelligent,/export default function UnifiedPdvPreviewPage\(\{embedded=false\}\)/);
 assert.match(intelligent,/<PdvSaleLayout/);
 assert.match(pdv,/<PdvSaleLayout/);
 assert.match(shared,/className="pdv-sale-layout"/);
});

test("modo inteligente vem da API escopada por organização e empresa e falha fechado",()=>{
 assert.match(pdv,/queryKey:\["unified-pdv-status",selectedOrganization\?\.id,selectedCompany\?\.id\]/);
 assert.match(pdv,/preferenciaUnificado===true/);
 assert.match(pdv,/checkoutUnificadoDisponivel===true/);
 assert.match(pdv,/unifiedStatus\.isPending \?/);
 assert.match(pdv,/unifiedStatus\.isError \?/);
 assert.match(pdv,/setIndividualFallback\(false\)/);
 assert.match(pdv,/showIntelligentSale \? \(/);
 assert.match(pdv,/individualFallback&&!intelligentCheckoutEnabled/);
});

test("única preferência da organização não habilita pagamento automaticamente",()=>{
 assert.match(settings,/PDV Unificado Inteligente/);
 assert.match(settings,/pdvUnificadoHabilitado:enabled/);
 assert.match(settings,/hasPermission\("organizacao\.gerenciar"\)/);
 assert.match(settings,/queryKey:\["unified-pdv-status"\]/);
 assert.match(settings,/fechamento multiempresa depende de autorização independente/);
 assert.match(pdv,/Venda individual temporária/);
 assert.match(intelligent,/checkoutEnabled=\{manualCheckoutEnabled\}/);
 assert.match(intelligent,/\/fechar-manual/);
 assert.match(intelligent,/\/estornar-manual/);
 assert.doesNotMatch(pdv,/api\.post\("\/pdv-unificado\/rascunhos\/.*\/fechar-manual"/);
});

test("troca de CNPJ mantém o atendimento somente na mesma organização e com PDV autorizado",()=>{
 const granted={organizacaoId:"org-1",permissoes:["pdv.acessar"]};
 assert.equal(keepUnifiedPdvRouteOnCompanyChange("/pdv","org-1",granted,true),true);
 assert.equal(keepUnifiedPdvRouteOnCompanyChange("/pdv","org-1",granted,false),false);
 assert.equal(keepUnifiedPdvRouteOnCompanyChange("/pdv","org-2",granted,true),false);
 assert.equal(keepUnifiedPdvRouteOnCompanyChange("/pdv","org-1",{...granted,permissoes:[]},true),false);
 assert.match(pdv,/setCart\(\[\]\);setClientId\(""\)/);
 assert.match(intelligent,/queryKey:scopedKey\("unified-catalog",search\)/);
});

test("tela única compartilha a marcação original do balcão, inclusive no mobile",()=>{
 for(const cls of ['className="pdv-sale-layout"','className="panel pdv-catalog-panel"',
  'className="panel pdv-cart-panel"','className="pdv-product-grid"',
  'className="pdv-cart-list"']){
  assert.ok(shared.includes(cls),`Padrão visual ausente: ${cls}`);
 }
 assert.match(css,/@media\\(max-width:1250px\\)/);
 assert.match(css,/@media\\(max-width:560px\\)/);
 assert.match(css,/\\.pdv-page \\.pdv-cart-line\\.pdv-unified-line/);
 assert.doesNotMatch(intelligent,/className="pv-unified-hero"|className="pv-unified-workspace"/);
});
