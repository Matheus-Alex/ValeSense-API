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
const email='audit-analyst-'+randomUUID()+'@example.test';const password='Test-'+randomUUID();
async function api(route,body,token){const response=await fetch('http://localhost:3333/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const data=await response.json();assert(response.ok,JSON.stringify(data));return data;}
const {token}=await api('auth/login',{email:get('ADMIN_EMAIL'),password:get('ADMIN_PASSWORD')});
await api('users',{name:'Verificação de layout',email,password,role:'ANALISTA'},token);
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3333/analista-de-dados/Login/Login.html');
 await page.locator('#email').fill(email); await page.locator('#senha').fill(password);
 await page.locator('button[type=submit]').first().click(); await page.waitForURL('**/analista-de-dados/Dashboard/Dashboard.html');
 for(const route of ['Dashboard/Dashboard.html','Frutas/Frutas.html','Mapas/Mapas.html','Registro/Registro.html','Configuracoes/Configuracoes.html']) {
 const failed=[]; const listener=response=>{if(response.status()>=400)failed.push(response.status()+' '+new URL(response.url()).pathname);};page.on('response',listener);
 await page.goto('http://localhost:3333/analista-de-dados/'+route);await page.waitForTimeout(800);
 const details=await page.evaluate(()=>({title:document.title,header:document.querySelector('header')?.className,nav:[...document.querySelectorAll('nav a')].map(a=>({text:a.textContent.trim(),url:new URL(a.href).pathname+new URL(a.href).hash})),text:document.querySelector('main')?.innerText.slice(0,450),cssVars:!!getComputedStyle(document.documentElement).getPropertyValue('--bg')}));
 await page.setViewportSize({width:390,height:844});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth); if(overflow) console.log(await page.evaluate(()=>[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right})).slice(0,12)));await page.setViewportSize({width:1440,height:1000});
 console.log(JSON.stringify({route,details,overflow,failed}));assert.deepEqual(failed,[],route+' recursos');assert.equal(overflow,false,route+' largura');
 if(route==='Dashboard/Dashboard.html'){assert.equal(await page.evaluate(()=>typeof Chart),'function');await page.locator('#scrollNav a[data-section="sensores"]').click();await page.waitForTimeout(300);assert(!(await page.locator('#sensorStatusNote').innerText()).includes('Carregando'));}
 if(route==='Frutas/Frutas.html') {await page.locator('#frutaSearch').fill('teste');assert(!/ï¿½|�/.test(await page.locator('main').innerText()));}
 if(route==='Registro/Registro.html'){await page.locator('.tab').last().click();assert.equal(await page.locator('.tab-panel.active').count(),1);}
 if(route==='Configuracoes/Configuracoes.html'){assert.equal(await page.locator('#content form').count(),3);}
 await page.locator('[data-theme-toggle]').click();assert(await page.evaluate(()=>document.documentElement.classList.contains('dark-theme')));await page.locator('[data-theme-toggle]').click();page.off('response',listener);
 }
 assert.deepEqual(errors,[]);console.log('OK: navegação, gráficos, busca, abas, configurações, tema e celular sem erros.');
} finally {await browser.close();await db.usuario.deleteMany({where:{email}});await db.$disconnect();}

