export type ShareOutcome = "native" | "native_image" | "copied";

type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

type ImageFetcher = (url: string) => Promise<{ ok: boolean; blob: () => Promise<Blob> }>;
type ImageFileFactory = (blob: Blob, name: string) => File;

async function watermarkFile(blob: Blob, text: string, name: string, makeFile: ImageFileFactory) {
  if (!text.trim()) return makeFile(blob, name);
  const source = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const value = new Image(); value.onload = () => resolve(value); value.onerror = reject; value.src = source; });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return makeFile(blob, name);
    context.drawImage(image, 0, 0); context.globalAlpha = .72; context.fillStyle = "#fffdf8"; context.strokeStyle = "rgba(27,27,24,.72)"; context.lineWidth = Math.max(2, Math.round(canvas.width / 430)); context.textAlign = "right"; context.textBaseline = "bottom"; context.font = `700 ${Math.max(18, Math.round(canvas.width / 28))}px Arial, sans-serif`; context.strokeText(text.trim(), canvas.width * .94, canvas.height * .94); context.fillText(text.trim(), canvas.width * .94, canvas.height * .94);
    const output = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return makeFile(output ?? blob, name);
  } finally { URL.revokeObjectURL(source); }
}

export async function shareImageUrl(
  url: string,
  title: string,
  origin: string,
  target: ShareNavigator
): Promise<ShareOutcome> {
  const shareUrl = new URL(url, origin).toString();
  const shareData: ShareData = {
    title: `Lensa Saku — ${title}`,
    text: "Hasil visual dari Lensa Saku",
    url: shareUrl,
  };

  if (typeof target.share === "function") {
    await target.share(shareData);
    return "native";
  }

  if (typeof target.clipboard?.writeText === "function") {
    await target.clipboard.writeText(shareUrl);
    return "copied";
  }

  throw new Error("Perangkat ini belum mendukung berbagi atau penyalinan tautan.");
}

/** Prefer sending the actual private result file to apps, then gracefully share its link if needed. */
export async function shareResultImage(
  url: string,
  title: string,
  origin: string,
  target: ShareNavigator,
  options: { watermarkText?: string; caption?: string } = {},
  fetchImage: ImageFetcher = (value) => fetch(value),
  makeFile: ImageFileFactory = (blob, name) => new File([blob], name, { type: blob.type || "image/png" })
): Promise<ShareOutcome> {
  const shareUrl = new URL(url, origin).toString();
  if (typeof target.share === "function") {
    try {
      const response = await fetchImage(shareUrl);
      if (response.ok) {
        const name = `lensa-saku-${title.toLocaleLowerCase("id-ID").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "hasil"}.png`;
        const file = await watermarkFile(await response.blob(), options.watermarkText ?? "", name, makeFile);
        const data: ShareData = { title: `Lensa Saku — ${title}`, text: options.caption ?? "Hasil visual dari Lensa Saku", files: [file] };
        if (typeof target.canShare !== "function" || target.canShare(data)) {
          await target.share(data);
          return "native_image";
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }
  return shareImageUrl(url, title, origin, target);
}
