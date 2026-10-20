import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { createCatalogMiddleware } from "./middleware.ts";
const root = resolve("dist");
const api = createCatalogMiddleware();
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  await api(req, res, () => {
    void (async () => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405).end();
        return;
      }
      let path: string;
      try {
        path = decodeURIComponent(
          new URL(req.url || "/", "http://localhost").pathname,
        );
      } catch {
        res.writeHead(400).end();
        return;
      }
      const file = resolve(root, `.${path === "/" ? "/index.html" : path}`);
      if (!file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      try {
        const data = await readFile(file);
        res.writeHead(200, {
          "Content-Type": mime[extname(file)] || "application/octet-stream",
          "Cache-Control": file.includes(`${sep}assets${sep}`)
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        });
        res.end(req.method === "HEAD" ? undefined : data);
      } catch {
        res
          .writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
          .end(
            "Arquivo não encontrado. Execute npm run build antes de iniciar.",
          );
      }
    })();
  });
});
const port = Number(process.env.DOSER_PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("DOSER_PORT deve estar entre 1024 e 65535.");
server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `A porta ${port} já está em uso. Se o Doser já estiver aberto, use a janela existente; caso contrário, feche o programa que usa essa porta.`
      : "Não foi possível iniciar o Doser nesta máquina.",
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(
    `Doser iniciado localmente na porta ${port}. Mantenha esta janela aberta. Pressione Ctrl+C para encerrar.`,
  );
  if (process.platform === "win32" && process.env.DOSER_OPEN_BROWSER === "1") {
    const browser = spawn(
      "rundll32.exe",
      ["url.dll,FileProtocolHandler", `http://127.0.0.1:${port}/`],
      { detached: true, stdio: "ignore", windowsHide: true },
    );
    browser.on("error", () =>
      console.log(`Abra o navegador no endereço local da porta ${port}.`),
    );
    browser.unref();
  }
});
