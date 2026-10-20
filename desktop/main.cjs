const {
  app,
  BrowserWindow,
  protocol,
  net,
  shell,
  dialog,
} = require("electron");
const { readFile, mkdir, copyFile } = require("node:fs/promises");
const { constants } = require("node:fs");
const { join, resolve, sep, extname } = require("node:path");
const { pathToFileURL } = require("node:url");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "doser",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
app.setName("Doser");
if (process.env.DOSER_USER_DATA_DIR)
  app.setPath("userData", resolve(process.env.DOSER_USER_DATA_DIR));
let window;
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
app.on("second-instance", () => {
  if (window) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
});
const external = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password)
      void shell.openExternal(url.href);
  } catch {}
};
async function start() {
  const root = app.getAppPath();
  const directory = join(app.getPath("userData"), "catalog");
  await mkdir(directory, { recursive: true });
  try {
    await copyFile(
      join(root, "build-native/seed/catalog.json"),
      join(directory, "catalog.json"),
      constants.COPYFILE_EXCL,
    );
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
  const { createCatalogUpdater } = await import(
    pathToFileURL(join(root, "build-native/updater.mjs")).href
  );
  const updater = createCatalogUpdater(
    directory,
    net.fetch,
    join(root, "data/clinical/curated.json"),
  );
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  let lastUpdate = 0;
  protocol.handle("doser", async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== "app" || url.username || url.password)
        return new Response(null, { status: 403 });
      if (url.pathname.startsWith("/api/")) {
        if (request.method === "GET" && url.pathname === "/api/catalog/status")
          return json(await updater.getStatus());
        if (request.method === "GET" && url.pathname === "/api/catalog")
          return json(await updater.snapshot());
        if (
          request.method === "POST" &&
          url.pathname === "/api/catalog/update"
        ) {
          const origin = request.headers.get("Origin");
          if (
            request.headers.get("X-Doser-Request") !== "1" ||
            (origin && origin !== "doser://app")
          )
            return json({ error: "Origem bloqueada." }, 403);
          const status = await updater.getStatus();
          if (!status.updating && Date.now() - lastUpdate < 30000)
            return json(
              { error: "Aguarde 30 segundos para atualizar novamente." },
              429,
            );
          lastUpdate = Date.now();
          const result = await updater.update();
          return json(result, result.lastError ? 502 : 200);
        }
        return json({ error: "Operação não disponível." }, 404);
      }
      if (!["GET", "HEAD"].includes(request.method))
        return new Response(null, { status: 405 });
      const dist = resolve(root, "dist");
      const path = resolve(
        dist,
        "." +
          decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
          ),
      );
      if (!path.startsWith(dist + sep))
        return new Response(null, { status: 403 });
      const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      };
      return new Response(
        request.method === "HEAD" ? null : await readFile(path),
        {
          headers: {
            "Content-Type": types[extname(path)] || "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-cache",
          },
        },
      );
    } catch {
      return new Response("Não foi possível carregar o recurso local.", {
        status: 500,
      });
    }
  });
  function open() {
    window = new BrowserWindow({
      title: "Doser",
      icon: join(root, "desktop/icon.png"),
      width: 1280,
      height: 850,
      minWidth: 360,
      minHeight: 560,
      show: false,
      backgroundColor: "#F8FAF9",
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });
    window.webContents.session.setPermissionRequestHandler(
      (_web, _permission, callback) => callback(false),
    );
    window.webContents.session.setPermissionCheckHandler(() => false);
    window.webContents.on("will-attach-webview", (event) =>
      event.preventDefault(),
    );
    window.webContents.setWindowOpenHandler(({ url }) => {
      external(url);
      return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
      if (
        new URL(url).protocol !== "doser:" ||
        new URL(url).hostname !== "app"
      ) {
        event.preventDefault();
        external(url);
      }
    });
    window.once("ready-to-show", () => window.show());
    window.on("closed", () => {
      window = undefined;
    });
    void window.loadURL("doser://app/");
  }
  open();
  app.on("activate", () => {
    if (!window) open();
  });
}
if (locked)
  app
    .whenReady()
    .then(start)
    .catch((error) => {
      dialog.showErrorBox("Doser não iniciou", error.message);
      app.quit();
    });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
