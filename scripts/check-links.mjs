import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoot = path.join(workspaceRoot, "frontend");
const files = [];
const missing = new Map();

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist", "generated"].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else files.push(file);
  }
}

function checkReference(sourceFile, reference) {
  const value = reference.trim();
  if (!value || /^(?:https?:|data:|#|mailto:|tel:|javascript:|blob:)/i.test(value)) return;
  let pathname;
  try {
    pathname = decodeURIComponent(value.split(/[?#]/, 1)[0]);
  } catch {
    missing.set(`invalid-url-encoding:${value}`, 1);
    return;
  }
  if (!pathname || pathname.startsWith("/api/") || pathname === "/health") return;
  const target = path.resolve(pathname.startsWith("/")
    ? frontendRoot
    : path.dirname(sourceFile), pathname.replace(/^\//, ""));
  if (!target.startsWith(`${frontendRoot}${path.sep}`) && target !== frontendRoot) {
    missing.set(path.relative(workspaceRoot, target).replaceAll("\\", "/"), (missing.get(path.relative(workspaceRoot, target).replaceAll("\\", "/")) || 0) + 1);
    return;
  }
  if (!fs.existsSync(target)) {
    const relative = path.relative(workspaceRoot, target).replaceAll("\\", "/");
    missing.set(relative, (missing.get(relative) || 0) + 1);
  }
}

function collectReferences(file, text) {
  if (file.endsWith(".html")) {
    for (const [, reference] of text.matchAll(/(?:src|href|action)=["']([^"']+)["']/gi)) {
      checkReference(file, reference);
    }
  }
  if (file.endsWith(".css")) {
    for (const [, reference] of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      checkReference(file, reference);
    }
    for (const [, reference] of text.matchAll(/@import\s+["']([^"']+)["']/gi)) {
      checkReference(file, reference);
    }
  }
  if (file.endsWith(".js")) {
    for (const [, , reference] of text.matchAll(/(?:from\s*|import\s*\()(["'])(\.{1,2}\/[^"']+)\1/g)) {
      checkReference(file, reference);
    }
    for (const [, reference] of text.matchAll(/(?:location(?:\.href)?|window\.location(?:\.href)?)\s*=\s*["']([^"']+\.html(?:[?#][^"']*)?)["']/g)) {
      checkReference(file, reference);
    }
  }
}

walk(frontendRoot);
for (const file of files) {
  if (![".html", ".js", ".css"].includes(path.extname(file).toLowerCase())) continue;
  collectReferences(file, fs.readFileSync(file, "utf8"));
}

console.log(JSON.stringify([...missing], null, 2));
if (missing.size) process.exitCode = 1;
