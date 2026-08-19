export type ShareOutcome = "native" | "native_image" | "copied";

type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

type ImageFetcher = (url: string) => Promise<{ ok: boolean; blob: () => Promise<Blob> }>;
type ImageFileFactory = (blob: Blob, name: string) => File;

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
  fetchImage: ImageFetcher = (value) => fetch(value),
  makeFile: ImageFileFactory = (blob, name) => new File([blob], name, { type: blob.type || "image/png" })
): Promise<ShareOutcome> {
  const shareUrl = new URL(url, origin).toString();
  if (typeof target.share === "function") {
    try {
      const response = await fetchImage(shareUrl);
      if (response.ok) {
        const file = makeFile(await response.blob(), `lensa-saku-${title.toLocaleLowerCase("id-ID").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "hasil"}.png`);
        const data: ShareData = { title: `Lensa Saku — ${title}`, text: "Hasil visual dari Lensa Saku", files: [file] };
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
