// Stable clinical text from the documented, anonymous Plone REST representation.
// UI, navigation and image metadata are deliberately outside this version hash.
export function officialText(input: unknown): string {
  const d = input as {
    title?: unknown;
    description?: unknown;
    effective?: unknown;
    blocks?: Record<string, { plaintext?: unknown }>;
    blocks_layout?: { items?: unknown };
  };
  if (
    !d ||
    typeof d.title !== "string" ||
    !d.blocks ||
    !Array.isArray(d.blocks_layout?.items) ||
    d.blocks_layout.items.length > 500
  )
    throw Error("Documento oficial sem texto estruturado.");
  const blocks = d.blocks_layout.items
    .map((id: unknown) =>
      typeof id === "string" ? d.blocks![id]?.plaintext : undefined,
    )
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/\s+/g, " ").trim());
  if (!blocks.length) throw Error("Documento oficial vazio.");
  return JSON.stringify({
    title: d.title,
    effective: d.effective,
    description: d.description,
    blocks,
  });
}
