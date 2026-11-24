import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const find = dir => { for(const e of fs.readdirSync(dir,{withFileTypes:true})) { if(!e.isDirectory() || e.name.startsWith('.') || e.name==='node_modules') continue; const p=path.join(dir,e.name); if(e.name==='frontend') return p; const r=find(p); if(r)return r; } };
const root=find(process.cwd());
const env=fs.readFileSync(path.join(root,'.env'),'utf8');
const get=k=>env.match(new RegExp('^'+k+'=(.*)$','m'))?.[1].trim().replace(/^["']|["']$/g,'');
const require=createRequire(path.join(root,'package.json'));const {PrismaClient}=require('./generated/index.js');const db=new PrismaClient();
const email='producer-ui-'+randomUUID()+'@example.test';const password='Test-'+randomUUID();
async function api(route,body,token){const response=await fetch('http://localhost:3333/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const data=await response.json();assert(response.ok,JSON.stringify(data));return data;}
const {token}=await api('auth/login',{email:get('ADMIN_EMAIL'),password:get('ADMIN_PASSWORD')});
await api('users',{name:'Verificação de layout',email,password,role:'PRODUTOR_EXPORTADOR'},token);
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3333/analista-de-dados/Login/Login.html');
 await page.locator('#email').fill(email); await page.locator('#senha').fill(password);
 await page.locator('button[type=submit]').first().click(); await page.waitForURL('**/produtor-exportador/Home/Home.html');
 for(const route of ['Home/Home.html','Propriedades/Propriedades.html','Leituras/Leituras.html','Mercado/Mercado.html','Previsoes/Previsoes.html','Alertas/Alertas.html','Configuracoes/Configuracoes.html']) {
 await page.goto('http://localhost:3333/produtor-exportador/'+route);await page.waitForTimeout(700);
 assert(page.url().includes('/produtor-exportador/'));assert.equal(await page.locator('.pe-topbar').count(),1);assert.equal(await page.locator('.pe-nav').count(),1);
 const links=await page.locator('.pe-nav a').evaluateAll(a=>a.map(e=>e.href));assert(links.every(h=>h.includes('/produtor-exportador/')));
 console.log('OK '+route);
 }
 await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:3333/produtor-exportador/Propriedades/Propriedades.html');await page.waitForTimeout(500);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]); console.log('OK mobile e JavaScript');
} finally {await browser.close();await db.usuario.deleteMany({where:{email}});await db.$disconnect();}
