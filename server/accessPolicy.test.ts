import { describe, expect, it } from "vitest";
import { hasUnlimitedHdExports, hasUnlimitedTransforms } from "./accessPolicy";

describe("unlimited transform access", () => {
  it("grants unlimited transformations to admins or an explicit special-access flag", () => {
    expect(hasUnlimitedTransforms({ role: "admin", unlimitedTransforms: false })).toBe(true);
    expect(hasUnlimitedTransforms({ role: "user", unlimitedTransforms: true })).toBe(true);
    expect(hasUnlimitedTransforms({ role: "user", unlimitedTransforms: false })).toBe(false);
  });

  it("keeps free HD export exclusive to administrators", () => {
    expect(hasUnlimitedHdExports("admin")).toBe(true);
    expect(hasUnlimitedHdExports("user")).toBe(false);
  });

});
