import { describe, expect, it } from "vitest";
import { buildTransformPrompt, photoRecipes, recipeIds, styleIds } from "./photoPrompts";

describe("photo transform prompts", () => {
  it("defines a usable visual direction for each recipe", () => {
    recipeIds.forEach((recipeId) => {
      expect(photoRecipes[recipeId].title).toBeTruthy();
      expect(buildTransformPrompt(recipeId)).toContain("Preserve");
      expect(buildTransformPrompt(recipeId)).toContain("Do not add text");
    });
  });

  it("keeps the commercial recipe directions distinct", () => {
    expect(buildTransformPrompt("headshot")).toContain("headshot");
    expect(buildTransformPrompt("product")).toContain("product catalog");
    expect(buildTransformPrompt("food")).toContain("restaurant");
    expect(buildTransformPrompt("social")).toContain("social media");
    expect(buildTransformPrompt("beauty")).toContain("natural editorial retouch");
    expect(buildTransformPrompt("background")).toContain("studio-background");
    expect(buildTransformPrompt("detail")).toContain("improved clarity");
    expect(buildTransformPrompt("travel")).toContain("destination editorial");
  });

  it("covers the expanded 64-recipe catalog with specialized and safe directions", () => {
    expect(recipeIds).toHaveLength(63);
    expect(buildTransformPrompt("portrait_window")).toContain("window-light editorial");
    expect(buildTransformPrompt("marketplace")).toContain("marketplace-ready");
    expect(buildTransformPrompt("beverage")).toContain("drinks campaign");
    expect(buildTransformPrompt("listing")).toContain("real-estate listing");
    expect(buildTransformPrompt("document")).toContain("exactly as captured");
    expect(buildTransformPrompt("document")).toContain("Do not add text, remove text, change text");
    expect(buildTransformPrompt("duotone")).toContain("two-tone graphic");
    expect(buildTransformPrompt("personal_brand")).toContain("personal-brand editorial");
    expect(buildTransformPrompt("product_white")).toContain("clean-background commerce");
    expect(buildTransformPrompt("coffee")).toContain("cafe editorial");
    expect(buildTransformPrompt("hotel_room")).toContain("hospitality editorial");
    expect(buildTransformPrompt("receipt_clean")).toContain("currency symbol");
    expect(buildTransformPrompt("comic_ink")).toContain("ink-and-color illustration");
  });

  it("membatasi arah Ramadan dan Lebaran pada perayaan yang setia pada sumber", () => {
    expect(buildTransformPrompt("ramadan_iftar")).toContain("Ramadan food");
    expect(buildTransformPrompt("ramadan_hampers")).toContain("exact boxes, packaging, products, labels");
    expect(buildTransformPrompt("lebaran_family")).toContain("every person's exact identity");
    expect(buildTransformPrompt("lebaran_promo")).toContain("Do not add text, prices, discount claims");
    expect(buildTransformPrompt("lebaran_product")).toContain("gift product photograph");
  });

  it("adds a clear compositional direction for every supported output ratio", () => {
    expect(buildTransformPrompt("product", "1:1")).toContain("1:1 square");
    expect(buildTransformPrompt("product", "16:9")).toContain("16:9 horizontal");
    expect(buildTransformPrompt("product", "9:16")).toContain("9:16 format");
  });

  it("adds a distinct direction for every supported AI style", () => {
    styleIds.forEach((style) => expect(buildTransformPrompt("headshot", "1:1", style)).toContain("Use"));
    expect(buildTransformPrompt("headshot", "1:1", "realistic")).toContain("faithful photorealism");
    expect(buildTransformPrompt("headshot", "1:1", "anime")).toContain("original polished anime illustration");
    expect(buildTransformPrompt("headshot", "1:1", "monochrome")).toContain("black-and-white editorial");
    expect(buildTransformPrompt("headshot", "1:1", "watercolor")).toContain("original contemporary watercolor");
  });

  it("keeps a user direction subordinate to the final preservation guard", () => {
    const prompt = buildTransformPrompt("product", "1:1", "editorial", "buat terasa lebih hangat");
    expect(prompt).toContain("Optional user direction, apply only when compatible");
    expect(prompt.indexOf("buat terasa lebih hangat")).toBeLessThan(prompt.indexOf("Non-negotiable:"));
    expect(prompt).toContain("Do not add text, logos");
  });
});
