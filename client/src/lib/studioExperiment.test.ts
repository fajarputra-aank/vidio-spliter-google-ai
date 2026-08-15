import { describe, expect, it } from "vitest";
import { selectAlternativeRecipe } from "./studioExperiment";

describe("selectAlternativeRecipe", () => {
  it("prioritizes another AI recommendation instead of reusing the completed recipe", () => {
    expect(selectAlternativeRecipe("product", ["product", "light", "detail"], ["product", "light", "detail", "social"])).toBe("light");
  });

  it("uses the catalog only when no different recommendation exists", () => {
    expect(selectAlternativeRecipe("product", ["product"], ["product", "social"])).toBe("social");
    expect(selectAlternativeRecipe("product", ["product"], ["product"])).toBeNull();
  });
});
