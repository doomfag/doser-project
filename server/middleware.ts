import type { IncomingMessage, ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { createCatalogUpdater } from "./createUpdater.ts";
const localHosts = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
  ...Object.values(networkInterfaces()).flatMap(
    (v) => v?.map((x) => x.address) ?? [],
  ),
]);
export function createCatalogMiddleware(
  updater = createCatalogUpdater(resolve(".doser")),
) {
  let lastStart = 0;
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void = () => {
      res.writeHead(404).end();
    },
  ) => {
    const path = req.url?.split("?")[0];
    if (!path?.startsWith("/api/")) return next();
    const json = (status: number, value: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(value));
    };
    let url: URL;
    try {
      url = new URL(`http://${req.headers.host}`);
    } catch {
      return json(400, { error: "Host inválido." });
    }
    if (!localHosts.has(url.hostname))
      return json(403, {
        error: "O serviço Doser só aceita hosts da máquina local.",
      });
    if (req.headers["sec-fetch-site"] === "cross-site")
      return json(403, { error: "Requisição de outra origem bloqueada." });
    try {
      if (req.method === "GET" && path === "/api/catalog/status")
        return json(200, await updater.getStatus());
      if (req.method === "GET" && path === "/api/catalog")
        return json(200, await updater.snapshot());
      if (req.method === "POST" && path === "/api/catalog/update") {
        // Cabeçalho não simples impede requisições via formulários e exige preflight em origens externas.
        if (
          req.headers["x-doser-request"] !== "1" ||
          !req.headers.origin ||
          !["http:", "https:"].some(
            (protocol) => req.headers.origin === `${protocol}//${url.host}`,
          )
        )
          return json(403, { error: "Origem da atualização não autorizada." });
        const status = await updater.getStatus();
        if (!status.updating && Date.now() - lastStart < 30_000)
          return json(429, {
            error: "Aguarde 30 segundos antes de solicitar outra atualização.",
          });
        lastStart = Date.now();
        const result = await updater.update();
        return json(result.lastError ? 502 : 200, result);
      }
      return json(404, { error: "Operação não disponível." });
    } catch {
      return json(500, {
        error: "Falha no serviço local. Os dados existentes foram preservados.",
      });
    }
  };
}
