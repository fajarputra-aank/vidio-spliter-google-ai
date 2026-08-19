import { describe, expect, it, vi } from "vitest";
import { shareImageUrl, shareResultImage } from "./share";

describe("shareImageUrl", () => {
  it("opens the native share path when the device supports it", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const result = await shareImageUrl("/manus-storage/result.png", "Headshot rapi", "https://studio.example", { share });

    expect(result).toBe("native");
    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      title: "Lensa Saku — Headshot rapi",
      url: "https://studio.example/manus-storage/result.png",
    }));
  });

  it("copies a full result URL when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await shareImageUrl("https://cdn.example/result.png", "Produk katalog", "https://studio.example", { clipboard: { writeText } });

    expect(result).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://cdn.example/result.png");
  });

  it("prioritizes the actual image file for apps in the device share sheet", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const blob = new Blob(["image"], { type: "image/png" });
    const file = { name: "lensa-saku-produk-katalog.png" } as File;
    const result = await shareResultImage("/api/media/private/result.png", "Produk katalog", "https://studio.example", { share, canShare: vi.fn().mockReturnValue(true) }, vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(blob) }), vi.fn().mockReturnValue(file));

    expect(result).toBe("native_image");
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [file] }));
  });
});
