import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getBrandSettings: vi.fn(), updateBrandSettings: vi.fn(), storagePut: vi.fn() }));
vi.mock("./db", () => ({ getBrandSettings: mocks.getBrandSettings, updateBrandSettings: mocks.updateBrandSettings }));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));
import { appRouter } from "./routers";

function context(role: "admin" | "user"): TrpcContext {
  return { user: { id: 73, openId: "brand-manager", name: "Brand Manager", email: "brand@example.test", loginMethod: "manus", role, unlimitedTransforms: role === "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("brand settings contract", () => {
  it("exposes safe brand URLs publicly", async () => {
    mocks.getBrandSettings.mockResolvedValue({ logoUrl: "/manus-storage/logo.png", iconUrl: "/manus-storage/icon.png" });
    await expect(appRouter.createCaller(context("user")).brand.get()).resolves.toMatchObject({ iconUrl: "/manus-storage/icon.png" });
  });

  it("allows only administrators to upload and persist a new brand icon", async () => {
    mocks.storagePut.mockResolvedValue({ url: "/manus-storage/brand-icon.png" });
    mocks.updateBrandSettings.mockResolvedValue({ logoUrl: "/manus-storage/logo.png", iconUrl: "/manus-storage/brand-icon.png" });
    const payload = { mimeType: "image/png" as const, sourceData: "dGVzdC1icmFuZC1pbWFnZQ==" };
    await expect(appRouter.createCaller(context("user")).admin.updateBrand({ icon: payload })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(context("admin")).admin.updateBrand({ icon: payload })).resolves.toMatchObject({ iconUrl: "/manus-storage/brand-icon.png" });
    expect(mocks.updateBrandSettings).toHaveBeenCalledWith(73, { logoUrl: undefined, iconUrl: "/manus-storage/brand-icon.png" });
  });
});
