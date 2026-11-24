import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../frontend/", import.meta.url)));
const port = Number(process.env.FRONTEND_PORT || 5500);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("FRONTEND_PORT deve ser uma porta válida.");
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }

  const segments = pathname.split(/[\\/]+/).filter(Boolean);
  if (segments.some((segment) => segment.startsWith("."))) {
    response.writeHead(404).end();
    return;
  }

  let target = path.resolve(root, `.${pathname}`);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    response.writeHead(404).end();
    return;
  }
  if (target === root) target = path.join(root, "index.html");

  try {
    let info = await stat(target);
    if (info.isDirectory()) {
      target = path.join(target, "index.html");
      info = await stat(target);
    }
    if (!info.isFile()) {
      response.writeHead(404).end();
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Length": info.size,
      "Content-Type": contentTypes.get(path.extname(target).toLowerCase()) || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(target).pipe(response);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      response.writeHead(404).end();
      return;
    }
    console.error("Falha ao servir arquivo do frontend:", error);
    response.writeHead(500).end();
  }
});

server.listen(port, () => {
  console.log(`ValeSense frontend disponível em http://localhost:${port}`);
});
