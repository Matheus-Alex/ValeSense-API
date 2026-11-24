import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoot = path.join(root, "frontend");
const frontendBase = new URL(process.env.FRONTEND_URL || "http://127.0.0.1:5500");
const apiBase = new URL(process.env.API_URL || "http://127.0.0.1:3333");
const targets = new Set(["/"]);
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else files.push(file);
  }
}

function addReference(file, reference) {
  if (/^(?:https?:|data:|#|mailto:|tel:|javascript:|blob:)/i.test(reference)) return;
  const resolved = new URL(reference, new URL(`/${path.relative(frontendRoot, file).split(path.sep).join("/")}`, frontendBase));
  if (resolved.origin === frontendBase.origin) targets.add(resolved.pathname);
}

walk(frontendRoot);
for (const file of files) {
  const extension = path.extname(file).toLowerCase();
  if (![".html", ".js", ".css"].includes(extension)) continue;
  const text = fs.readFileSync(file, "utf8");
  if (extension === ".html") {
    for (const [, reference] of text.matchAll(/(?:src|href|action)=["']([^"']+)["']/gi)) addReference(file, reference);
  }
  if (extension === ".css") {
    for (const [, reference] of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) addReference(file, reference);
  }
  if (extension === ".js") {
    for (const [, , reference] of text.matchAll(/(?:from\s*|import\s*\()(["'])(\.{1,2}\/[^"']+)\1/g)) addReference(file, reference);
  }
  targets.add(`/${path.relative(frontendRoot, file).split(path.sep).join("/")}`);
}

const failures = [];
for (const target of targets) {
  const response = await fetch(new URL(target, frontendBase));
  if (response.status !== 200) {
    failures.push(`${target} -> HTTP ${response.status}`);
    continue;
  }
  const type = response.headers.get("content-type") || "";
  if (/\.html$/i.test(target) && !type.includes("text/html")) failures.push(`${target} -> ${type}`);
  if (/\.css$/i.test(target) && !type.includes("text/css")) failures.push(`${target} -> ${type}`);
  if (/\.js$/i.test(target) && !type.includes("javascript")) failures.push(`${target} -> ${type}`);
  await response.arrayBuffer();
}

const configResponse = await fetch(new URL("/api/public-config", apiBase), {
  headers: { Origin: frontendBase.origin },
});
assert.equal(configResponse.status, 200, "API pública deve responder");
assert.equal(configResponse.headers.get("access-control-allow-origin"), frontendBase.origin, "CORS deve permitir o frontend local");
const publicConfig = await configResponse.json();
assert.deepEqual(Object.keys(publicConfig), ["thingspeakChannelId"]);
assert.ok(publicConfig.thingspeakChannelId === null || /^[1-9]\d*$/.test(publicConfig.thingspeakChannelId));
assert.equal((await fetch(new URL("/api/missing", apiBase))).status, 404, "Rota desconhecida da API deve retornar 404");
assert.deepEqual(failures, [], "Recursos locais do frontend devem responder");
console.log(`PASS: ${targets.size} destinos do frontend, configuração pública e respostas HTTP da API.`);
