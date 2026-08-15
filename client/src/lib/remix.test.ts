import { describe, expect, it } from "vitest";
import { readRemixPreset } from "./remix";

describe("readRemixPreset", () => {
  it("copies only valid recipe, style, and aspect metadata", () => {
    expect(readRemixPreset("?remixRecipe=fashion&remixStyle=cinematic&remixAspect=9%3A16")).toEqual({ recipe: "fashion", style: "cinematic", aspect: "9:16" });
  });

  it("rejects incomplete or unknown metadata, including any source-image field", () => {
    expect(readRemixPreset("?remixRecipe=fashion&remixStyle=cinematic&sourceUrl=https%3A%2F%2Fprivate.example%2Fsource.jpg")).toBeNull();
    expect(readRemixPreset("?remixRecipe=unknown&remixStyle=cinematic&remixAspect=1%3A1")).toBeNull();
  });
});
