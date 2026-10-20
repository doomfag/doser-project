import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createCatalogMiddleware } from "./server/middleware.ts";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "doser-local-catalog",
      configureServer(server) {
        const middleware = createCatalogMiddleware();
        server.middlewares.use((req, res, next) => {
          void middleware(req, res, next);
        });
      },
    },
  ],
  server: { host: "0.0.0.0" },
});
