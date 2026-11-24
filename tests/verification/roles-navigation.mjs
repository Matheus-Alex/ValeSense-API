import {chromium} from "playwright";
import {createRequire} from "node:module";
import path from "node:path";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
const relative="frontend";
const root=path.resolve(relative),require=createRequire(path.join(root,"package.json"));
require("dotenv").config({path:path.join(root,".env")});
const client=require("./generated/index.js"),db=new client.PrismaClient();
async function api(route,body,token){
 const response=await fetch("http://localhost:3333/api/"+route,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body)});
 const data=await response.json();assert(response.ok,JSON.stringify(data));return data;
}
const {token:admin}=await api("auth/login",{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD});
const browser=await chromium.launch({channel:"msedge",headless:true});
const emails=[];
try{
 const fixtures=[];
 for(const role of ["ADMIN","ANALISTA","PRODUTOR_EXPORTADOR"]){
  const email="roles-"+randomUUID()+"@example.test",password="Test-"+randomUUID();emails.push(email);
  await api("users",{name:"Teste "+role,email,password,role},admin);fixtures.push({role,email,password});
 }
 for(const base of ["http://localhost:3333","http://127.0.0.1:5500/"+relative,...(process.env.TEST_OTHER?["http://localhost:5173"]:[])]){
  for(const {role,email,password} of fixtures){
   const page=await browser.newPage(),errors=[];
   page.on("pageerror",error=>errors.push(error.message));
   const adminMode=role==="ADMIN";
   const login=base+(adminMode?"/administrador/Login/Login.html":"/analista-de-dados/Login/Login.html");
   await page.goto(login);
   await page.locator("#email").fill(email);await page.locator(adminMode?"#password":"#senha").fill(password);
   await page.locator('button[type="submit"]').first().click();
   const area=adminMode?"administrador":role==="ANALISTA"?"analista-de-dados":"produtor-exportador";
   const home=base+"/"+area+(role==="ANALISTA"?"/Dashboard/Dashboard.html":"/Home/Home.html");
   await page.waitForURL(home);await page.waitForTimeout(700);
   const routes=adminMode?["Sensores/Sensores.html","Registros/Registros.html"]:role==="ANALISTA"?["Frutas/Frutas.html","Mapas/Mapas.html"]:["Mercado/Mercado.html","Alertas/Alertas.html"];
   for(const route of routes){
    const response=await page.goto(base+"/"+area+"/"+route);assert.equal(response.status(),200);
    await page.waitForTimeout(400);assert(page.url().startsWith(base+"/"+area+"/"));
    const links=await page.locator("nav a").evaluateAll(nodes=>nodes.map(n=>n.href));
    for(const href of links.filter(h=>h.startsWith(new URL(base).origin))){
     assert(href.startsWith(base+"/"),"Menu saiu da pasta do projeto: "+href);
    }
   }
   if(role!=="ADMIN"){
    await page.goto(base+"/administrador/Home/Home.html");await page.waitForURL(home);
   }
   await page.locator("[data-logout]").first().click();await page.waitForURL(login);
   assert.equal(await page.evaluate(()=>sessionStorage.getItem("valesense_token")),null);
   assert.deepEqual(errors,[],role+" "+base);
   console.log("PASS: "+role+" login, navegação, acesso e saída em "+base);
   await page.close();
  }
 }
}finally{
 await browser.close();await db.usuario.deleteMany({where:{email:{in:emails}}});await db.$disconnect();
}
