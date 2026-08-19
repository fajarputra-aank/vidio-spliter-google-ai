export type ShareOutcome = "native" | "native_image" | "copied";

type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

type ImageFetcher = (url: string) => Promise<{ ok: boolean; blob: () => Promise<Blob> }>;
type ImageFileFactory = (blob: Blob, name: string) => File;
export type ShareWatermarkPosition = "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right";
export type ShareWatermarkFont = "sans" | "serif" | "mono";
export type ShareImageOptions = { watermarkText?: string; watermarkPosition?: ShareWatermarkPosition; watermarkSize?: number; watermarkFont?: ShareWatermarkFont; caption?: string };

async function watermarkFile(blob: Blob, text: string, name: string, options: ShareImageOptions, makeFile: ImageFileFactory) {
  if (!text.trim()) return makeFile(blob, name);
  const source = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const value = new Image(); value.onload = () => resolve(value); value.onerror = reject; value.src = source; });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return makeFile(blob, name);
    const position = options.watermarkPosition ?? "bottom-right"; const font = options.watermarkFont === "serif" ? "Georgia, serif" : options.watermarkFont === "mono" ? "monospace" : "Arial, sans-serif"; const size = Math.max(2, Math.min(10, options.watermarkSize ?? 4)); const margin = .06; const x = position.endsWith("left") ? canvas.width * margin : position.endsWith("right") ? canvas.width * (1 - margin) : canvas.width / 2; const y = position.startsWith("top") ? canvas.height * margin : position === "center" ? canvas.height / 2 : canvas.height * (1 - margin); context.drawImage(image, 0, 0); context.globalAlpha = .72; context.fillStyle = "#fffdf8"; context.strokeStyle = "rgba(27,27,24,.72)"; context.lineWidth = Math.max(2, Math.round(canvas.width / 430)); context.textAlign = position.endsWith("left") ? "left" : position.endsWith("right") ? "right" : "center"; context.textBaseline = position.startsWith("top") ? "top" : position === "center" ? "middle" : "bottom"; context.font = `700 ${Math.max(18, Math.round(canvas.width * (size / 100)))}px ${font}`; context.strokeText(text.trim(), x, y); context.fillText(text.trim(), x, y);
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
  options: ShareImageOptions = {},
  fetchImage: ImageFetcher = (value) => fetch(value),
  makeFile: ImageFileFactory = (blob, name) => new File([blob], name, { type: blob.type || "image/png" })
): Promise<ShareOutcome> {
  const shareUrl = new URL(url, origin).toString();
  if (typeof target.share === "function") {
    try {
      const response = await fetchImage(shareUrl);
      if (response.ok) {
        const name = `lensa-saku-${title.toLocaleLowerCase("id-ID").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "hasil"}.png`;
        const file = await watermarkFile(await response.blob(), options.watermarkText ?? "", name, options, makeFile);
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
