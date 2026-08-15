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
  });
});
