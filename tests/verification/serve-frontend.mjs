import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root=path.resolve(process.argv[2]);
const port=Number(process.argv[3]||5500);
const types={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon",".woff2":"font/woff2",".woff":"font/woff",".ttf":"font/ttf"};
const folders=new Set(["administrador","analista-de-dados","produtor-exportador","vendor"]);
createServer(async(req,res)=>{
 try {
  const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1:5500").pathname);
  if(pathname==="/") {res.writeHead(302,{Location:"/analista-de-dados/Login/Login.html","Cache-Control":"no-store"});res.end();return;}
  const parts=pathname.split("/").filter(Boolean);
  const target=path.resolve(root,"."+pathname);
  const ext=path.extname(target).toLowerCase();
  if(!target.startsWith(root+path.sep)||parts.some(p=>p.startsWith(".")||p.includes("\\"))||!types[ext]||(parts.length>1&&!folders.has(parts[0]))) {res.writeHead(404);res.end("Not found");return;}
  if(!(await stat(target)).isFile()) {res.writeHead(404);res.end("Not found");return;}
  const body=await readFile(target);
  res.writeHead(200,{"Content-Type":types[ext],"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(body);
 } catch {res.writeHead(404);res.end("Not found");}
}).listen(port,"127.0.0.1",()=>console.log("Interface disponível na porta "+port));
