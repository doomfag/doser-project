import { useEffect, useState } from "react";
import {
  productPhotos,
  preparePhoto,
  storePhoto,
  removePhoto,
  type ProductPhoto,
} from "../data/photos";
import { safeUrl } from "../domain/catalog";
import { localId } from "../data/localId";
import { External } from "./ui";
export default function ProductPhotos({
  medicineId,
  name,
}: {
  medicineId: string;
  name: string;
}) {
  const [photos, setPhotos] = useState<ProductPhoto[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setPhotos([]);
    productPhotos(medicineId)
      .then((p) => {
        if (alive) setPhotos(p);
      })
      .catch(() => {
        if (alive) setError("Não foi possível abrir as fotos locais.");
      });
    return () => {
      alive = false;
    };
  }, [medicineId]);
  return (
    <section className="product-photos">
      <details className="fact">
        <summary>
          Fotos da embalagem {photos.length ? `(${photos.length})` : ""}
        </summary>
        <p className="small-note">
          Não há acervo de fotos verificado conectado. Você pode guardar fotos
          da sua embalagem neste dispositivo. Uma foto não confirma
          autenticidade nem equivalência.
        </p>
        <div className="photo-grid">
          {photos.map((p) => (
            <figure key={p.id}>
              <img
                src={p.image}
                alt={`${name} — ${p.presentation}`}
                loading="lazy"
              />
              <figcaption>
                {p.presentation}
                {safeUrl(p.origin) ? (
                  <External href={p.origin}>Origem informada</External>
                ) : (
                  <small>{p.origin}</small>
                )}
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      await removePhoto(p.id);
                      setPhotos((x) => x.filter((v) => v.id !== p.id));
                    } catch {
                      setError("Não foi possível remover a foto.");
                    }
                  }}
                >
                  Remover foto
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
        <form
          className="photo-entry"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const form = e.currentTarget;
            const f = new FormData(form);
            const file = f.get("photo");
            const presentation = String(f.get("presentation")).trim();
            const origin = String(f.get("origin")).trim();
            if (
              !(file instanceof File) ||
              !file.size ||
              !presentation ||
              (origin && !safeUrl(origin))
            ) {
              setError(
                "Informe a embalagem, escolha uma foto e use HTTPS para a origem, se informada.",
              );
              return;
            }
            setBusy(true);
            try {
              const photo: ProductPhoto = {
                id: localId(),
                medicineId,
                presentation,
                origin: origin || "Foto pessoal adicionada por você",
                image: await preparePhoto(file),
                addedAt: new Date().toISOString(),
              };
              await storePhoto(photo);
              setPhotos((x) => [...x, photo]);
              form.reset();
            } catch (x) {
              setError(
                x instanceof Error
                  ? x.message
                  : "Não foi possível salvar a foto.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            Qual é a embalagem?
            <input
              name="presentation"
              required
              maxLength={300}
              placeholder="Ex.: 500 mg, caixa com 20 comprimidos"
            />
          </label>
          <label className="field">
            Foto
            <input
              name="photo"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
            />
          </label>
          <label className="field">
            Link de origem, se não for foto sua
            <input
              name="origin"
              type="url"
              maxLength={2048}
              placeholder="https://"
            />
          </label>
          <button
            className="secondary-button"
            disabled={busy || photos.length >= 6}
          >
            {busy ? "Salvando foto…" : "Adicionar foto"}
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
      </details>
    </section>
  );
}
