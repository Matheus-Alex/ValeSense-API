import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const envPath = path.join(root, ".env");
if (!existsSync(envPath)) {
  await writeFile(envPath, await readFile(".env.example", "utf8"), { flag: "wx" });
  console.log("Configuração criada em backend/.env. Configure DATABASE_URL antes de iniciar.");
}
dotenv.config({ path: envPath });

async function setEnvValue(name, value) {
  let contents = await readFile(envPath, "utf8");
  const setting = new RegExp(`^${name}=.*$`, "m");
  if (setting.test(contents)) contents = contents.replace(setting, `${name}=${value}`);
  else contents += `\n${name}=${value}\n`;
  await writeFile(envPath, contents);
  process.env[name] = value;
}

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("Configure JWT_SECRET no ambiente de produção.");
}
if (process.env.NODE_ENV !== "production" && !process.env.JWT_SECRET) {
  await setEnvValue("JWT_SECRET", randomBytes(48).toString("hex"));
}
if (process.env.NODE_ENV !== "production" && !process.env.OTP_ENCRYPTION_KEY) {
  await setEnvValue("OTP_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
}
if (process.env.ADMIN_NAME && process.env.ADMIN_EMAIL && !process.env.ADMIN_PASSWORD) {
  await setEnvValue("ADMIN_PASSWORD", randomBytes(18).toString("base64url"));
  console.log("Senha do administrador inicial armazenada em backend/.env.");
}

if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || "") ||
    /USER:PASSWORD|CHANGE_ME/i.test(process.env.DATABASE_URL || "")) {
  throw new Error("Configure DATABASE_URL com as credenciais do PostgreSQL antes de iniciar.");
}

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

if (process.platform === "win32") {
  let workspace = root;
  const hasStartupScript = (directory) => existsSync(path.join(directory, "scripts", "iniciar.ps1"));
  while (!hasStartupScript(workspace) && path.dirname(workspace) !== workspace) {
    workspace = path.dirname(workspace);
  }
  const localDir = hasStartupScript(workspace)
    ? path.join(workspace, ".valesense-local", "binaries")
    : path.join(root, ".local", "binaries");
  await mkdir(localDir, { recursive: true });
  const source = path.join(root, "node_modules", "@prisma", "engines", "schema-engine-windows.exe");
  if (!existsSync(source)) run(["node_modules/prisma/build/index.js", "generate"]);
  process.env.PRISMA_SCHEMA_ENGINE_BINARY = path.join(localDir, "schema-engine.exe");
  await copyFile(source, process.env.PRISMA_SCHEMA_ENGINE_BINARY);
}

run(["node_modules/prisma/build/index.js", "generate"]);
run(["node_modules/typescript/bin/tsc"]);
await import("../dist/server.js");
