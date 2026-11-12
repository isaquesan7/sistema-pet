/** M.5.71 — referencias visuais como hierarquia de UX, nunca copia de marca.
 * Testes de estrutura, sem fingir homologacao em navegador.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const home=read("../src/components/PdvOrdersHome.jsx");
const page=read("../src/pages/PdvPage.jsx");
const css=read("../src/pdv.css");

test("central apresenta lista filtravel e painel de abertura e caixa",()=>{
 for(const text of ["Em aberto","Fechadas hoje","Orçamentos","Filtrar por tutor",
  "Filtrar por pet","Buscar ordem, cliente, CPF ou pet","Abrir ordem",
  "Tutor (opcional para produtos)","Pet (obrigatório apenas para serviços)",
  "Resumo e caixas","Suprimento","Sangria","Fechar caixa"]){
  assert.ok(home.includes(text),`Ausente: ${text}`);
 }
 assert.match(home,/clientId:filterClient,petId:filterPet/);
 assert.match(home,/onCashAction\("SUPPLY"\)/);
 assert.match(home,/onCashAction\("WITHDRAW"\)/);
 assert.match(home,/onCashAction\("CLOSE"\)/);
 assert.match(page,/onStartQuote=\{customerId=>navigate/);
});
test("central nao duplica venda vinculada a comanda e nao conta estorno como fechada hoje",()=>{
 assert.match(home,/commandedIds=new Set\(commands\.map/);
 assert.match(home,/!commandedIds\.has\(order\.comandaId\)/);
 assert.match(home,/\["FECHADA","FINALIZADA"\]\.includes\(row\.status\)/);
 assert.match(home,/formatDocument\(row\.order\.cliente\.cpfCnpj\)/);
});
test("workspace tem painel de itens e identificacao com resumo por CNPJ",()=>{
 for(const name of ["pdv-command-main","pdv-command-line-list","pdv-command-sidebar",
  "pdv-command-identification","pdv-command-close","Total da comanda · CNPJs autorizados",
  "Itens pendentes deste CNPJ","Registrar pagamento e fechar este CNPJ"]){
  assert.ok(page.includes(name),`Ausente: ${name}`);
 }
 assert.match(page,/commandCompanyVisibleTotal=round/);
 assert.doesNotMatch(page,/Distribuição por empresa/);
 assert.match(page,/Itens pendentes deste CNPJ/);
 assert.match(page,/commandPaymentsTotal===currentCompanyCommandTotal/);
 assert.match(page,/commandReadyToClose=currentCompanyCommandItems\.length>0/);
 assert.match(page,/commandPaymentsTotal===currentCompanyCommandTotal/);
 assert.doesNotMatch(page,/commandModal|setCommandModal|commandClientId|setCommandClientId/);
 assert.equal((page.match(/<PdvOrdersHome\b/g)||[]).length,1);
 assert.equal((page.match(/api\.post\("\/pdv\/comandas"/g)||[]).length,1);
 assert.match(page,/disabled=\{!commandReadyToClose\|\|closeCommandMutation\.isPending\}/);
 assert.match(page,/api\.post\(`\/pdv\/comandas\/\$\{commandDetailId\}\/fechar`/);
 assert.doesNotMatch(page,/FECHAR E BAIXAR/);
});
test("o design usa a identidade PointVet e layouts compactos/responsivos",()=>{
 assert.match(page,/pdv-hero--order-mode/);
 assert.match(page,/tab!=="COMANDAS"&&<section className="pdv-summary-grid">/);
 assert.match(css,/\.pdv-command-detail\{grid-template-columns/);
 assert.match(css,/@media\(max-width:620px\)/);
 for(const source of [home,page,css])assert.doesNotMatch(source,/LOOPVET|LOOPVET.COM|#3479d6/i);
});

test("troca de CNPJ da mesma organizacao preserva comanda e descarta valores temporarios",()=>{
 assert.match(page,/previousOrganizationIdRef\.current===nextOrganizationId/);
 assert.match(page,/hasPermission\("pdv\.acessar"\)/);
 assert.match(page,/if\(!keepOrder\)\{setCommandDetailId\(null\)/);
 assert.match(page,/setCommandItemId\(""\)/);
 assert.match(page,/setCommandPayments\(\[\{forma:"PIX",valor:0,parcelas:1\}\]\)/);
 assert.match(page,/queryKey: \["pdv-command-detail", selectedOrganization\?\.id, selectedCompany\?\.id, commandDetailId\]/);
 assert.match(page,/queryKey: \["pdv-commands", selectedOrganization\?\.id, selectedCompany\?\.id\]/);
});
