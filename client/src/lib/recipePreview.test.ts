import { describe, expect, it } from "vitest";
import { recipePreviewAlt, recipePreviewDisclaimer, recipePreviewMeta } from "./recipePreview";

describe("recipe preview metadata", () => {
  const recipe = {
    name: "Produk katalog",
    category: "Produk",
    label: "Untuk jualan",
    description: "Rapi dan terang.",
    prompt: "latar katalog hangat",
  };

  it("creates descriptive accessible alt text", () => {
    expect(recipePreviewAlt(recipe)).toBe("Contoh hasil Produk katalog");
  });

  it("keeps category and recipe label together", () => {
    expect(recipePreviewMeta(recipe)).toBe("Produk · Untuk jualan");
  });

  it("sets an honest expectation about the example image", () => {
    expect(recipePreviewDisclaimer()).toContain("contoh arah visual");
    expect(recipePreviewDisclaimer()).toContain("foto sumber");
  });
});
