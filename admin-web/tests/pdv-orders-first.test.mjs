/** M.5.71 — PDV primeiro por comandas e quantidade de serviços. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isValidPdvQuantity,sanitizePdvQuantity,stepPdvQuantity,serviceNeedsTutorAndPet} from "../src/lib/pdvQuantity.js";
import {initialPetForUnifiedService} from "../src/lib/unifiedDraft.js";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const page=read("../src/pages/PdvPage.jsx"),home=read("../src/components/PdvOrdersHome.jsx"),unified=read("../src/pages/UnifiedPdvPreviewPage.jsx");
test("serviços só permitem números inteiros positivos, sem arredondar fraude",()=>{
 const service={tipo:"SERVICO"},bulk={tipo:"PRODUTO"};
 for(const invalid of [-3,0,0.5,1.5,2.001,NaN,Infinity]){
  assert.equal(isValidPdvQuantity(service,invalid),false,String(invalid));
  assert.equal(sanitizePdvQuantity(service,invalid,2),2);
 }
 for(const valid of [1,2,3,15])assert.equal(sanitizePdvQuantity(service,valid),valid);
 assert.equal(stepPdvQuantity(service,1,-1),1);
 assert.equal(stepPdvQuantity(service,2,-1),1);
 assert.equal(stepPdvQuantity(service,2,1),3);
 assert.equal(isValidPdvQuantity(bulk,0.333),true);
 assert.equal(sanitizePdvQuantity(bulk,0.333),0.333);
 assert.equal(serviceNeedsTutorAndPet(service),true);
 assert.equal(serviceNeedsTutorAndPet(bulk),false);
});
test("pet escolhido ao abrir comanda permanece apenas em serviços do mesmo tutor",()=>{
 const source={clientId:"tutor-A",initialClientId:"tutor-A",initialPetId:"pet-1",pets:[{id:"pet-1",ativo:true}]};
 assert.equal(initialPetForUnifiedService({tipo:"SERVICO"},source),"pet-1");
 assert.equal(initialPetForUnifiedService({tipo:"PRODUTO"},source),"");
 assert.equal(initialPetForUnifiedService({tipo:"SERVICO"},{...source,clientId:"tutor-B"}),"");
 assert.equal(initialPetForUnifiedService({tipo:"SERVICO"},{...source,pets:[{id:"pet-2"}]}),"");
 assert.equal(initialPetForUnifiedService({tipo:"SERVICO"},{...source,pets:[{id:"pet-1",ativo:false}]}),"");
 assert.match(page,/initialPetId=\{unifiedInitialPet\}/);
 assert.match(page,/setUnifiedInitialPet\(petId\|\|null\)/);
 assert.match(unified,/initialPetForUnifiedService\(item/);
});

test("entrada do PDV é a central de comandas com abertura lateral e categorias",()=>{
 assert.match(page,/useState\("COMANDAS"\)/);
 assert.match(page,/<PdvOrdersHome/);
 assert.match(home,/Em aberto/);
 assert.match(home,/Fechadas hoje/);
 assert.match(home,/Orçamentos/);
 assert.match(home,/Abrir nova comanda/);
 assert.match(home,/Tutor \(opcional para produtos\)/);
 assert.match(home,/Pet \(obrigatório apenas para serviços\)/);
 assert.match(page,/pdv-order-workspace/);
 assert.match(page,/Voltar às comandas/);
});
test("comanda lançada exige tutor e pet para serviço e quantidade configurável",()=>{
 assert.match(page,/serviceNeedsTutorAndPet\(selectedCommandItem\)/);
 assert.match(page,/Quantidade a lançar na comanda/);
 assert.match(page,/quantidade: commandQuantity/);
 assert.match(page,/petId: item\?\.tipo === "SERVICO"/);
 assert.match(page,/\(!commandClient\?\.id\|\|!commandPetId\)/);
 assert.match(unified,/stepPdvQuantity\(row,row.quantidade,-1\)/);
 assert.match(unified,/sanitizePdvQuantity\(row,e.target.value,row.quantidade\)/);
 assert.match(unified,/min=\{row.tipo==="SERVICO"\?"1":"0.001"\}/);
});
test("histórico e rascunho multiempresa são consultados pela central",()=>{
 assert.match(page,/\["pdv-unified-order-list",selectedOrganization\?\.id,selectedCompany\?\.id\]/);
 assert.match(page,/onOpenDraft=\{draft=>/);
 assert.match(page,/openDraftId=\{unifiedDraftToOpen\}/);
 assert.match(unified,/restoredId.current=openDraftId;reopen\(saved\)/);
 assert.match(home,/kind:"COMANDA"/);
 assert.match(home,/kind:"UNIFICADA"/);
 assert.match(home,/kind:"VENDA"/);
});

test("aba de orçamentos usa registros reais e a mesma permissão de leitura do financeiro",()=>{
 const apiRoutes=readFileSync(new URL("../../api/src/modules/pdv/pdv.routes.js",import.meta.url),"utf8");
 const apiService=readFileSync(new URL("../../api/src/modules/pdv/pdv.service.js",import.meta.url),"utf8");
 assert.match(apiRoutes,/router.get\("\/orcamentos", exigirPermissao\("financeiro.visualizar"\), controller.listarOrcamentosPdv\)/);
 assert.match(apiService,/where:\{organizacaoId,empresaId\}/);
 assert.match(page,/api.get\("\/pdv\/orcamentos"\)/);
 assert.match(page,/onOpenQuote=\{quote=>navigate/);
 assert.match(home,/kind:"ORCAMENTO"/);
 assert.match(home,/filter==="FECHADAS"/);
});


test("M.5.74: abrir comanda nao causa tela branca e a central exibe CNPJs autorizados",()=>{
 const imports=page.slice(0,page.indexOf("from \"lucide-react\""));
 assert.match(imports,/\bClipboardList\b/,"O icone do detalhe precisa estar importado");
 assert.match(page,/api\.get\("\/pdv\/comandas\/central"\)/);
 assert.match(page,/api\.get\(`\/pdv\/comandas\/central\/\$\{commandDetailId\}`\)/);
 assert.match(page,/Total da comanda · CNPJs autorizados/);
 assert.match(page,/intelligentPreference&&centralAllowedCompanies\.has\(item\.empresaId\)/);
 assert.match(page,/item\.status==="ATIVO"/);
 assert.match(page,/activeCommandItems\.length\?activeCommandItems\.map/);
 assert.match(page,/commandCatalog\.map\(item/);
 assert.match(page,/const currentCompanyCommandItems/);
 const routes=read("../../api/src/modules/pdv/pdv.routes.js");
 assert.match(routes,/\/comandas\/central/);
 assert.match(routes,/exigirPermissao\("pdv\.acessar"\), controller\.listarComandasCentral/);
 const svc=read("../../api/src/modules/pdv/pdv.service.js");
 assert.match(svc,/export async function listarComandasCentral/);
 assert.match(svc,/export async function buscarComandaCentral/);
 assert.match(svc,/usuarioEmpresa\.findMany/);
 assert.match(svc,/cargo: \{ ativo: true, permissoes:/);
 assert.match(svc,/empresa: \{ organizacaoId, ativo: true \}/);
 assert.match(svc,/itens: \{\s*where: \{ empresaId: \{ in: ids \}/);
});

test("M.5.74: erro de renderizacao do PDV apresenta recuperacao em vez de branco",()=>{
 const app=read("../src/App.jsx"),boundary=read("../src/components/PdvErrorBoundary.jsx");
 assert.match(app,/<PdvErrorBoundary><PdvPage \/><\/PdvErrorBoundary>/);
 assert.match(boundary,/getDerivedStateFromError/);
 assert.match(boundary,/Voltar à central do PDV/);
 assert.match(boundary,/consulte o histórico antes de tentar novamente/);
});
