import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const find = dir => { for(const e of fs.readdirSync(dir,{withFileTypes:true})) { if(!e.isDirectory() || e.name.startsWith('.') || e.name==='node_modules') continue; const p=path.join(dir,e.name); if(e.name==='frontend') return p; const r=find(p); if(r)return r; } };
const root=find(process.cwd());
const env=fs.readFileSync(path.join(root,'.env'),'utf8');
const get=k=>env.match(new RegExp('^'+k+'=(.*)$','m'))?.[1].trim().replace(/^["']|["']$/g,'');
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3333/administrador/Login/Login.html');
 await page.locator('#email').fill(get('ADMIN_EMAIL')); await page.locator('#password').fill(get('ADMIN_PASSWORD'));
 await page.locator('button[type=submit]').click(); await page.waitForURL('**/administrador/Home/Home.html');
 for(const route of ['Propriedades/Propriedades.html','Leituras/Leituras.html#registrar','Leituras/Leituras.html#home','Leituras/Leituras.html#sensores','Leituras/Leituras.html','Mercado/Mercado.html','Previsoes/Previsoes.html','Alertas/Alertas.html','Configuracoes/Configuracoes.html','Frutas/Frutas.html','Mapas/Mapas.html']) {
 await page.goto('http://localhost:3333/administrador/'+route);await page.waitForTimeout(700);
 assert(page.url().includes('/administrador/'));assert.equal(await page.locator('.topbar').count(),1);assert.equal(await page.locator('.admin-sidebar-nav').count(),1);
 const links=await page.locator('.admin-sidebar-nav a').evaluateAll(a=>a.map(e=>e.href));assert(links.every(h=>h.includes('/administrador/')));
 console.log('OK '+route);
 }
 await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:3333/administrador/Propriedades/Propriedades.html');await page.waitForTimeout(500);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]); console.log('OK mobile e JavaScript');
} finally {await browser.close();}
