/** Save the static application only: never serialize rendered notes, history or form values. */
export function savePortableApplication() {
  const app = document.getElementById("doser-app");
  const styles = document.getElementById("doser-styles");
  const catalog = document.getElementById("doser-catalog");
  if (
    !app ||
    !styles ||
    !catalog ||
    document.documentElement.dataset.doserStandalone !== "true"
  ) {
    throw new Error(
      "Esta versão não contém o arquivo portátil completo. Use a distribuição HTML.",
    );
  }
  const head = document.createElement("head");
  for (const element of document.head.querySelectorAll(
    'meta, title, link[rel="icon"]',
  ))
    head.append(element.cloneNode(true));
  head.append(
    styles.cloneNode(true),
    catalog.cloneNode(true),
    app.cloneNode(true),
  );
  const html =
    '<!doctype html>\n<html lang="pt-BR" data-doser-standalone="true">' +
    head.outerHTML +
    '<body><div id="root"></div></body></html>';
  const url = URL.createObjectURL(
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "Doser-offline.html";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
