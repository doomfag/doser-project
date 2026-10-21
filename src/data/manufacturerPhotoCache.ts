import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { openDB, type DBSchema } from "idb";
import {
  isManufacturerPhoto,
  verifiedManufacturerImage,
  type ManufacturerPhoto,
} from "../domain/manufacturerPhotos";
interface ImageInfo {
  key: string;
  storedBytes: number;
  lastUsedAt: number;
}
interface ManufacturerImageDB extends DBSchema {
  images: {
    key: string;
    value: { key: string; data: string; savedAt: number };
  };
  info: { key: string; value: ImageInfo };
}
export const PHOTO_CACHE_MAX_IMAGES = 600;
export const PHOTO_CACHE_MAX_BYTES = 128 * 1024 * 1024;
const database = () =>
  openDB<ManufacturerImageDB>("doser.manufacturer-images", 2, {
    upgrade(db, old, _next, tx) {
      if (!db.objectStoreNames.contains("images"))
        db.createObjectStore("images", { keyPath: "key" });
      if (!db.objectStoreNames.contains("info"))
        db.createObjectStore("info", { keyPath: "key" });
      if (old === 1) {
        // Only this official-image cache is migrated. Personal photos/library are separate.
        void (async () => {
          for (
            let cursor = await tx.objectStore("images").openCursor();
            cursor;
            cursor = await cursor.continue()
          ) {
            await tx.objectStore("info").put({
              key: cursor.value.key,
              storedBytes: cursor.value.data.length * 2,
              lastUsedAt: cursor.value.savedAt,
            });
          }
        })().catch(() => {
          try {
            tx.abort();
          } catch {
            /* upgrade already aborted */
          }
        });
      }
    },
  });
const inFlight = new Map<string, Promise<string>>();
let activeRequests = 0;
const waiting: (() => void)[] = [];
async function boundedNativeRequest(photo: ManufacturerPhoto) {
  if (activeRequests >= 3)
    await new Promise<void>((resolve) => waiting.push(resolve));
  else activeRequests++;
  try {
    return await CapacitorHttp.get({
      url: photo.src,
      responseType: "arraybuffer",
      disableRedirects: true,
      connectTimeout: 12000,
      readTimeout: 15000,
      headers: { Accept: "image/webp,image/jpeg,image/png" },
    });
  } finally {
    const next = waiting.shift();
    if (next) next();
    else activeRequests--;
  }
}
async function nativeSource(p: ManufacturerPhoto): Promise<string> {
  const key = p.id + ":" + p.sha256;
  let db;
  try {
    db = await database();
    const cached = await db.get("images", key);
    if (cached) {
      try {
        const image = await verifiedManufacturerImage(cached.data, p);
        try {
          await db.put("info", {
            key,
            storedBytes: cached.data.length * 2,
            lastUsedAt: Date.now(),
          });
        } catch {
          /* cache still readable */
        }
        return image;
      } catch {
        await db.delete("images", key);
        await db.delete("info", key);
      }
    }
  } catch {
    /* a valid download can be used without persistent storage */
  } finally {
    db?.close();
  }
  const response = await boundedNativeRequest(p);
  if (response.status !== 200 || response.url !== p.src)
    throw Error("A imagem não está disponível na fonte conferida.");
  const image = await verifiedManufacturerImage(response.data, p);
  try {
    db = await database();
    const tx = db.transaction(["images", "info"], "readwrite");
    try {
      const savedAt = Date.now();
      const data = response.data as string;
      await tx.objectStore("images").put({ key, data, savedAt });
      await tx
        .objectStore("info")
        .put({ key, storedBytes: data.length * 2, lastUsedAt: savedAt });
      // Only small metadata is read here, not hundreds of base64 image bodies.
      const entries = (await tx.objectStore("info").getAll()).sort(
        (a, b) => a.lastUsedAt - b.lastUsedAt,
      );
      let bytes = entries.reduce((n, e) => n + e.storedBytes, 0),
        count = entries.length;
      for (const old of entries) {
        if (count <= PHOTO_CACHE_MAX_IMAGES && bytes <= PHOTO_CACHE_MAX_BYTES)
          break;
        if (old.key === key) continue;
        await tx.objectStore("images").delete(old.key);
        await tx.objectStore("info").delete(old.key);
        bytes -= old.storedBytes;
        count--;
      }
      await tx.done;
    } catch {
      try {
        tx.abort();
      } catch {
        /* finished */
      }
      await tx.done.catch(() => {});
    }
  } catch {
    /* show the verified image even when storage is full */
  } finally {
    db?.close();
  }
  return image;
}
export async function manufacturerImageSource(
  p: ManufacturerPhoto,
): Promise<string> {
  if (!isManufacturerPhoto(p)) throw Error("Fonte da imagem não permitida.");
  if (!Capacitor.isNativePlatform()) return p.src;
  const key = p.id + ":" + p.sha256;
  let request = inFlight.get(key);
  if (!request) {
    request = nativeSource(p).finally(() => inFlight.delete(key));
    inFlight.set(key, request);
  }
  return request;
}
