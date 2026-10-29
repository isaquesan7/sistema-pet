import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {unifiedScopedQueryKey,visibleUnifiedClients,keepUnifiedPdvRouteOnCompanyChange} from "../src/lib/unifiedDraft.js";

test("queries cannot reuse a cached response from another selected company or organization",()=>{
 const a=unifiedScopedQueryKey("unified-catalog","organizacao-a","empresa-a","racao");
 assert.deepEqual(a,["unified-catalog","organizacao-a","empresa-a","racao"]);
 assert.notDeepEqual(a,unifiedScopedQueryKey("unified-catalog","organizacao-a","empresa-b","racao"));
 assert.notDeepEqual(a,unifiedScopedQueryKey("unified-catalog","organizacao-b","empresa-a","racao"));
 assert.deepEqual(unifiedScopedQueryKey("unified-clients",null,undefined),["unified-clients",null,null]);
});

test("a reopened draft keeps its persisted tutor selected during a filtered search",()=>{
 const persisted={id:"tutor-1",nome:"Tutora de homologacao"};
 const another={id:"tutor-2",nome:"Cliente da busca"};
 assert.deepEqual(visibleUnifiedClients([another],persisted),[persisted,another]);
 assert.deepEqual(visibleUnifiedClients([persisted,another],persisted),[persisted,another]);
 assert.deepEqual(visibleUnifiedClients([],null),[]);
 assert.deepEqual(visibleUnifiedClients(undefined,persisted),[persisted]);
});

test("company switch preserves unified workspace only inside the same authorized organization",()=>{
 const path="/pdv/unificado/simulacao";
 const allowed={id:"b",organizacaoId:"org-a",permissoes:["pdv.acessar"]};
 assert.equal(keepUnifiedPdvRouteOnCompanyChange(path,"org-a",allowed),true);
 assert.equal(keepUnifiedPdvRouteOnCompanyChange("/pdv","org-a",allowed),false);
 assert.equal(keepUnifiedPdvRouteOnCompanyChange("/pdv","org-a",allowed,true),true);
 assert.equal(keepUnifiedPdvRouteOnCompanyChange("/pdv","org-b",allowed,true),false);
 assert.equal(keepUnifiedPdvRouteOnCompanyChange("/pdv","org-a",{...allowed,permissoes:[]},true),false);
 assert.equal(keepUnifiedPdvRouteOnCompanyChange(path,"org-b",allowed),false);
 assert.equal(keepUnifiedPdvRouteOnCompanyChange(path,"org-a",{...allowed,permissoes:[]}),false);
 assert.equal(keepUnifiedPdvRouteOnCompanyChange(path,"org-a",null),false);
 const layout=readFileSync(new URL("../src/layout/AppLayout.jsx",import.meta.url),"utf8");
 assert.match(layout,/keepUnifiedPdvRouteOnCompanyChange\(location\.pathname, selectedOrganization\?\.id, nextCompany,/);
 assert.match(layout,/const sameOrganization = Boolean\(selectedOrganization\?\.id\)/);
 assert.match(layout,/const routeAllowed = route &&/);
 assert.match(layout,/nextCompany\.permissoes\?\.includes\(route\.permission\)/);
 assert.match(layout,/!route\.companyTypes \|\| route\.companyTypes\.includes\(nextCompany\.tipo\)/);
 assert.match(layout,/if \(!keepWorkspace\) navigate\("\/"\)/);
});

test("operator search clears stale tutor selection; reservation prevents editing it",()=>{
 const page=readFileSync(new URL("../src/pages/UnifiedPdvPreviewPage.jsx",import.meta.url),"utf8");
 assert.match(page,/function UnifiedPdvWorkspace\(\{openDraftId,initialClientId,initialPetId\}\)/);
 assert.match(page,/key=\{selectedOrganization\?\.id\|\|"sem-organizacao"\}/);
 assert.ok(page.includes('setClientSearch(value);setClientId("");setSelectedClient(null)'));
 assert.match(page,/setSelectedClient\(saved\.cliente\|\|null\)/);
 assert.ok(page.includes('setClientSearch(value);setClientId("");setSelectedClient(null)'));
 assert.match(page,/search=\{clientSearch\} onSearch=\{value=>/);
 assert.match(page,/value=\{clientId\} disabled=\{isReserved\}/);
 for(const name of ["unified-eligibility","unified-clients","unified-client-pets","unified-catalog","unified-drafts","unified-preclose","unified-close-plan","unified-reservation","unified-cash-sessions","unified-recovery-diagnosis","unified-preparation"]){
  assert.ok(page.includes(`scopedKey("${name}"`),`${name} must include organization and company in the cache key`);
 }
});
