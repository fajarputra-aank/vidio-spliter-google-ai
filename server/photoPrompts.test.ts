import { describe, expect, it } from "vitest";
import { buildTransformPrompt, photoRecipes, recipeIds } from "./photoPrompts";

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
});
