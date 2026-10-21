import { useEffect, useMemo, useState } from "react";
import { manufacturerImageSource } from "../data/manufacturerPhotoCache";
import {
  manufacturerCopyright,
  photoPresentationGroups,
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
          Carregando imagem…
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

function Thumbnail({
  photo,
  index,
  selected,
  onSelect,
}: {
  photo: ManufacturerPhoto;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    manufacturerImageSource(photo)
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [photo]);
  return (
    <button
      className={"photo-thumbnail" + (selected ? " selected" : "")}
      type="button"
      aria-label={`Ver imagem ${index + 1} de ${photo.productTitle ?? photo.label}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {src && (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setSrc("")}
        />
      )}
      <span>{index + 1}</span>
    </button>
  );
}
export default function ManufacturerPhotos({
  photos,
}: {
  photos: ManufacturerPhoto[];
}) {
  const groups = useMemo(() => photoPresentationGroups(photos), [photos]);
  const [selected, setSelected] = useState(groups[0]?.id);
  const [imageIndex, setImageIndex] = useState(0);
  if (!groups.length) return null;
  const group = groups.find((g) => g.id === selected) ?? groups[0];
  const photo = group.photos[Math.min(imageIndex, group.photos.length - 1)];
  const retailer = photo.sourceKind === "retailer";
  return (
    <section className="manufacturer-photos" aria-label="Fotos do medicamento">
      <div className="section-heading">
        <h2>Fotos e embalagens</h2>
        <span className="small-note">{photos.length} imagens</span>
      </div>
      {groups.length > 1 && (
        <label className="field">
          Ver outra embalagem
          <select
            value={group.id}
            onChange={(e) => {
              setSelected(e.target.value);
              setImageIndex(0);
            }}
          >
            {groups.map((g) => (
              <option value={g.id} key={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <figure>
        <ManufacturerImage key={photo.id} photo={photo} />
        {group.photos.length > 1 && (
          <>
            <div
              className="photo-thumbnails"
              role="group"
              aria-label="Imagens desta apresentação"
            >
              {group.photos.map((p, i) => (
                <Thumbnail
                  key={p.id}
                  photo={p}
                  index={i}
                  selected={i === imageIndex}
                  onSelect={() => setImageIndex(i)}
                />
              ))}
            </div>
            <p className="photo-position" aria-live="polite">
              Imagem {imageIndex + 1} de {group.photos.length} desta
              apresentação
            </p>
          </>
        )}
        <figcaption>
          <strong>{group.label}</strong>
          <External href={photo.sourcePage}>
            {retailer
              ? `Ver na ${photo.sourceLabel}`
              : "Ver no site do fabricante"}
          </External>
          <small className="manufacturer-copyright">
            {retailer
              ? `Imagens publicadas por ${photo.sourceLabel}. Direitos dos respectivos titulares.`
              : manufacturerCopyright}
          </small>
        </figcaption>
      </figure>
      <p className="small-note">
        A aparência da embalagem pode mudar. Confira o nome, a concentração e a
        forma. Uma imagem não identifica comprimidos soltos.
        {retailer &&
          " A galeria pode incluir publicidade da fonte. Textos nas imagens não são orientações de uso do Doser; consulte a bula."}
      </p>
      <details className="manufacturer-credits">
        <summary>Origem e créditos</summary>
        <p className="small-note">
          {retailer
            ? `Imagem publicada por ${photo.sourceLabel}`
            : "Imagem publicada pelo fabricante"}
          , conferida em {photo.checkedAt.split("-").reverse().join("/")}.
          Consulta pessoal e não comercial. No celular, o primeiro carregamento
          precisa de internet. Imagens recentes podem ficar guardadas no
          aparelho.
        </p>
        {photo.ean && (
          <p className="small-note">
            Código de barras: {photo.ean}. A apresentação foi relacionada à
            lista CMED pelo código de barras, registro e titular.
          </p>
        )}
        {photo.registrationConflict && (
          <p className="small-note">
            A fonte da imagem informa um registro diferente. O vínculo usa o
            código de barras da apresentação na CMED. Confira o rótulo; a foto
            pode mostrar uma embalagem anterior.
          </p>
        )}
        {!retailer && (
          <External
            href={new URL("/termos-e-condicoes", photo.sourcePage).href}
          >
            Termos da fonte
          </External>
        )}
      </details>
    </section>
  );
}
