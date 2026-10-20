import { describe, expect, it } from "vitest";
import { createServer, request } from "node:http";
import { createCatalogMiddleware } from "./middleware.ts";
describe("proteções do serviço local", () => {
  async function run(
    headers: Record<string, string>,
    method = "POST",
    path = "/api/catalog/update",
  ) {
    const server = createServer((req, res) => {
      void createCatalogMiddleware()(req, res);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Falha no teste");
    try {
      return await new Promise<{
        status: number;
        headers: Record<string, unknown>;
      }>((resolve, reject) => {
        const req = request(
          { hostname: "127.0.0.1", port: address.port, path, method, headers },
          (res) => {
            res.resume();
            res.on("end", () =>
              resolve({ status: res.statusCode!, headers: res.headers }),
            );
          },
        );
        req.on("error", reject);
        req.end();
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    }
  }
  it("bloqueia alteração sem cabeçalho próprio e sem origem", async () => {
    expect((await run({})).status).toBe(403);
  });
  it("bloqueia origem externa mesmo com cabeçalho próprio", async () => {
    expect(
      (await run({ "X-Doser-Request": "1", Origin: "https://externo.example" }))
        .status,
    ).toBe(403);
  });
  it("bloqueia hosts externos contra DNS rebinding", async () => {
    expect(
      (
        await run(
          { Host: "dominio-externo.example" },
          "GET",
          "/api/catalog/status",
        )
      ).status,
    ).toBe(403);
  });
  it("bloqueia Fetch Metadata cross-site", async () => {
    expect(
      (
        await run(
          { "Sec-Fetch-Site": "cross-site" },
          "GET",
          "/api/catalog/status",
        )
      ).status,
    ).toBe(403);
  });
  it("não habilita CORS ou preflight de outro site", async () => {
    const result = await run({ Origin: "https://externo.example" }, "OPTIONS");
    expect(result.status).toBe(404);
    expect(result.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
