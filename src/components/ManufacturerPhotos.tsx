import { useEffect, useState } from "react";
import { manufacturerImageSource } from "../data/manufacturerPhotoCache";
import {
  manufacturerCopyright,
  type ManufacturerPhoto,
} from "../domain/manufacturerPhotos";
import { External } from "./ui";

function ManufacturerImage({ photo }: { photo: ManufacturerPhoto }) {
  const [source, setSource] = useState("");
  const [state, setState] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState("loading");
    setSource("");
    manufacturerImageSource(photo)
      .then((src) => {
        if (alive) setSource(src);
      })
      .catch(() => {
        if (alive) setState("error");
      });
    return () => {
      alive = false;
    };
  }, [photo, attempt]);
  return (
    <div className="manufacturer-image" aria-busy={state === "loading"}>
      {source && state !== "error" && (
        <img
          key={photo.id + attempt}
          src={source}
          alt={photo.label}
          referrerPolicy="no-referrer"
          decoding="async"
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
        />
      )}
      {state === "loading" && (
        <p className="small-note" role="status">
          Carregando imagem do fabricante…
        </p>
      )}
      {state === "error" && (
        <div className="manufacturer-image-error" role="status">
          <p>
            Não foi possível carregar esta imagem. Confira sua conexão ou
            consulte a fonte.
          </p>
          <button
            className="secondary-button"
            onClick={() => setAttempt((a) => a + 1)}
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}

export default function ManufacturerPhotos({
  photos,
}: {
  photos: ManufacturerPhoto[];
}) {
  const [selected, setSelected] = useState(photos[0]?.id);
  if (!photos.length) return null;
  const photo = photos.find((p) => p.id === selected) ?? photos[0];
  return (
    <section className="manufacturer-photos" aria-label="Imagens do fabricante">
      <div className="section-heading">
        <h2>Embalagens</h2>
        <span className="small-note">{photos.length} imagens</span>
      </div>
      {photos.length > 1 && (
        <label className="field">
          Ver outra embalagem
          <select
            value={photo.id}
            onChange={(e) => setSelected(e.target.value)}
          >
            {photos.map((p) => (
              <option value={p.id} key={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <figure>
        <ManufacturerImage key={photo.id} photo={photo} />
        <figcaption>
          <strong>{photo.label}</strong>
          <External href={photo.sourcePage}>Ver no site do fabricante</External>
          <small className="manufacturer-copyright">
            {manufacturerCopyright}
          </small>
        </figcaption>
      </figure>
      <p className="small-note">
        A aparência da embalagem pode mudar. Confira o nome, a concentração e a
        forma. Uma imagem não identifica comprimidos soltos.
      </p>
      <details className="manufacturer-credits">
        <summary>Origem e créditos</summary>
        <p className="small-note">
          Imagem publicada pelo fabricante, conferida em{" "}
          {photo.checkedAt.split("-").reverse().join("/")}. Consulta para uso
          pessoal e não comercial. No celular, o primeiro carregamento precisa
          de internet; imagens conferidas podem ser guardadas no próprio
          aparelho.
        </p>
        <External href={new URL("/termos-e-condicoes", photo.sourcePage).href}>
          Termos da fonte
        </External>
      </details>
    </section>
  );
}
