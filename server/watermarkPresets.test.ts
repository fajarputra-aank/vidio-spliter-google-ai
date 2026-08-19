import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ listPhotoWatermarkPresets: vi.fn(), createPhotoWatermarkPreset: vi.fn(), deletePhotoWatermarkPreset: vi.fn() }));
vi.mock("./db", () => ({ listPhotoWatermarkPresets: mocks.listPhotoWatermarkPresets, createPhotoWatermarkPreset: mocks.createPhotoWatermarkPreset, deletePhotoWatermarkPreset: mocks.deletePhotoWatermarkPreset }));
import { appRouter } from "./routers";

function context(userId: number): TrpcContext { return { user: { id: userId, openId: `watermark-${userId}`, name: "Pemilik", email: `pemilik${userId}@example.test`, loginMethod: "local", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }

describe("preset watermark favorit", () => {
  it("menulis, membaca, dan menghapus preset melalui pemilik aktif", async () => {
    mocks.createPhotoWatermarkPreset.mockResolvedValue({ id: 1 }); mocks.listPhotoWatermarkPresets.mockResolvedValue([]); mocks.deletePhotoWatermarkPreset.mockResolvedValue(true);
    const caller = appRouter.createCaller(context(67)); const input = { name: "Logo kanan", text: "@tokoku", position: "bottom-right" as const, size: 4, font: "sans" as const };
    await caller.watermarkPresets.create(input); await caller.watermarkPresets.list(); await caller.watermarkPresets.delete({ presetId: 1 });
    expect(mocks.createPhotoWatermarkPreset).toHaveBeenCalledWith(67, input); expect(mocks.listPhotoWatermarkPresets).toHaveBeenCalledWith(67); expect(mocks.deletePhotoWatermarkPreset).toHaveBeenCalledWith(67, 1);
  });
});
