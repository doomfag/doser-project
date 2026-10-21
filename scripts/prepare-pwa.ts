import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = "build-pwa";
await mkdir(root + "/icons", { recursive: true });
await copyFile("desktop/icon.png", root + "/icons/icon-512.png");
await copyFile("desktop/icon-1024.png", root + "/icons/apple-touch-icon.png");
const manifest = {
  id: "./",
  name: "Doser",
  short_name: "Doser",
  lang: "pt-BR",
  start_url: "./",
  scope: "./",
  display: "standalone",
  background_color: "#F8FAF9",
  theme_color: "#14261E",
  description: "Consulta farmacológica e biblioteca pessoal.",
  icons: [
    {
      src: "./icons/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
  ],
};
await writeFile(
  root + "/manifest.webmanifest",
  JSON.stringify(manifest, null, 2) + "\n",
);
let html = await readFile(root + "/index.html", "utf8");
html = html.replace(
  "</head>",
  '<link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icons/apple-touch-icon.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Doser"><meta name="apple-mobile-web-app-status-bar-style" content="default"></head>',
);
// Static distribution: no development websocket or remote script permissions.
html = html.replace(
  "connect-src 'self' ws://localhost:* ws://127.0.0.1:*",
  "connect-src 'self'; manifest-src 'self'; worker-src 'self'",
);
await writeFile(root + "/index.html", html);
const revision = createHash("sha256").update(html).digest("hex").slice(0, 20);
const worker = `const SCOPE=new URL(self.registration.scope);\nconst PREFIX="doser-shell-"+SCOPE.pathname+"-";\nconst CACHE=PREFIX+${JSON.stringify(revision)};\nconst FILES=["index.html","manifest.webmanifest","icons/icon-512.png","icons/apple-touch-icon.png"];\nconst urls=FILES.map(p=>new URL(p,SCOPE).href);\nself.addEventListener("install",event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);try{for(const url of urls){const response=await fetch(new Request(url,{cache:"reload",credentials:"omit"}));if(!response.ok||response.redirected)throw Error("Offline preparation failed");await cache.put(url,response);}}catch(error){await caches.delete(CACHE);throw error;}})()));\nself.addEventListener("message",event=>{if(event.data?.type==="ACTIVATE")self.skipWaiting();});\nself.addEventListener("activate",event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));\nself.addEventListener("fetch",event=>{const request=event.request,url=new URL(request.url);if(request.method!=="GET"||url.origin!==SCOPE.origin)return;const home=request.mode==="navigate"&&(url.pathname===SCOPE.pathname||url.pathname===new URL("index.html",SCOPE).pathname);if(home)event.respondWith((async()=>await (await caches.open(CACHE)).match(urls[0])||fetch(request))());else if(urls.includes(url.href))event.respondWith((async()=>await (await caches.open(CACHE)).match(request)||fetch(request))());});\n`;
await writeFile(root + "/sw.js", worker);
await writeFile(root + "/.nojekyll", "");
console.log(
  JSON.stringify({
    revision,
    htmlBytes: Buffer.byteLength(html),
    offlineFiles: 4,
    personalDataBundled: false,
  }),
);
