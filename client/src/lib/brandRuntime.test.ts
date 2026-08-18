import { describe, expect, it, vi } from "vitest";
import { applyBrandIdentity } from "./brandRuntime";

describe("applyBrandIdentity", () => {
  it("updates the compact icon CSS variable and favicon from the active admin brand", () => {
    const setProperty = vi.fn();
    const setAttribute = vi.fn();
    const documentRef = {
      documentElement: { style: { setProperty } },
      querySelector: vi.fn().mockReturnValue({ setAttribute }),
    } as unknown as Pick<Document, "documentElement" | "querySelector">;
    applyBrandIdentity({ logoUrl: "/manus-storage/logo-next.png", iconUrl: "/manus-storage/icon-next.png", updatedAt: null }, documentRef);
    expect(setProperty).toHaveBeenCalledWith("--app-logo", 'url("/manus-storage/icon-next.png")');
    expect(setAttribute).toHaveBeenCalledWith("href", "/manus-storage/icon-next.png");
  });
});
