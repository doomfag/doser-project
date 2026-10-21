import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { openDB, type DBSchema } from "idb";
import {
  isManufacturerPhoto,
  verifiedManufacturerImage,
  type ManufacturerPhoto,
} from "../domain/manufacturerPhotos";

interface ManufacturerImageDB extends DBSchema {
  images: {
    key: string;
    value: { key: string; data: string; savedAt: number };
  };
}
const database = () =>
  openDB<ManufacturerImageDB>("doser.manufacturer-images", 1, {
    upgrade(db) {
      db.createObjectStore("images", { keyPath: "key" });
    },
  });

export async function manufacturerImageSource(
  p: ManufacturerPhoto,
): Promise<string> {
  if (!isManufacturerPhoto(p)) throw Error("Fonte da imagem não permitida.");
  // Web/Electron display the original image directly; there is no CORS proxy.
  if (!Capacitor.isNativePlatform()) return p.src;
  const key = p.id + ":" + p.sha256;
  let db;
  try {
    db = await database();
    const cached = await db.get("images", key);
    if (cached) {
      try {
        return await verifiedManufacturerImage(cached.data, p);
      } catch {
        await db.delete("images", key);
      }
    }
  } catch {
    /* a valid image can still be displayed without persistent storage */
  } finally {
    db?.close();
  }
  const response = await CapacitorHttp.get({
    url: p.src,
    responseType: "arraybuffer",
    disableRedirects: true,
    connectTimeout: 12000,
    readTimeout: 15000,
    headers: { Accept: "image/webp" },
  });
  if (response.status !== 200 || response.url !== p.src)
    throw Error("A imagem não está disponível na fonte conferida.");
  const image = await verifiedManufacturerImage(response.data, p);
  try {
    db = await database();
    const tx = db.transaction("images", "readwrite");
    try {
      await tx.store.put({
        key,
        data: response.data as string,
        savedAt: Date.now(),
      });
      const entries = await tx.store.getAll();
      for (const old of entries.sort((a, b) => b.savedAt - a.savedAt).slice(64))
        await tx.store.delete(old.key);
      await tx.done;
    } catch {
      try {
        tx.abort();
      } catch {
        /* already finished */
      }
      await tx.done.catch(() => {});
    }
  } catch {
    /* do not hide a verified download if storage is full */
  } finally {
    db?.close();
  }
  return image;
}
