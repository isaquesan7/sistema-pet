/** PointVet commercial site: static assets and same-origin public plan proxy. */
import {createServer} from "node:http";
import {readFile,stat} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL(".",import.meta.url));
const port=Number(process.env.PORT||4174);
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8"};
const appUrl=process.env.POINTVET_APP_URL||"";
const apiUrl=process.env.POINTVET_API_URL||"";
const clean=(url)=>String(url).replace(/\/$/,"");
const noStore={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
createServer(async(req,res)=>{
  if(!["GET","HEAD"].includes(req.method)){res.writeHead(405);res.end();return;}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);}catch{res.writeHead(400);res.end();return;}
  if(pathname==="/config.js"){
    res.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8",...noStore});
    res.end(req.method==="HEAD"?undefined:"window.POINTVET_SITE_CONFIG="+JSON.stringify({appUrl,apiUrl})+";");
    return;
  }
  if(pathname==="/public-plans"){
    if(!apiUrl){res.writeHead(503,{"Content-Type":"application/json",...noStore});res.end('{"error":"API_NOT_CONFIGURED"}');return;}
    try{
      const upstream=await fetch(clean(apiUrl)+"/saas/publico/planos",{signal:AbortSignal.timeout(10000),headers:{Accept:"application/json"}});
      if(!upstream.ok)throw new Error("upstream "+upstream.status);
      const payload=await upstream.json();
      if(!Array.isArray(payload.dados))throw new Error("invalid plans");
      res.writeHead(200,{"Content-Type":"application/json; charset=utf-8",...noStore});
      res.end(req.method==="HEAD"?undefined:JSON.stringify({dados:payload.dados}));
    }catch{
      res.writeHead(502,{"Content-Type":"application/json",...noStore});
      res.end('{"error":"PLANS_UNAVAILABLE"}');
    }
    return;
  }
  const path=resolve(root,"."+pathname.replace(/\/$/,"/index.html"));
  if(!(path===root||path.startsWith(root.endsWith(sep)?root:root+sep))){res.writeHead(403);res.end();return;}
  try{
    const file=(await stat(path)).isFile()?path:resolve(root,"index.html");
    const contents=await readFile(file);
    res.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream",...noStore,"Content-Security-Policy":"default-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'"});
    res.end(req.method==="HEAD"?undefined:contents);
  }catch{res.writeHead(404);res.end("Not found");}
}).listen(port,"0.0.0.0",()=>console.log("PointVet landing listening on "+port));
