import { useEffect, useState } from "react";
import { Download, Share, RefreshCw } from "lucide-react";
export default function PwaInstall() {
  return document.documentElement.dataset.doserPwa === "true" ? (
    <InstallControls />
  ) : null;
}
function InstallControls() {
  const installed =
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const [instructions, setInstructions] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setError(true);
      return;
    }
    let alive = true,
      asked = false;
    const changed = () => {
      if (asked) location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    void navigator.serviceWorker
      .register(new URL("sw.js", document.baseURI), {
        scope: new URL("./", document.baseURI).pathname,
        updateViaCache: "none",
      })
      .then(async (registration) => {
        const inspect = () => {
          if (
            alive &&
            registration.waiting &&
            navigator.serviceWorker.controller
          )
            setWaiting(registration.waiting);
        };
        inspect();
        registration.addEventListener("updatefound", () =>
          registration.installing?.addEventListener("statechange", inspect),
        );
        await navigator.serviceWorker.ready;
        if (alive) setReady(true);
        void registration.update().catch(() => {});
      })
      .catch(() => {
        if (alive) setError(true);
      });
    const activate = () => {
      asked = true;
    };
    window.addEventListener("doser-activate-update", activate);
    return () => {
      alive = false;
      window.removeEventListener("doser-activate-update", activate);
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
    };
  }, []);
  return (
    <section className="pwa-install" aria-label="Instalação do Doser">
      {!installed && (
        <>
          <div className="pwa-install-heading">
            <div>
              <strong>Doser no seu iPhone</strong>
              <p>Sem computador, conta ou renovação semanal.</p>
            </div>
            <button
              className="secondary-button"
              onClick={() => setInstructions((v) => !v)}
              aria-expanded={instructions}
            >
              <Download size={17} />
              Como instalar
            </button>
          </div>
          {instructions && (
            <div className="pwa-instructions">
              <ol>
                <li>
                  Abra este link no <strong>Safari</strong>.
                </li>
                <li>
                  Toque em <strong>Compartilhar</strong>{" "}
                  <Share size={15} aria-label="ícone de compartilhar" />.
                </li>
                <li>
                  Escolha <strong>Adicionar à Tela de Início</strong> e toque em{" "}
                  <strong>Adicionar</strong>. Se aparecer “Abrir como App”,
                  mantenha ativado.
                </li>
              </ol>
              <p>
                Depois, abra pelo ícone Doser. É a versão web instalável, com
                seus dados neste aparelho; ela não transfere os dados do APK.
              </p>
            </div>
          )}
        </>
      )}
      <p className="small-note" role="status">
        {error
          ? "Não foi possível preparar o modo offline. Confira a conexão e reabra o Doser."
          : ready
            ? "Consulta preparada para abrir sem internet. Fotos e links externos precisam de conexão."
            : "Preparando a consulta sem internet…"}
      </p>
      {waiting && (
        <div className="pwa-update">
          <p>
            Há uma atualização pronta. Salve suas anotações abertas antes de
            continuar.
          </p>
          <button
            className="secondary-button"
            onClick={() => {
              window.dispatchEvent(new Event("doser-activate-update"));
              waiting.postMessage({ type: "ACTIVATE" });
            }}
          >
            <RefreshCw size={16} />
            Atualizar Doser
          </button>
        </div>
      )}
    </section>
  );
}
