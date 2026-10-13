/** Tiny static server for hosting the commercial site without touching existing services. */
import {createServer} from "node:http";
import {readFile,stat} from "node:fs/promises";
import {resolve, extname, sep} from "node:path";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL(".",import.meta.url));
const port=Number(process.env.PORT||4174);
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml",".ico":"image/x-icon"};
createServer(async(req,res)=>{
  if(!["GET","HEAD"].includes(req.method)){res.writeHead(405);res.end();return;}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);}catch{res.writeHead(400);res.end();return;}
  const path=resolve(root,"."+pathname.replace(/\/$/,"/index.html"));
  if(!(path===root||path.startsWith(root.endsWith(sep)?root:root+sep))){res.writeHead(403);res.end();return;}
  try{
    const file=(await stat(path)).isFile()?path:resolve(root,"index.html");
    const contents=await readFile(file);
    res.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:; connect-src 'self' https:; base-uri 'self'; object-src 'none'; frame-ancestors 'none'"});
    res.end(req.method==="HEAD"?undefined:contents);
  }catch{res.writeHead(404);res.end("Not found");}
}).listen(port,"0.0.0.0",()=>console.log("PointVet landing listening on "+port));
