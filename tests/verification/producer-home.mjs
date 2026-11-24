import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import assert from "node:assert/strict";
const root=path.resolve("frontend");
const config=Object.fromEntries(fs.readFileSync(path.join(root,".env"),"utf8").split(/\r?\n/).filter(l=>/^\w+=/.test(l)).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const base="http://localhost:"+config.PORT;
async function api(route,body,token) {
 const response=await fetch(base+"/api/"+route,{method:body?"POST":"GET",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json(); if(!response.ok) throw new Error(route+" "+JSON.stringify(result)); return result;
}
const {token:admin}=await api("auth/login",{email:config.ADMIN_EMAIL,password:config.ADMIN_PASSWORD});
const email="browser-"+randomUUID()+"@example.test",password=randomUUID()+"aA1!";
const {user}=await api("users",{name:"Browser producer",email,password,role:"PRODUTOR_EXPORTADOR"},admin);
const {data:property}=await api("properties",{nome:"Browser property",areaTotal:10,localizacao:"Teste",usuarioId:user.id},admin);
const {data:plot}=await api("properties/"+property.id+"/plots",{nome:"Browser plot",area:5},admin);
const {sensor}=await api("sensors",{talhaoId:plot.id,identificador:"browser-"+randomUUID()},admin);
await api("weather-data",{sensorId:sensor.id,temperatura:27.5,umidade:62},admin);
await api("forecasts",{talhaoId:plot.id,tipo:"COLHEITA",dataInicio:new Date(Date.now()+86400000).toISOString(),dataFim:new Date(Date.now()+172800000).toISOString(),confianca:90},admin);
const browser=await chromium.launch({channel:"msedge",headless:true});
let staticServer;
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const nested=process.env.TEST_NESTED==="1";
 const serveRoot=process.env.TEST_SOURCE_ROOT?path.resolve(process.env.TEST_SOURCE_ROOT):process.cwd();
 const pageBase=process.env.TEST_PAGE_BASE||(nested?"http://localhost:5500"+(process.env.TEST_SOURCE_ROOT?"":"/"+path.relative(process.cwd(),root).split(path.sep).join("/")):base);
 if(nested) {
 staticServer=createServer((req,res)=>{
   const file=path.resolve(serveRoot,"."+decodeURIComponent(new URL(req.url,"http://localhost:5500").pathname));
   if(!file.startsWith(serveRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()) {res.writeHead(404);res.end("Not found");return;}
   const types={".html":"text/html",".js":"application/javascript",".css":"text/css",".svg":"image/svg+xml",".png":"image/png"};
   res.writeHead(200,{"Content-Type":types[path.extname(file)]||"application/octet-stream"});res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>staticServer.listen(5500,"127.0.0.1",resolve));
 }
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 if(process.env.TEST_NO_CHART==="1") await page.route("**/chart.umd.min.js",route=>route.abort());
 page.on("requestfailed",req=>console.log("REQUEST FAILED",req.url(),req.failure()?.errorText));
 await page.goto(pageBase+"/analista-de-dados/Login/Login.html");
 await page.locator("#email").fill(email); await page.locator("#senha").fill(password);
 await page.locator('button[type="submit"]').first().click();
 await page.waitForURL("**/produtor-exportador/Home/Home.html");
 await page.waitForTimeout(5000);
 if(!page.url().startsWith(pageBase+"/produtor-exportador/Home/Home.html")) throw new Error("A Home foi redirecionada incorretamente para "+page.url());
 assert.equal(await page.locator("#activeCount").textContent(),"1");
 assert.match(await page.locator("#latestTemperature").textContent(),/27,5/);
 assert.match(await page.locator("#forecastPanel").innerText(),/Browser plot/);
 if(await page.locator("#producerHistoryChart").count() && process.env.TEST_NO_CHART!=="1") {
   assert.match(await page.locator("#producerHistoryNote").innerText(),/1 leitura/);
   await page.locator("#producerHistoryType").selectOption("bar");
   await page.locator("#producerHistoryMetric").selectOption("umidade");
   assert.equal(await page.evaluate(()=>Chart.getChart(document.querySelector("#producerHistoryChart")).config.type),"bar");
 } else if(await page.locator("#producerHistoryChart").count()) assert.match(await page.locator("#producerHistoryNote").innerText(),/gráfico não carregou/);
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.setViewportSize({width:1440,height:1000});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({url:page.url(),source:serveRoot,errors,active:await page.locator("#activeCount").textContent(),status:"PASS: login, sensores, leituras, previsão e tela móvel"},null,2));
 await page.screenshot({path:".verification/producer-home.png",fullPage:true});
 if(nested) {
   await page.evaluate(()=>sessionStorage.removeItem("valesense_token"));
   await page.reload();
   await page.waitForURL(pageBase+"/analista-de-dados/Login/Login.html");
 }
} finally {
 await browser.close();
 if(staticServer) await new Promise(resolve=>staticServer.close(resolve));
 const {createRequire}=await import("node:module"); const require=createRequire(path.join(root,"package.json"));
 const client=require("./generated/index.js"); const db=new client.PrismaClient();
 await db.usuario.deleteMany({where:{id:user.id}}); await db.$disconnect();
}
