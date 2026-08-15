import { describe, expect, it } from "vitest";
import { parsePhotoRecommendations } from "./photoRecommendations";

describe("photo recipe recommendation parser", () => {
  it("accepts only distinct recipes from the server-owned allowlist", () => {
    expect(parsePhotoRecommendations('{"recommendations":[{"recipe":"product","confidence":"high","reason":"Produk dominan di tengah frame."},{"recipe":"light","confidence":"medium","reason":"Cahaya dapat diseimbangkan."},{"recipe":"detail","confidence":"low","reason":"Detail layak dijernihkan."}]}')).toEqual([
      { recipe: "product", confidence: "high", reason: "Produk dominan di tengah frame." },
      { recipe: "light", confidence: "medium", reason: "Cahaya dapat diseimbangkan." },
      { recipe: "detail", confidence: "low", reason: "Detail layak dijernihkan." },
    ]);
    expect(parsePhotoRecommendations('{"recommendations":[{"recipe":"product","confidence":"high","reason":"x"},{"recipe":"product","confidence":"medium","reason":"duplikat"},{"recipe":"unknown","confidence":"high","reason":"x"}]}')).toEqual(expect.arrayContaining([{ recipe: "product", confidence: "high", reason: "x" }, { recipe: "social", confidence: "low", reason: "Foto siap dipoles sebagai konten visual serbaguna." }]));
  });

  it("falls back safely when vision output is malformed or incomplete", () => {
    expect(parsePhotoRecommendations("not-json")).toHaveLength(3);
    expect(parsePhotoRecommendations('{"recommendations":[{"recipe":"headshot"}]}')).toEqual(expect.arrayContaining([{ recipe: "headshot", confidence: "low", reason: "Arah visual yang sesuai untuk foto ini." }]));
  });
});
