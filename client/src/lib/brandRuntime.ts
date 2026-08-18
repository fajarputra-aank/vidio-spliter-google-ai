export type ActiveBrand = { logoUrl: string; iconUrl: string; updatedAt: Date | string | null };

import { publicMediaUrl } from "./mediaUrl";

export function applyBrandIdentity(brand: ActiveBrand, documentRef: Pick<Document, "documentElement" | "querySelector">) {
  const iconUrl = publicMediaUrl(brand.iconUrl);
  documentRef.documentElement.style.setProperty("--app-logo", `url("${iconUrl}")`);
  const favicon = documentRef.querySelector<HTMLLinkElement>('link[rel="icon"]');
  favicon?.setAttribute("href", iconUrl);
}
