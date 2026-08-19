export type SharePlatform = "whatsapp" | "instagram" | "facebook" | "tiktok" | "other";

export const sharePlatforms: { id: SharePlatform; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "other", label: "Lainnya" },
];

export function buildShareCaption(platform: SharePlatform, title: string, recipe: string, style: string) {
  const context = `${title} · ${recipe} · gaya ${style}`;
  if (platform === "instagram") return `${context}\n\nVisual baru dari Lensa Saku. #LensaSaku #KontenVisual #FotoProduk`;
  if (platform === "tiktok") return `${context}\nVisual baru siap tampil. #LensaSaku #KontenKreator`;
  if (platform === "facebook") return `${context}\n\nHasil visual baru dari Lensa Saku.`;
  if (platform === "whatsapp") return `${context}\n\nDibuat dengan Lensa Saku.`;
  return `${context}\n\nDibuat dengan Lensa Saku.`;
}
