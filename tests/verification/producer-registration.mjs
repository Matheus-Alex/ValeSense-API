import {chromium} from "playwright";
import {createRequire} from "node:module";
import path from "node:path";
import fs from "node:fs";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
const relative="frontend";
const root=path.resolve(relative);
const require=createRequire(path.join(root,"package.json"));
require("dotenv").config({path:path.join(root,".env")});
const client=require("./generated/index.js"),db=new client.PrismaClient();
const browser=await chromium.launch({channel:"msedge",headless:true});
const emails=[];
try {
 for(const other of [false,true]) {
  const page=await browser.newPage();
  const source=root;
  const base=other?"http://localhost:5173":"http://127.0.0.1:5500/"+relative;
  if(false) await page.route("**/registration-copy/**",async route=>{
   const file=path.join(source,decodeURIComponent(new URL(route.request().url()).pathname).replace("/registration-copy/",""));
   const types={".html":"text/html",".js":"application/javascript",".css":"text/css",".svg":"image/svg+xml",".png":"image/png"};
   if(!fs.existsSync(file)) return route.fulfill({status:404,body:"missing"});
   await route.fulfill({contentType:types[path.extname(file)]||"application/octet-stream",body:fs.readFileSync(file)});
  });
  const email="register-producer-"+randomUUID()+"@example.test",password="Browser-"+randomUUID();
  emails.push(email);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/analista-de-dados/Cadastre-se/Cadastre-se.html");
  if(other) {
   await page.locator("#name").fill("Produtor teste");await page.locator("#email").fill(email);
   await page.locator("#role").selectOption("PRODUTOR_EXPORTADOR");
   await page.locator("#senha").fill(password);await page.locator("#confirmaSenha").fill(password);
  } else {
   await page.locator('[name="name"]').fill("Produtor teste");await page.locator('[name="email"]').fill(email);
   await page.locator('[name="role"]').selectOption("PRODUTOR_EXPORTADOR");await page.locator('[name="password"]').fill(password);
  }
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/Login/Login.html");
  const saved=await db.usuario.findUnique({where:{email}});
  assert.equal(saved?.perfil,"PRODUTOR_EXPORTADOR");
  await page.locator("#email").fill(email);await page.locator("#senha").fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL("**/produtor-exportador/Home/Home.html");
  await page.waitForTimeout(1000);
  assert(page.url().startsWith(base+"/produtor-exportador/"));
  assert.deepEqual(errors,[]);
  console.log("PASS: cadastro público, perfil PostgreSQL e login do produtor ("+(other?"cópia IDE":"workspace")+").");
  await page.close();
 }
 const denied=await fetch("http://localhost:3333/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Admin proibido",email:"denied-"+randomUUID()+"@example.test",password:"TestPassword123",role:"ADMIN"})});
 assert.equal(denied.status,400);
 console.log("PASS: cadastro público de administrador recusado.");
} finally {
 await browser.close();
 await db.usuario.deleteMany({where:{email:{in:emails}}});await db.$disconnect();
}
