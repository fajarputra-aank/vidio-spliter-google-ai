import { describe, expect, it } from "vitest";
import { privateMediaUrl, publicMediaUrl } from "./mediaUrl";

describe("media URL routing", () => {
  it("routes storage paths through the dedicated public and private endpoints", () => {
    expect(publicMediaUrl("/manus-storage/hero.jpg")).toBe("/api/media/public/hero.jpg");
    expect(privateMediaUrl("/manus-storage/results/foto hasil.jpg")).toBe("/api/media/private/results%2Ffoto%20hasil.jpg");
  });

  it("keeps data URLs and external URLs unchanged", () => {
    expect(privateMediaUrl("data:image/png;base64,abc")).toContain("data:image");
    expect(publicMediaUrl("https://example.com/image.jpg")).toBe("https://example.com/image.jpg");
  });
});
