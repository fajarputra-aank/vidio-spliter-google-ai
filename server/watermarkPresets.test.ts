import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ listPhotoWatermarkPresets: vi.fn(), createPhotoWatermarkPreset: vi.fn(), deletePhotoWatermarkPreset: vi.fn(), listGlobalWatermarkPresets: vi.fn(), createGlobalWatermarkPreset: vi.fn(), updateGlobalWatermarkPreset: vi.fn(), reorderGlobalWatermarkPresets: vi.fn(), listGlobalWatermarkPresetAudits: vi.fn() }));
vi.mock("./db", () => ({ listPhotoWatermarkPresets: mocks.listPhotoWatermarkPresets, createPhotoWatermarkPreset: mocks.createPhotoWatermarkPreset, deletePhotoWatermarkPreset: mocks.deletePhotoWatermarkPreset, listGlobalWatermarkPresets: mocks.listGlobalWatermarkPresets, createGlobalWatermarkPreset: mocks.createGlobalWatermarkPreset, updateGlobalWatermarkPreset: mocks.updateGlobalWatermarkPreset, reorderGlobalWatermarkPresets: mocks.reorderGlobalWatermarkPresets, listGlobalWatermarkPresetAudits: mocks.listGlobalWatermarkPresetAudits }));
import { appRouter } from "./routers";

function context(userId: number): TrpcContext { return { user: { id: userId, openId: `watermark-${userId}`, name: "Pemilik", email: `pemilik${userId}@example.test`, loginMethod: "local", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }

function adminContext(userId: number): TrpcContext { return { ...context(userId), user: { ...context(userId).user!, role: "admin" } }; }

describe("preset watermark favorit", () => {
  it("menulis, membaca, dan menghapus preset melalui pemilik aktif", async () => {
    mocks.createPhotoWatermarkPreset.mockResolvedValue({ id: 1 }); mocks.listPhotoWatermarkPresets.mockResolvedValue([]); mocks.deletePhotoWatermarkPreset.mockResolvedValue(true);
    const caller = appRouter.createCaller(context(67)); const input = { name: "Logo kanan", text: "@tokoku", position: "bottom-right" as const, size: 4, font: "sans" as const };
    await caller.watermarkPresets.create(input); await caller.watermarkPresets.list(); await caller.watermarkPresets.delete({ presetId: 1 });
    expect(mocks.createPhotoWatermarkPreset).toHaveBeenCalledWith(67, input); expect(mocks.listPhotoWatermarkPresets).toHaveBeenCalledWith(67); expect(mocks.deletePhotoWatermarkPreset).toHaveBeenCalledWith(67, 1);
  });

  it("menjadikan preset global aktif dapat dibaca semua pengguna, tetapi hanya admin yang dapat mengubahnya", async () => {
    const input = { name: "Brand utama", text: "@lenssaku", position: "bottom-right" as const, size: 4, font: "sans" as const, isActive: true };
    mocks.listGlobalWatermarkPresets.mockResolvedValue([]); mocks.createGlobalWatermarkPreset.mockResolvedValue({ id: 8, ...input }); mocks.updateGlobalWatermarkPreset.mockResolvedValue({ id: 8, ...input }); mocks.reorderGlobalWatermarkPresets.mockResolvedValue([]); mocks.listGlobalWatermarkPresetAudits.mockResolvedValue([]);
    await appRouter.createCaller(context(67)).watermarkPresets.global();
    const admin = appRouter.createCaller(adminContext(1));
    await admin.admin.globalWatermarkPresets(); await admin.admin.createGlobalWatermarkPreset(input); await admin.admin.updateGlobalWatermarkPreset({ id: 8, ...input, isActive: false }); await admin.admin.reorderGlobalWatermarkPresets({ presetIds: [8, 9] }); await admin.admin.globalWatermarkPresetAudits();
    await expect(appRouter.createCaller(context(68)).admin.createGlobalWatermarkPreset(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.listGlobalWatermarkPresets).toHaveBeenCalledWith(); expect(mocks.listGlobalWatermarkPresets).toHaveBeenCalledWith(false); expect(mocks.createGlobalWatermarkPreset).toHaveBeenCalledWith(1, input); expect(mocks.updateGlobalWatermarkPreset).toHaveBeenCalledWith(1, 8, { ...input, isActive: false }); expect(mocks.reorderGlobalWatermarkPresets).toHaveBeenCalledWith(1, [8, 9]); expect(mocks.listGlobalWatermarkPresetAudits).toHaveBeenCalledOnce();
  });

  it("meneruskan filter nama administrator dan tindakan hanya dari prosedur admin", async () => {
    mocks.listGlobalWatermarkPresetAudits.mockResolvedValue([]);
    await appRouter.createCaller(adminContext(1)).admin.globalWatermarkPresetAudits({ search: "Fajar", action: "updated" });
    await expect(appRouter.createCaller(context(68)).admin.globalWatermarkPresetAudits({ action: "updated" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.listGlobalWatermarkPresetAudits).toHaveBeenCalledWith({ search: "Fajar", action: "updated" });
  });
});
