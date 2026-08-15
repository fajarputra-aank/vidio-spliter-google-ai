export type ShareOutcome = "native" | "copied";

type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

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
