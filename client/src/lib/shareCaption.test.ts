import { describe, expect, it } from "vitest";
import { buildShareCaption } from "./shareCaption";

describe("buildShareCaption", () => {
  it("membuat copy yang disesuaikan untuk Instagram tanpa mengubah detail hasil", () => {
    const caption = buildShareCaption("instagram", "Produk katalog", "Katalog produk", "editorial");
    expect(caption).toContain("Produk katalog");
    expect(caption).toContain("#LensaSaku");
  });
});
