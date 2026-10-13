import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const code=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
test("legacy CORS_ORIGINS remains in place",()=>{
 assert.match(code,/process\.env\.CORS_ORIGINS/);
 assert.match(code,/corsOrigins\.includes\(origin\)/);
});
test("official management, portal, website and www origins are authorized",()=>{
 for(const host of ["pointvet.com.br","www.pointvet.com.br","app.pointvet.com.br","portal.pointvet.com.br"])
  assert.ok(code.includes('"https://'+host+'"'),host);
});
test("do not use wildcard origin with credentials",()=>{
 assert.doesNotMatch(code,/origin\s*:\s*["']\*["']/);
});
