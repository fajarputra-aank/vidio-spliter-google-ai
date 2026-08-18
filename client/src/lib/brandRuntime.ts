export type ActiveBrand = { logoUrl: string; iconUrl: string; updatedAt: Date | string | null };

export function applyBrandIdentity(brand: ActiveBrand, documentRef: Pick<Document, "documentElement" | "querySelector">) {
  documentRef.documentElement.style.setProperty("--app-logo", `url("${brand.iconUrl}")`);
  const favicon = documentRef.querySelector<HTMLLinkElement>('link[rel="icon"]');
  favicon?.setAttribute("href", brand.iconUrl);
}
