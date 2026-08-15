import { describe, expect, it } from "vitest";
import { parsePhotoRecommendation } from "./photoRecommendations";

describe("photo recipe recommendation parser", () => {
  it("accepts only recipes from the server-owned allowlist", () => {
    expect(parsePhotoRecommendation('{"recipe":"product","confidence":"high","reason":"Produk dominan di tengah frame."}')).toEqual({ recipe: "product", confidence: "high", reason: "Produk dominan di tengah frame." });
    expect(parsePhotoRecommendation('{"recipe":"unknown","confidence":"high","reason":"x"}')).toMatchObject({ recipe: "social", confidence: "low" });
  });

  it("falls back safely when vision output is malformed or incomplete", () => {
    expect(parsePhotoRecommendation("not-json")).toMatchObject({ recipe: "social", confidence: "low" });
    expect(parsePhotoRecommendation('{"recipe":"headshot"}')).toEqual({ recipe: "headshot", confidence: "low", reason: "Foto siap dipoles sebagai konten visual serbaguna." });
  });
});
