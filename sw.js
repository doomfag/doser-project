const SCOPE=new URL(self.registration.scope);
const PREFIX="doser-shell-"+SCOPE.pathname+"-";
const CACHE=PREFIX+"48b9c1ec3a052f64c54a";
const FILES=["index.html","manifest.webmanifest","icons/icon-512.png","icons/apple-touch-icon.png"];
const urls=FILES.map(p=>new URL(p,SCOPE).href);
self.addEventListener("install",event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);try{for(const url of urls){const response=await fetch(new Request(url,{cache:"reload",credentials:"omit"}));if(!response.ok||response.redirected)throw Error("Offline preparation failed");await cache.put(url,response);}}catch(error){await caches.delete(CACHE);throw error;}})()));
self.addEventListener("message",event=>{if(event.data?.type==="ACTIVATE")self.skipWaiting();});
self.addEventListener("activate",event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener("fetch",event=>{const request=event.request,url=new URL(request.url);if(request.method!=="GET"||url.origin!==SCOPE.origin)return;const home=request.mode==="navigate"&&(url.pathname===SCOPE.pathname||url.pathname===new URL("index.html",SCOPE).pathname);if(home)event.respondWith((async()=>await (await caches.open(CACHE)).match(urls[0])||fetch(request))());else if(urls.includes(url.href))event.respondWith((async()=>await (await caches.open(CACHE)).match(request)||fetch(request))());});
