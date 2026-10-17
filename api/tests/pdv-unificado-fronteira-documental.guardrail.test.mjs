/**
 * M.5.33 — CI-only architecture sentinel, NOT a security authorization engine.
 * It checks current imports/side effects of M.5.29–32 and the runtime entry
 * graph. It intentionally fails if the documentary boundary changes without
 * a separately reviewed decision. Does not access DB, network or customers.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {dirname,join,relative,resolve,extname} from "node:path";
import {fileURLToPath} from "node:url";

const repo=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const src=join(repo,"api/src");
const pdv="api/src/modules/pdv/";
const guards=Object.freeze({
 "pdv-unificado-custodia-devolucoes.contract.js": ["node:crypto"],
 "pdv-unificado-custodia-devolucoes-sandbox.service.js": [
  "../../config/prisma.js",
  "./pdv-unificado-venda-sandbox.service.js",
  "./pdv-unificado-diagnostico-devolucoes.service.js",
  "./pdv-unificado-dossie-devolucoes.contract.js",
  "./pdv-unificado-custodia-devolucoes.contract.js"
 ],
 "pdv-unificado-minuta-custodia.contract.js": ["node:crypto",
  "./pdv-unificado-custodia-devolucoes.contract.js"],
 "pdv-unificado-minuta-custodia-sandbox.service.js": [
  "./pdv-unificado-custodia-devolucoes-sandbox.service.js",
  "./pdv-unificado-minuta-custodia.contract.js"
 ],
 "pdv-unificado-fronteira-evidencias.contract.js": ["node:crypto"],
 "pdv-unificado-fronteira-evidencias-sandbox.service.js": [
  "./pdv-unificado-minuta-custodia-sandbox.service.js",
  "./pdv-unificado-fronteira-evidencias.contract.js"
 ],
 "pdv-unificado-acesso-evidencias.contract.js": ["node:crypto",
  "./pdv-unificado-fronteira-evidencias.contract.js"],
 "pdv-unificado-acesso-evidencias-sandbox.service.js": [
  "./pdv-unificado-fronteira-evidencias-sandbox.service.js",
  "./pdv-unificado-acesso-evidencias.contract.js"
 ]
});
const guarded=new Set(Object.keys(guards).map(name=>pdv+name));
const expectedInbound=Object.freeze({
 "pdv-unificado-custodia-devolucoes.contract.js":[
  "pdv-unificado-custodia-devolucoes-sandbox.service.js",
  "pdv-unificado-minuta-custodia.contract.js"
 ],
 "pdv-unificado-custodia-devolucoes-sandbox.service.js":[
  "pdv-unificado-minuta-custodia-sandbox.service.js"
 ],
 "pdv-unificado-minuta-custodia.contract.js":[
  "pdv-unificado-minuta-custodia-sandbox.service.js"
 ],
 "pdv-unificado-minuta-custodia-sandbox.service.js":[
  "pdv-unificado-fronteira-evidencias-sandbox.service.js"
 ],
 "pdv-unificado-fronteira-evidencias.contract.js":[
  "pdv-unificado-fronteira-evidencias-sandbox.service.js",
  "pdv-unificado-acesso-evidencias.contract.js"
 ],
 "pdv-unificado-fronteira-evidencias-sandbox.service.js":[
  "pdv-unificado-acesso-evidencias-sandbox.service.js"
 ],
 "pdv-unificado-acesso-evidencias.contract.js":[
  "pdv-unificado-acesso-evidencias-sandbox.service.js"
 ],
 "pdv-unificado-acesso-evidencias-sandbox.service.js":[]
});
const forbiddenSideEffects=/\b(?:prisma|tx)\s*\.\s*(?:[A-Za-z_$][\w$]*\s*\.\s*)?(?:create|createMany|update|updateMany|upsert|delete|deleteMany|\$executeRaw|\$executeRawUnsafe)\s*\(|\b(?:fetch|require|XMLHttpRequest|FormData|createPresignedPost|putObject|writeFile|readFile)\s*\(/;

// Limited to the static ESM form used by this repository. Dynamic module
// loading is separately forbidden in the eight guarded files.
function importsFrom(source){
 return [...source.matchAll(/^\s*(?:import|export)\s+(?:[^;'\"]*?\s+from\s+)?["']([^"']+)["']/gm)]
  .map(match=>match[1]);
}
function listSources(dir){
 const result=[];
 for(const entry of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);
  if(entry.isDirectory())result.push(...listSources(path));
  else if(entry.isFile()&&[".js",".mjs"].includes(extname(path)))
   result.push(path);
 }
 return result;
}
function loadSources(){
 return new Map(listSources(src).map(path=>[
  relative(repo,path).replaceAll("\\","/"),readFileSync(path,"utf8")
 ]));
}
function resolveDependency(importer,specifier){
 if(!specifier.startsWith("."))return null;
 const file=resolve(repo,dirname(importer),specifier);
 return relative(repo,extname(file)?file:file+".js").replaceAll("\\","/");
}
function auditBoundary(sources){
 const findings=[];
 const graph=new Map(),parents=new Map();
 for(const [path,source] of sources){
  const imports=importsFrom(source);
  const next=imports.map(value=>resolveDependency(path,value)).filter(Boolean);
  graph.set(path,next);
  for(const target of next){
   if(!parents.has(target))parents.set(target,[]);
   parents.get(target).push(path);
  }
  if(!guarded.has(path)&&/\b(?:import|require)\s*\(/.test(source)&&
     [...guarded].some(target=>source.includes(target.slice(pdv.length))))
   findings.push(`DYNAMIC_REFERENCE_TO_BOUNDARY:${path}`);
  if(!guarded.has(path))continue;
  const name=path.slice(pdv.length);
  const expected=guards[name];
  if(JSON.stringify([...imports].sort())!==JSON.stringify([...expected].sort()))
   findings.push(`IMPORTS_CHANGED:${path}`);
  if(forbiddenSideEffects.test(source)||/\bimport\s*\(/.test(source))
   findings.push(`SIDE_EFFECT_RISK:${path}`);
  if(/\b(?:router|app)\s*\.\s*(?:get|post|put|patch|delete|use)\s*\(/.test(source))
   findings.push(`HTTP_HANDLER_IN_BOUNDARY:${path}`);
 }
 for(const target of guarded){
  if(!sources.has(target))findings.push(`BOUNDARY_MISSING:${target}`);
  const actual=(parents.get(target)??[]).sort();
  const allowed=expectedInbound[target.slice(pdv.length)].map(name=>pdv+name).sort();
  if(JSON.stringify(actual)!==JSON.stringify(allowed))
   findings.push(`INBOUND_CHANGED:${target}`);
 }
 const roots=["api/src/app.js","api/src/server.js",
  ...[...sources.keys()].filter(path=>path.endsWith(".routes.js"))];
 const visited=new Set(),pending=[...roots];
 while(pending.length){
  const path=pending.pop();
  if(visited.has(path))continue;
  visited.add(path);
  for(const child of graph.get(path)??[])
   if(sources.has(child))pending.push(child);
 }
 for(const path of guarded)
  if(visited.has(path))findings.push(`HTTP_REACHABILITY:${path}`);
 return findings;
}

test("M.5.33 checks eight documentary modules for HTTP exposure and direct write patterns",()=>{
 const sources=loadSources();
 assert(sources.size>100,"full runtime tree must be inspected");
 assert.deepEqual(auditBoundary(sources),[]);
});

test("M.5.33 sentinel detects HTTP exposure, storage SDK, dynamic imports and DB mutation",()=>{
 const base=loadSources();
 const cases=[
  ["api/src/modules/pdv/pdv-unificado.routes.js",
   '\nimport {consultarDecisaoAcessoEvidenciaSomenteSandbox} from "./pdv-unificado-acesso-evidencias-sandbox.service.js";\n',
   "INBOUND_CHANGED:"],
  [pdv+"pdv-unificado-fronteira-evidencias.contract.js",
   '\nimport {S3Client} from "@aws-sdk/client-s3";\n',"IMPORTS_CHANGED:"],
  [pdv+"pdv-unificado-acesso-evidencias-sandbox.service.js",
   '\nawait prisma.evidencia.create({data:{}});\n',"SIDE_EFFECT_RISK:"],
  [pdv+"pdv-unificado-minuta-custodia-sandbox.service.js",
   '\nconst adapter=await import("./storage-adapter.js");\n',"SIDE_EFFECT_RISK:"],
  ["api/src/modules/pdv/pdv-unificado.routes.js",
   '\nconst boundary=await import("./pdv-unificado-acesso-evidencias-sandbox.service.js");\n',
   "DYNAMIC_REFERENCE_TO_BOUNDARY:"]
 ];
 for(const [path,addition,expected] of cases){
  assert(base.has(path),path);
  const modified=new Map(base);
  modified.set(path,base.get(path)+addition);
  assert(auditBoundary(modified).some(x=>x.startsWith(expected)),expected);
 }
});
