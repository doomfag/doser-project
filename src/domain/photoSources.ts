/** Fixed public image origins. This is not an arbitrary URL downloader. */
export function retailerImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash)
      return false;
    return (
      (u.hostname === "product-data.raiadrogasil.io" &&
        !u.search &&
        /^\/images\/\d+\.(?:webp|jpg|jpeg|png)$/.test(u.pathname)) ||
      (u.hostname === "img.drogasil.com.br" &&
        !u.search &&
        /^\/media\/catalog\/product\/[a-zA-Z0-9/_%.()-]+\.(?:webp|jpg|jpeg|png)$/.test(
          u.pathname,
        )) ||
      (u.hostname === "paguemenos.vteximg.com.br" &&
        /^\/arquivos\/ids\/\d+(?:-\d+-\d+)?\/[a-zA-Z0-9/_%.()+-]+\.(?:webp|jpg|jpeg|png)$/i.test(
          u.pathname,
        ) &&
        (!u.search || /^\?v=\d{8,30}$/.test(u.search)))
    );
  } catch {
    return false;
  }
}
export function retailerPageMatches(
  src: string,
  page: string,
  label: string,
): boolean {
  if (!retailerImageUrl(src)) return false;
  try {
    const image = new URL(src),
      p = new URL(page);
    if (p.username || p.password || p.search || p.hash || p.port) return false;
    return image.hostname === "paguemenos.vteximg.com.br"
      ? label === "Pague Menos" &&
          p.origin === "https://www.paguemenos.com.br" &&
          /^\/[a-z0-9-]+\/p$/.test(p.pathname)
      : label === "Drogasil" &&
          p.origin === "https://www.drogasil.com.br" &&
          /^\/[a-z0-9-]+\.html$/.test(p.pathname);
  } catch {
    return false;
  }
}
