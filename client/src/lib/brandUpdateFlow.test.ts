import { describe, expect, it, vi } from "vitest";
import { applyBrandIdentity } from "./brandRuntime";
import { finalizeBrandSave } from "./brandUpdateFlow";

describe("admin brand save flow", () => {
  it("invalidates public brand data, clears drafts, then applies the new logo icon identity", async () => {
    const invalidateBrand = vi.fn().mockResolvedValue(undefined);
    const resetDrafts = vi.fn();
    const applyActiveBrand = vi.fn();
    const setProperty = vi.fn();
    const setAttribute = vi.fn();
    const documentRef = { documentElement: { style: { setProperty } }, querySelector: vi.fn().mockReturnValue({ setAttribute }) } as unknown as Pick<Document, "documentElement" | "querySelector">;
    const brand = { logoUrl: "/manus-storage/logo-saved.png", iconUrl: "/manus-storage/icon-saved.png", updatedAt: null };
    await finalizeBrandSave({ brand, applyActiveBrand, invalidateBrand, resetDrafts });
    applyBrandIdentity(brand, documentRef);
    expect(applyActiveBrand).toHaveBeenCalledWith(brand);
    expect(invalidateBrand).toHaveBeenCalledTimes(1);
    expect(resetDrafts).toHaveBeenCalledTimes(1);
    expect(setProperty).toHaveBeenCalledWith("--app-logo", 'url("/api/media/public/icon-saved.png")');
    expect(setAttribute).toHaveBeenCalledWith("href", "/api/media/public/icon-saved.png");
  });
});
