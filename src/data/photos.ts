import { openDB, type DBSchema } from "idb";
export interface ProductPhoto {
  id: string;
  medicineId: string;
  presentation: string;
  origin: string;
  image: string;
  addedAt: string;
}
interface PhotoDB extends DBSchema {
  photos: { key: string; value: ProductPhoto; indexes: { medicineId: string } };
}
const database = () =>
  openDB<PhotoDB>("doser.photos", 1, {
    upgrade(db) {
      db.createObjectStore("photos", { keyPath: "id" }).createIndex(
        "medicineId",
        "medicineId",
      );
    },
  });
export async function productPhotos(id: string) {
  const db = await database();
  try {
    return await db.getAllFromIndex("photos", "medicineId", id);
  } finally {
    db.close();
  }
}
export async function storePhoto(photo: ProductPhoto) {
  const db = await database();
  const tx = db.transaction("photos", "readwrite");
  try {
    const count = await tx.store.index("medicineId").count(photo.medicineId);
    if (count >= 6) throw Error("Limite de seis fotos por medicamento.");
    await tx.store.put(photo);
    await tx.done;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* transaction may already be finished */
    }
    await tx.done.catch(() => {});
    throw error;
  } finally {
    db.close();
  }
}
export async function removePhoto(id: string) {
  const db = await database();
  try {
    await db.delete("photos", id);
  } finally {
    db.close();
  }
}
export async function preparePhoto(file: File): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw Error("Use uma foto JPG, PNG ou WebP de até 8 MB.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const signature =
    file.type === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216
      : file.type === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
        : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
          new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!signature)
    throw Error("O conteúdo do arquivo não corresponde ao formato da foto.");
  const url = await new Promise<string>((ok, fail) => {
    const reader = new FileReader();
    reader.onload = () => ok(String(reader.result));
    reader.onerror = () => fail(Error("Falha ao ler a foto."));
    reader.readAsDataURL(file);
  });
  {
    const img = new Image();
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok();
      img.onerror = () => fail(Error("Não foi possível abrir a imagem."));
      img.src = url;
    });
    if (img.width * img.height > 24_000_000)
      throw Error(
        "A imagem é muito grande. Reduza a resolução antes de adicionar.",
      );
    const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Imagens indisponíveis neste dispositivo.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }
}
