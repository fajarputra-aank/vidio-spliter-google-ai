import { describe, expect, it } from "vitest";
import { hasUnlimitedTransforms } from "./accessPolicy";

describe("administrator transform access", () => {
  it("grants unlimited transforms only to the admin role", () => {
    expect(hasUnlimitedTransforms("admin")).toBe(true);
    expect(hasUnlimitedTransforms("user")).toBe(false);
    expect(hasUnlimitedTransforms(null)).toBe(false);
  });
});
